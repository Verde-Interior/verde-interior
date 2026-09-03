// src/components/Ponto/Ponto.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import './Ponto.css';

const F = (n) => (n < 10 ? '0' + n : String(n));
const HM = (min) => {
  const s = min < 0 ? '-' : '';
  const v = Math.abs(Math.round(min));
  return `${s}${Math.floor(v / 60)}h${F(v % 60)}`;
};
const HMh = (h) => HM(Math.round(h * 60));

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${F(d.getMonth() + 1)}-${F(d.getDate())}`;
}

// Soma os intervalos entrada→(intervalo|saída) de hoje. Se o último registro
// for entrada/retorno em aberto, conta até agora (igual ao app de Ponto).
function calcTrabalhado(recs) {
  let t = 0, e = null;
  for (const p of recs) {
    const [h, m] = p.time.split(':').map(Number);
    const min = h * 60 + m;
    if (p.type === 'entry' || p.type === 'return') e = min;
    if ((p.type === 'break' || p.type === 'exit') && e !== null) { t += min - e; e = null; }
  }
  if (e !== null) {
    const n = new Date();
    t += n.getHours() * 60 + n.getMinutes() - e;
  }
  return t;
}

function statusDeHoje(recs) {
  if (!recs.length) return { label: 'Sem registro', dot: 'ponto-dot--fora' };
  const last = recs[recs.length - 1];
  if (last.type === 'exit') return { label: 'Encerrado', dot: 'ponto-dot--fim' };
  if (last.type === 'break') return { label: 'Intervalo', dot: 'ponto-dot--pausa' };
  return { label: 'Presente', dot: 'ponto-dot--ativo' };
}

function bloqueadoEm(bloqueios, empId, iso) {
  return bloqueios.some(
    (b) => String(b.funcionario_id) === String(empId) && iso >= b.data_inicio && iso <= b.data_fim
  );
}

// Dias úteis (seg-sex) do mês corrente até `ateISO`, descontando dias com
// bloqueio aprovado (feriado/férias/folga/atestado) desse funcionário.
function diasUteisDoMes(bloqueios, empId, ateISO) {
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

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export default function Ponto() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [hojeRecs, setHojeRecs] = useState({});     // employee_id -> records[] (hoje)
  const [mesRecs, setMesRecs] = useState({});       // employee_id -> { data: records[] }
  const [bloqueios, setBloqueios] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [aprovando, setAprovando] = useState(null);

  const hoje = hojeISO();
  const inicioMes = hoje.slice(0, 8) + '01';

  const carregar = useCallback(async () => {
    const [empRes, hojeRes, mesRes, bloqRes, justRes] = await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('punch_records').select('employee_id,type,time').eq('date', hoje),
      supabase.from('punch_records').select('employee_id,date,type,time').gte('date', inicioMes).lte('date', hoje),
      supabase.from('employee_bloqueios').select('funcionario_id,data_inicio,data_fim,motivo'),
      supabase.from('justifications').select('*').eq('status', 'pendente').order('date', { ascending: false }),
    ]);

    if (empRes.error) { setErro(empRes.error.message); setCarregando(false); return; }

    setEmployees(empRes.data ?? []);
    setBloqueios(bloqRes.data ?? []);
    setPendentes(justRes.data ?? []);

    const porHoje = {};
    (hojeRes.data ?? []).forEach((r) => {
      if (!porHoje[r.employee_id]) porHoje[r.employee_id] = [];
      porHoje[r.employee_id].push(r);
    });
    Object.values(porHoje).forEach((arr) => arr.sort((a, b) => a.time.localeCompare(b.time)));
    setHojeRecs(porHoje);

    const porMes = {};
    (mesRes.data ?? []).forEach((r) => {
      if (!porMes[r.employee_id]) porMes[r.employee_id] = {};
      if (!porMes[r.employee_id][r.date]) porMes[r.employee_id][r.date] = [];
      porMes[r.employee_id][r.date].push(r);
    });
    setMesRecs(porMes);

    setErro(null);
    setCarregando(false);
  }, [hoje, inicioMes]);

  useEffect(() => { carregar(); }, [carregar]);
  useRealtimeRefresh('punch_records', carregar);
  useRealtimeRefresh('justifications', carregar);

  const linhas = useMemo(() => employees.map((e) => {
    const recs = hojeRecs[e.id] || [];
    const entrada = recs.find((r) => r.type === 'entry');
    const saida   = [...recs].reverse().find((r) => r.type === 'exit');
    const status  = statusDeHoje(recs);
    const trabalhadoMin = calcTrabalhado(recs);
    const saldoMin = trabalhadoMin - e.daily_hours * 60;
    return { emp: e, entrada, saida, status, trabalhadoMin, saldoMin, temRegistro: recs.length > 0 };
  }), [employees, hojeRecs]);

  const kpis = useMemo(() => {
    let presentes = 0, encerrados = 0, atrasados = 0, intervalo = 0;
    linhas.forEach(({ status, entrada }) => {
      if (status.label === 'Presente') presentes++;
      if (status.label === 'Intervalo') { presentes++; intervalo++; }
      if (status.label === 'Encerrado') encerrados++;
      if (entrada) {
        const [h, m] = entrada.time.split(':').map(Number);
        if (h * 60 + m > 8 * 60 + 10) atrasados++;
      }
    });
    const ausentes = employees.length - presentes - encerrados;
    return { presentes, encerrados, ausentes, atrasados, intervalo };
  }, [linhas, employees.length]);

  const ritmo = useMemo(() => employees.map((e) => {
    const dias = diasUteisDoMes(bloqueios, e.id, hoje);
    const metaAteAgora = Math.max(1, e.daily_hours * dias.length);
    const trabalhado = Number(e.worked_hours) || 0;
    const pct = Math.round((trabalhado / metaAteAgora) * 100);
    return { emp: e, trabalhado, metaAteAgora, pct, diasEsperados: dias.length };
  }).sort((a, b) => a.pct - b.pct), [employees, bloqueios, hoje]);

  const frequencia = useMemo(() => employees.map((e) => {
    const dias = diasUteisDoMes(bloqueios, e.id, hoje);
    const porData = mesRecs[e.id] || {};
    let faltas = 0, atrasos = 0, saidasAntes = 0;
    dias.forEach((iso) => {
      const recs = porData[iso];
      if (!recs || !recs.length) { faltas++; return; }
      const ent = recs.find((r) => r.type === 'entry');
      if (ent) {
        const [h, m] = ent.time.split(':').map(Number);
        if (h * 60 + m > 8 * 60 + 20) atrasos++;
      }
      const sai = [...recs].reverse().find((r) => r.type === 'exit');
      if (sai) {
        const [h, m] = sai.time.split(':').map(Number);
        if (h * 60 + m < 17 * 60 + 40) saidasAntes++;
      }
    });
    const adesao = dias.length ? Math.round(((dias.length - faltas) / dias.length) * 100) : 100;
    return { emp: e, previstos: dias.length, faltas, atrasos, saidasAntes, adesao };
  }), [employees, bloqueios, mesRecs, hoje]);

  // Empresa toda sem nenhum registro hoje, já passado das 9h e com gente
  // cadastrada — mais provável ser bloqueio de permissão (RLS) do que
  // ninguém ter comparecido. Aviso brando, não trava a tela.
  const suspeitaDePermissao = useMemo(() => {
    const agoraMin = new Date().getHours() * 60 + new Date().getMinutes();
    return !carregando && !erro && employees.length > 0
      && Object.keys(hojeRecs).length === 0 && agoraMin > 9 * 60;
  }, [carregando, erro, employees.length, hojeRecs]);

  async function aprovar(just, status) {
    setAprovando(just.id);
    const { error } = await supabase.from('justifications').update({ status }).eq('id', just.id);
    if (!error) setPendentes((prev) => prev.filter((j) => j.id !== just.id));
    setAprovando(null);
  }

  const agora = new Date();
  const mesLabel = `${MESES[agora.getMonth()]} ${agora.getFullYear()}`;

  if (carregando) {
    return <div className="ponto ponto--carregando">Carregando ponto da equipe…</div>;
  }

  if (erro) {
    return (
      <div className="ponto">
        <div className="ponto__erro">Não foi possível carregar os dados de ponto: {erro}</div>
      </div>
    );
  }

  return (
    <div className="ponto">
      <header className="ponto__header">
        <div>
          <h1 className="ponto__titulo">Ponto</h1>
          <p className="ponto__subtitulo">Presença e horas da equipe — registrado no app Ponto pelos colaboradores</p>
        </div>
        <div className="ponto__data">
          {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </div>
      </header>

      {suspeitaDePermissao && (
        <div className="ponto__aviso">
          Nenhum registro de ponto apareceu para hoje, para ninguém da equipe. Se o pessoal já bateu ponto,
          este login pode não ter permissão de gestor liberada para ler os registros — vale confirmar.
        </div>
      )}

      <section className="ponto__kpis">
        <div className="ponto__kpi">
          <span className="ponto__kpi-valor ponto__kpi-valor--forest">{kpis.presentes}</span>
          <span className="ponto__kpi-label">Presentes</span>
        </div>
        <div className="ponto__kpi">
          <span className="ponto__kpi-valor">{kpis.encerrados}</span>
          <span className="ponto__kpi-label">Encerrados</span>
        </div>
        <div className="ponto__kpi">
          <span className="ponto__kpi-valor ponto__kpi-valor--vinho">{kpis.ausentes}</span>
          <span className="ponto__kpi-label">Ausentes</span>
        </div>
        <div className="ponto__kpi">
          <span className="ponto__kpi-valor ponto__kpi-valor--warn">{kpis.atrasados}</span>
          <span className="ponto__kpi-label">Atrasados</span>
        </div>
        <div className="ponto__kpi">
          <span className="ponto__kpi-valor ponto__kpi-valor--warn">{kpis.intervalo}</span>
          <span className="ponto__kpi-label">Intervalo</span>
        </div>
      </section>

      <section className="ponto__card">
        <h2 className="ponto__card-titulo">Hoje</h2>
        <div className="ponto__tabela-wrap">
          <table className="ponto__tabela">
            <thead>
              <tr>
                <th>Nome</th><th>Contrato</th><th>Entrada</th><th>Saída</th>
                <th>Status</th><th>Trabalhado</th><th>Saldo hoje</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ emp, entrada, saida, status, trabalhadoMin, saldoMin, temRegistro }) => (
                <tr key={emp.id}>
                  <td className="ponto__nome">{emp.name}</td>
                  <td><span className="ponto__badge">{emp.contract_type}</span></td>
                  <td>{entrada ? entrada.time : '--:--'}</td>
                  <td>{saida ? saida.time : '--:--'}</td>
                  <td>
                    <span className={`ponto-dot ${status.dot}`} />
                    {status.label}
                  </td>
                  <td>{HM(trabalhadoMin)}</td>
                  <td className={saldoMin >= 0 ? 'ponto__pos' : 'ponto__neg'}>
                    {temRegistro ? `${saldoMin >= 0 ? '+' : ''}${HM(saldoMin)}` : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ponto__card">
        <h2 className="ponto__card-titulo">Ritmo do mês</h2>
        <p className="ponto__card-sub">
          Trabalhado vs. esperado até hoje — feriados e ausências aprovadas já descontados da meta
        </p>
        <div className="ponto__ritmo-lista">
          {ritmo.map(({ emp, trabalhado, metaAteAgora, pct }) => (
            <div className="ponto__ritmo-linha" key={emp.id}>
              <span className="ponto__ritmo-nome">{emp.name}</span>
              <div className="ponto__ritmo-barra">
                <div
                  className={`ponto__ritmo-fill ${pct >= 100 ? 'ponto__ritmo-fill--ok' : pct >= 80 ? 'ponto__ritmo-fill--alerta' : 'ponto__ritmo-fill--perigo'}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <span className="ponto__ritmo-valor">{HMh(trabalhado)} de {HMh(metaAteAgora)} ({pct}%)</span>
            </div>
          ))}
        </div>
      </section>

      <div className="ponto__grid2">
        <section className="ponto__card">
          <h2 className="ponto__card-titulo">Frequência — {mesLabel}</h2>
          <div className="ponto__tabela-wrap">
            <table className="ponto__tabela">
              <thead>
                <tr>
                  <th>Nome</th><th>Previstos</th><th>Faltas</th><th>Atrasos</th><th>Saídas antec.</th><th>Adesão</th>
                </tr>
              </thead>
              <tbody>
                {frequencia.map(({ emp, previstos, faltas, atrasos, saidasAntes, adesao }) => (
                  <tr key={emp.id}>
                    <td className="ponto__nome">{emp.name}</td>
                    <td>{previstos}</td>
                    <td className={faltas > 0 ? 'ponto__neg' : ''}>{faltas}</td>
                    <td className={atrasos > 0 ? 'ponto__warn' : ''}>{atrasos}</td>
                    <td className={saidasAntes > 0 ? 'ponto__warn' : ''}>{saidasAntes}</td>
                    <td className={adesao >= 95 ? 'ponto__pos' : adesao >= 80 ? 'ponto__warn' : 'ponto__neg'}>{adesao}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ponto__card">
          <h2 className="ponto__card-titulo">
            Justificativas pendentes
            {pendentes.length > 0 && <span className="ponto__contador">{pendentes.length}</span>}
          </h2>
          {pendentes.length === 0 ? (
            <p className="ponto__vazio">Nenhuma pendente.</p>
          ) : (
            <div className="ponto__just-lista">
              {pendentes.map((j) => {
                const emp = employees.find((e) => e.id === j.employee_id);
                return (
                  <div className="ponto__just" key={j.id}>
                    <div className="ponto__just-info">
                      <span className="ponto__just-nome">{emp ? emp.name : '—'}</span>
                      <span className="ponto__just-meta">{j.date?.split('-').reverse().join('/')} · {j.type}</span>
                      <span className="ponto__just-desc">{j.description}</span>
                    </div>
                    <div className="ponto__just-acoes">
                      <button
                        className="ponto__btn ponto__btn--ok"
                        disabled={aprovando === j.id}
                        onClick={() => aprovar(j, 'aprovado')}
                      >✓ Aprovar</button>
                      <button
                        className="ponto__btn ponto__btn--rec"
                        disabled={aprovando === j.id}
                        onClick={() => aprovar(j, 'recusado')}
                      >✕ Recusar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
