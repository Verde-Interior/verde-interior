// Aba "Equipe" — visão read-only do status de todos os colaboradores no dia.
// Objetivo: um colaborador que terminou a agenda cedo consegue ver quem está
// atrasado e perto pra oferecer ajuda. Clicando no card, abre modal com a
// agenda completa da pessoa (todas as visitas do dia).
import { supabase } from './supabase.js';
import { AUTH } from './auth.js';
import { distanciaMetros, getHoje, WDS, MESES, F, esc } from './utils.js';

const REFRESH_MS = 2 * 60 * 1000;
const MARGIN_MIN = 20;

let refreshTimer = null;
// Cache das visitas por funcionario_id — usado pelo modal
let equipeCache = new Map();
// Cache dos funcionários por id — usado pelo modal
let funcionariosCache = new Map();

async function loadAgendaHoje() {
  const { data, error } = await supabase
    .from('agenda')
    .select(`
      id, hora_estimada_chegada, duracao_estimada_min,
      ordem_rota, status, funcionario_id,
      cliente:clientes(id, nome_empresa, lat, lng),
      lead:leads(id, empresa, lat, lng),
      relatorio:relatorios(
        checkin_at, checkin_lat, checkin_lng,
        checkout_at, checkout_lat, checkout_lng, status
      )
    `)
    .eq('data_agendada', getHoje())
    .in('status', ['publicado', 'em_execucao', 'concluido']);
  if (error) throw error;
  return data ?? [];
}

async function loadFuncionarios() {
  const { data } = await supabase.from('employees').select('id, name, cargo');
  return data ?? [];
}

// Nome exibível da visita — cliente ou lead
function nomeVisita(v) {
  return v.cliente?.nome_empresa || v.lead?.empresa || '—';
}

// Extrai o relatorio (Supabase pode retornar como array em joins 1:N)
function rel(v) {
  const r = v?.relatorio;
  if (!r) return null;
  return Array.isArray(r) ? r[0] : r;
}

function calcStatus(visitas, now) {
  const sorted = [...visitas].sort((a, b) => (a.ordem_rota ?? 999) - (b.ordem_rota ?? 999));

  const emExec = sorted.find(v => v.status === 'em_execucao');
  if (emExec) {
    const r = rel(emExec);
    if (r?.checkin_at) {
      const checkin = new Date(r.checkin_at);
      const minsInVisit = (now.getTime() - checkin.getTime()) / 60000;
      const dur = emExec.duracao_estimada_min || 60;
      if (minsInVisit > dur + MARGIN_MIN) {
        return {
          s: 'atrasado',
          label: 'Atrasado na visita atual',
          nome: nomeVisita(emExec),
          visit: emExec,
          minLate: Math.round(minsInVisit - dur),
        };
      }
      return {
        s: 'trabalhando',
        label: 'Em visita',
        nome: nomeVisita(emExec),
        visit: emExec,
        minsInVisit: Math.round(minsInVisit),
        duracao: dur,
      };
    }
  }

  const proxima = sorted.find(v => v.status === 'publicado');
  if (!proxima) {
    const todasConcluidas = sorted.length > 0 && sorted.every(v => v.status === 'concluido');
    return todasConcluidas
      ? { s: 'concluido', label: 'Agenda concluída', total: sorted.length }
      : { s: 'sem_agenda', label: 'Sem agenda hoje' };
  }

  const [hh, mm] = (proxima.hora_estimada_chegada || '00:00').split(':').map(Number);
  const estMin = hh * 60 + mm;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const diff = nowMin - estMin;

  if (diff > MARGIN_MIN) {
    return { s: 'atrasado', label: 'Atrasado para próxima visita', nome: nomeVisita(proxima), visit: proxima, minLate: diff };
  }
  if (diff < -MARGIN_MIN) {
    return { s: 'adiantado', label: 'Adiantado', nome: nomeVisita(proxima), visit: proxima, minEarly: -diff };
  }
  return { s: 'ok', label: 'No horário', nome: nomeVisita(proxima), visit: proxima };
}

function getLocation(visitas) {
  const emExec = visitas.find(v => v.status === 'em_execucao');
  const rExec = rel(emExec);
  if (rExec?.checkin_lat != null && rExec?.checkin_lng != null) {
    return { lat: rExec.checkin_lat, lng: rExec.checkin_lng, source: 'atual' };
  }
  const sorted = [...visitas].sort((a, b) => (a.ordem_rota ?? 999) - (b.ordem_rota ?? 999));
  const proxima = sorted.find(v => v.status === 'publicado');
  const proxCoord = coordDeVisita(proxima);
  if (proxCoord) return { ...proxCoord, source: 'proxima' };

  const concluidas = sorted.filter(v => v.status === 'concluido').reverse();
  for (const c of concluidas) {
    const rC = rel(c);
    if (rC?.checkout_lat != null && rC?.checkout_lng != null) {
      return { lat: rC.checkout_lat, lng: rC.checkout_lng, source: 'ultima' };
    }
    const coord = coordDeVisita(c);
    if (coord) return { ...coord, source: 'ultima' };
  }
  return null;
}

function coordDeVisita(v) {
  if (!v) return null;
  if (v.cliente?.lat != null && v.cliente?.lng != null) return { lat: v.cliente.lat, lng: v.cliente.lng };
  if (v.lead?.lat != null && v.lead?.lng != null)       return { lat: v.lead.lat, lng: v.lead.lng };
  return null;
}

function processar(agenda, funcionarios, now, meuId) {
  const grupos = new Map();
  for (const v of agenda) {
    const fid = String(v.funcionario_id);
    if (!grupos.has(fid)) grupos.set(fid, []);
    grupos.get(fid).push(v);
  }
  const result = [];
  for (const [fid, visitas] of grupos.entries()) {
    const emp = funcionarios.find(e => String(e.id) === fid);
    if (!emp) continue;
    const sorted = [...visitas].sort((a, b) => (a.ordem_rota ?? 999) - (b.ordem_rota ?? 999));
    result.push({
      id: fid,
      name: emp.name,
      cargo: emp.cargo,
      status: calcStatus(sorted, now),
      loc: getLocation(sorted),
      isMe: fid === String(meuId),
      visitas: sorted,
      totalVisitas: sorted.length,
      concluidas: sorted.filter(v => v.status === 'concluido').length,
    });
  }
  return result;
}

function score(colega, minhaLoc) {
  let s = 0;
  if (colega.status.s === 'atrasado') s += 1_000_000;
  if (minhaLoc && colega.loc) {
    const d = distanciaMetros(minhaLoc.lat, minhaLoc.lng, colega.loc.lat, colega.loc.lng);
    s -= d ?? 100_000;
  } else {
    s -= 100_000;
  }
  return s;
}

function fmtDist(m) {
  if (m == null) return '';
  if (m < 1000) return `~${m}m`;
  return `~${(m / 1000).toFixed(1)}km`;
}

export async function renderEquipe() {
  const root = document.getElementById('sv-equipe');
  if (!root) return;

  const ses = AUTH.getSession();
  if (!ses?.employee_id) {
    root.innerHTML = `<div class="eq-empty">Sua conta não está vinculada a um funcionário.</div>`;
    return;
  }

  if (!root.innerHTML.trim()) {
    root.innerHTML = `<div class="eq-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando equipe...</div>`;
  }

  try {
    const [agenda, funcionarios] = await Promise.all([loadAgendaHoje(), loadFuncionarios()]);
    const now = new Date();
    const equipe = processar(agenda, funcionarios, now, ses.employee_id);

    // Atualiza caches para o modal
    equipeCache = new Map(equipe.map(e => [e.id, e]));
    funcionariosCache = new Map(funcionarios.map(f => [String(f.id), f]));

    const eu = equipe.find(e => e.isMe);
    const outros = equipe.filter(e => !e.isMe);
    const minhaLoc = eu?.loc || null;
    outros.sort((a, b) => score(b, minhaLoc) - score(a, minhaLoc));

    root.innerHTML = renderView(eu, outros, minhaLoc, now);
  } catch (err) {
    root.innerHTML = `<div class="eq-empty eq-empty--err">Erro ao carregar: ${esc(err.message)}</div>`;
  }

  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    const el = document.getElementById('sv-equipe');
    if (el && el.classList.contains('on')) renderEquipe();
  }, REFRESH_MS);
}

function renderView(eu, outros, minhaLoc, now) {
  const dataStr = `${WDS[now.getDay()]}, ${now.getDate()} ${MESES[now.getMonth()].slice(0, 3)}`;
  const timeStr = `${F(now.getHours())}:${F(now.getMinutes())}`;

  return `
    <div class="eq-header">
      <div>
        <div class="eq-title">Equipe hoje</div>
        <div class="eq-sub">${dataStr} · atualizado ${timeStr}</div>
      </div>
      <button class="eq-refresh" onclick="agendaRenderEquipe()" title="Atualizar" aria-label="Atualizar">
        <i class="fa-solid fa-arrows-rotate"></i>
      </button>
    </div>

    ${renderMeuStatus(eu)}

    <div class="sl" style="margin-top:1.25rem">Colegas ordenados por prioridade</div>

    ${outros.length === 0
      ? `<div class="eq-empty">Nenhum outro colaborador com agenda hoje.</div>`
      : outros.map(o => renderColega(o, minhaLoc)).join('')}

    <div id="eq-modal-root"></div>
  `;
}

function renderMeuStatus(eu) {
  if (!eu) return `<div class="eq-me eq-me--sem_agenda"><div class="eq-me__lbl">Você</div><div class="eq-me__status">Sem agenda hoje</div></div>`;

  const s = eu.status;
  const cli = esc(s.nome || '—');
  let sub = '';

  if (s.s === 'trabalhando') {
    const restante = s.duracao - s.minsInVisit;
    const rest = restante > 0 ? ` · ~${restante}min restantes` : '';
    sub = `Em visita em <strong>${cli}</strong>${rest}`;
  } else if (s.s === 'atrasado' && s.visit?.status === 'em_execucao') {
    sub = `Deveria ter saído de <strong>${cli}</strong> há ~${s.minLate}min`;
  } else if (s.s === 'atrasado') {
    sub = `Atrasado ~${s.minLate}min para chegar em <strong>${cli}</strong>`;
  } else if (s.s === 'adiantado') {
    sub = `${s.minEarly}min adiantado — próxima: <strong>${cli}</strong>`;
  } else if (s.s === 'ok') {
    sub = `Próxima visita: <strong>${cli}</strong>`;
  } else if (s.s === 'concluido') {
    sub = `<strong>${s.total} visitas realizadas</strong> — clique num colega abaixo pra ajudar`;
  } else {
    sub = 'Sem visitas hoje';
  }

  const contagem = `${eu.concluidas}/${eu.totalVisitas} visitas`;

  return `
    <div class="eq-me eq-me--${s.s}" onclick="agendaEquipeAbrirModal('${esc(eu.id)}')" role="button" tabindex="0">
      <div class="eq-me__head">
        <div class="eq-me__lbl">Você</div>
        <div class="eq-me__count">${contagem}</div>
      </div>
      <div class="eq-me__status">${esc(s.label)}</div>
      <div class="eq-me__sub">${sub}</div>
    </div>
  `;
}

function renderColega(c, minhaLoc) {
  const s = c.status;
  const cli = esc(s.nome || '—');
  const dist = minhaLoc && c.loc
    ? distanciaMetros(minhaLoc.lat, minhaLoc.lng, c.loc.lat, c.loc.lng)
    : null;
  const distStr = dist != null ? `${fmtDist(dist)} de você` : '';

  let sub = '';
  if (s.s === 'trabalhando') {
    const restante = s.duracao - s.minsInVisit;
    const rest = restante > 0 ? ` · ~${restante}min restantes` : '';
    sub = `Em ${cli}${rest}`;
  } else if (s.s === 'atrasado' && s.visit?.status === 'em_execucao') {
    sub = `${cli} · deveria ter saído há ~${s.minLate}min`;
  } else if (s.s === 'atrasado') {
    const hora = (s.visit.hora_estimada_chegada || '').slice(0, 5);
    sub = `${cli} · deveria chegar ${hora ? 'às ' + hora : ''}`;
  } else if (s.s === 'adiantado') {
    const hora = (s.visit.hora_estimada_chegada || '').slice(0, 5);
    sub = `Próxima: ${cli}${hora ? ' às ' + hora : ''}`;
  } else if (s.s === 'ok') {
    const hora = (s.visit.hora_estimada_chegada || '').slice(0, 5);
    sub = `Próxima: ${cli}${hora ? ' às ' + hora : ''}`;
  } else if (s.s === 'concluido') {
    sub = `${s.total} visitas realizadas`;
  } else {
    sub = 'Sem agenda hoje';
  }

  const contagem = `${c.concluidas}/${c.totalVisitas}`;

  return `
    <div class="eq-card eq-card--${s.s}" onclick="agendaEquipeAbrirModal('${esc(c.id)}')" role="button" tabindex="0">
      <div class="eq-card__head">
        <div class="eq-card__name">${esc(c.name)} <span class="eq-card__cargo">${esc(c.cargo || '')}</span></div>
        <div class="eq-card__count">${contagem}</div>
      </div>
      <div class="eq-card__status">${esc(s.label)}</div>
      <div class="eq-card__sub">${sub}</div>
      ${distStr ? `<div class="eq-card__dist"><i class="fa-solid fa-location-dot"></i> ${distStr}</div>` : ''}
    </div>
  `;
}

// ── Modal com agenda completa da pessoa ─────────────────────────
export function abrirModalAgenda(colegaId) {
  const colega = equipeCache.get(String(colegaId));
  if (!colega) return;
  const root = document.getElementById('eq-modal-root');
  if (!root) return;
  root.innerHTML = renderModal(colega);
  document.body.style.overflow = 'hidden';
}

export function fecharModalAgenda() {
  const root = document.getElementById('eq-modal-root');
  if (root) root.innerHTML = '';
  document.body.style.overflow = '';
}

function renderModal(colega) {
  const s = colega.status;
  const visitas = colega.visitas;

  const visitasHtml = visitas.map((v, idx) => {
    const r = rel(v);
    const hora = (v.hora_estimada_chegada || '').slice(0, 5);
    const nome = esc(nomeVisita(v));
    const dur = v.duracao_estimada_min || 60;
    let statusLabel = '', statusCls = '';
    let extra = '';
    if (v.status === 'concluido') {
      statusLabel = 'Concluída';
      statusCls = 'concluido';
      if (r?.checkin_at && r?.checkout_at) {
        const ci = new Date(r.checkin_at);
        const co = new Date(r.checkout_at);
        extra = `Check-in ${F(ci.getHours())}:${F(ci.getMinutes())} · Check-out ${F(co.getHours())}:${F(co.getMinutes())}`;
      }
    } else if (v.status === 'em_execucao') {
      statusLabel = 'Em execução';
      statusCls = 'em_execucao';
      if (r?.checkin_at) {
        const ci = new Date(r.checkin_at);
        extra = `Check-in às ${F(ci.getHours())}:${F(ci.getMinutes())}`;
      }
    } else {
      statusLabel = 'Aguardando';
      statusCls = 'publicado';
      extra = `${dur}min previstos`;
    }
    return `
      <div class="eq-modal__visita eq-modal__visita--${statusCls}">
        <div class="eq-modal__ord">${idx + 1}</div>
        <div class="eq-modal__vbody">
          <div class="eq-modal__vhead">
            <span class="eq-modal__vhora">${hora || '—'}</span>
            <span class="eq-modal__vstatus eq-modal__vstatus--${statusCls}">${statusLabel}</span>
          </div>
          <div class="eq-modal__vname">${nome}</div>
          ${extra ? `<div class="eq-modal__vextra">${esc(extra)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="eq-modal-bg" onclick="agendaEquipeFecharModal()">
      <div class="eq-modal" onclick="event.stopPropagation()">
        <div class="eq-modal__header">
          <div>
            <div class="eq-modal__title">${esc(colega.name)}</div>
            <div class="eq-modal__cargo">${esc(colega.cargo || '')} · ${esc(s.label)}</div>
          </div>
          <button class="eq-modal__close" onclick="agendaEquipeFecharModal()" aria-label="Fechar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="eq-modal__resumo">
          <strong>${colega.concluidas}/${colega.totalVisitas}</strong> visitas realizadas hoje
        </div>
        <div class="eq-modal__body">
          ${visitas.length ? visitasHtml : '<div class="eq-empty">Sem visitas hoje.</div>'}
        </div>
      </div>
    </div>
  `;
}

export function stopEquipeRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}
