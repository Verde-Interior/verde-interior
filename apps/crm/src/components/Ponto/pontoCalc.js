// src/components/Ponto/pontoCalc.js — funções puras compartilhadas entre a
// página de Ponto e o modal de edição de registros.

export const F = (n) => (n < 10 ? '0' + n : String(n));

export const HM = (min) => {
  const s = min < 0 ? '-' : '';
  const v = Math.abs(Math.round(min));
  return `${s}${Math.floor(v / 60)}h${F(v % 60)}`;
};

export const HMh = (h) => HM(Math.round(h * 60));

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const TIPO_LABEL = { entry: 'Entrada', break: 'Intervalo', return: 'Retorno', exit: 'Saída' };

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${F(d.getMonth() + 1)}-${F(d.getDate())}`;
}

export function isoToDate(iso) { return new Date(iso + 'T12:00:00'); }
export function dateToIso(d) { return `${d.getFullYear()}-${F(d.getMonth() + 1)}-${F(d.getDate())}`; }

export function diaLabel(iso) {
  const texto = isoToDate(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function diaAnterior(iso, minIso) {
  const d = isoToDate(iso);
  d.setDate(d.getDate() - 1);
  const novo = dateToIso(d);
  return novo < minIso ? minIso : novo;
}

export function diaSeguinte(iso, maxIso) {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + 1);
  const novo = dateToIso(d);
  return novo > maxIso ? maxIso : novo;
}

// Soma os intervalos entrada→(intervalo|saída) do dia. Se o último registro
// for entrada/retorno em aberto E `estenderAgora` for true, conta até agora
// (só faz sentido pra hoje, ao vivo). Pra qualquer recálculo de saldo
// acumulado, chame sempre com estenderAgora=false — um dia fechado no
// histórico não deve inventar horas de um registro esquecido em aberto.
export function calcTrabalhado(recs, estenderAgora) {
  let t = 0, e = null;
  for (const p of recs) {
    const [h, m] = p.time.split(':').map(Number);
    const min = h * 60 + m;
    if (p.type === 'entry' || p.type === 'return') e = min;
    if ((p.type === 'break' || p.type === 'exit') && e !== null) { t += min - e; e = null; }
  }
  if (e !== null && estenderAgora) {
    const n = new Date();
    t += n.getHours() * 60 + n.getMinutes() - e;
  }
  return t;
}

export function statusNoDia(recs, ehHoje) {
  if (!recs.length) return { label: 'Sem registro', dot: 'ponto-dot--fora' };
  const last = recs[recs.length - 1];
  if (last.type === 'exit') return { label: 'Encerrado', dot: 'ponto-dot--fim' };
  if (last.type === 'break') return { label: ehHoje ? 'Intervalo' : 'Não retornou do intervalo', dot: 'ponto-dot--pausa' };
  return { label: ehHoje ? 'Presente' : 'Não bateu saída', dot: 'ponto-dot--ativo' };
}

export function bloqueadoEm(bloqueios, empId, iso) {
  return bloqueios.some(
    (b) => String(b.funcionario_id) === String(empId) && iso >= b.data_inicio && iso <= b.data_fim
  );
}

// Dias úteis (seg-sex) do mês corrente até `ateISO`, descontando dias com
// bloqueio aprovado (feriado/férias/folga/atestado) desse funcionário.
export function diasUteisDoMes(bloqueios, empId, ateISO) {
  const [y, m] = ateISO.split('-').map(Number);
  const dias = [];
  const ultimoDia = new Date(y, m, 0).getDate();
  for (let d = 1; d <= ultimoDia; d++) {
    const iso = `${y}-${F(m)}-${F(d)}`;
    if (iso > ateISO) break;
    const dow = new Date(y, m - 1, d).getDay();
    if (dow === 0 || dow === 6) continue;
    if (bloqueadoEm(bloqueios, empId, iso)) continue;
    dias.push(iso);
  }
  return dias;
}

// Valida se um novo registro faz sentido na sequência do dia (mesma regra
// do app de Ponto): intervalo/saída precisam de uma entrada/retorno antes;
// retorno precisa de um intervalo antes; e o horário tem que vir depois.
export function validarNovoRegistro(recs, type, time) {
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const timeMin = toMin(time);

  if (type === 'break' || type === 'exit') {
    const lastIn = [...recs]
      .filter((r) => r.type === 'entry' || r.type === 'return')
      .sort((a, b) => b.time.localeCompare(a.time))[0];
    if (!lastIn) return `Não é possível registrar ${TIPO_LABEL[type].toLowerCase()} sem uma entrada anterior`;
    if (timeMin <= toMin(lastIn.time)) return `Horário deve ser após ${TIPO_LABEL[lastIn.type]} (${lastIn.time})`;
  }
  if (type === 'return') {
    const lastBrk = [...recs]
      .filter((r) => r.type === 'break')
      .sort((a, b) => b.time.localeCompare(a.time))[0];
    if (!lastBrk) return 'Não é possível registrar retorno sem um intervalo anterior';
    if (timeMin <= toMin(lastBrk.time)) return `Horário deve ser após Intervalo (${lastBrk.time})`;
  }
  return null;
}

// Recalcula a contribuição de um dia (trabalhado/saldo) pro acumulado do
// funcionário, comparando o estado ANTES e DEPOIS de uma edição — evita
// o bug de dupla contagem que existia no app de Ponto (nunca soma o dia
// inteiro de novo, só a diferença real entre os dois estados).
export function calcularDeltaAcumulado(emp, recsAntes, recsDepois) {
  const meta = emp.daily_hours * 60;
  const workedAntes = calcTrabalhado(recsAntes, false);
  const workedDepois = calcTrabalhado(recsDepois, false);
  const saldoAntes = recsAntes.length ? workedAntes - meta : 0;
  const saldoDepois = recsDepois.length ? workedDepois - meta : 0;

  const extraAntes = saldoAntes > 0 ? saldoAntes / 60 : 0;
  const dueAntes = saldoAntes < 0 ? -saldoAntes / 60 : 0;
  const extraDepois = saldoDepois > 0 ? saldoDepois / 60 : 0;
  const dueDepois = saldoDepois < 0 ? -saldoDepois / 60 : 0;

  return {
    worked_hours: Number(emp.worked_hours) + (workedDepois - workedAntes) / 60,
    bank_minutes: emp.bank_minutes + (saldoDepois - saldoAntes),
    days_worked: emp.days_worked + ((recsDepois.length > 0 ? 1 : 0) - (recsAntes.length > 0 ? 1 : 0)),
    extra_hours: Math.max(0, Number(emp.extra_hours) + (extraDepois - extraAntes)),
    due_hours: Math.max(0, Number(emp.due_hours) + (dueDepois - dueAntes)),
  };
}
