// Aba "Equipe" — visão read-only do status de todos os colaboradores no dia.
// Objetivo: um colaborador que terminou a agenda cedo consegue ver quem está
// atrasado e perto pra oferecer ajuda.
import { supabase } from './supabase.js';
import { AUTH } from './auth.js';
import { distanciaMetros, getHoje, WDS, MESES, F, esc } from './utils.js';

const REFRESH_MS = 2 * 60 * 1000;
const MARGIN_MIN = 20;

let refreshTimer = null;

async function loadAgendaHoje() {
  const { data, error } = await supabase
    .from('agenda')
    .select(`
      id, hora_estimada_chegada, duracao_estimada_min,
      ordem_rota, status, funcionario_id,
      cliente:clientes(id, nome_empresa, lat, lng),
      lead:leads(id, nome_empresa),
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

// Retorna o nome exibível — cliente ou lead ou fallback
function nomeVisita(v) {
  return v.cliente?.nome_empresa || v.lead?.nome_empresa || '—';
}

async function loadFuncionarios() {
  const { data } = await supabase.from('employees').select('id, name, cargo');
  return data ?? [];
}

// Extrai o relatorio (Supabase retorna como array quando é join 1:N,
// mas há constraint UNIQUE, então sempre haverá 0 ou 1 elemento)
function rel(v) {
  const r = v?.relatorio;
  if (!r) return null;
  return Array.isArray(r) ? r[0] : r;
}

// Status do colaborador com base em suas visitas de hoje.
function calcStatus(visitas, now) {
  const sorted = [...visitas].sort((a, b) => (a.ordem_rota ?? 999) - (b.ordem_rota ?? 999));

  // Visita em execução?
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

  // Compara agora vs hora estimada da próxima visita.
  const [hh, mm] = (proxima.hora_estimada_chegada || '00:00').split(':').map(Number);
  const estMin = hh * 60 + mm;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const diff = nowMin - estMin;

  if (diff > MARGIN_MIN) {
    return {
      s: 'atrasado',
      label: 'Atrasado para próxima visita',
      nome: nomeVisita(proxima),
      visit: proxima,
      minLate: diff,
    };
  }
  if (diff < -MARGIN_MIN) {
    return {
      s: 'adiantado',
      label: 'Adiantado',
      nome: nomeVisita(proxima),
      visit: proxima,
      minEarly: -diff,
    };
  }
  return { s: 'ok', label: 'No horário', nome: nomeVisita(proxima), visit: proxima };
}

// Melhor estimativa de onde o colaborador está agora.
function getLocation(visitas) {
  const emExec = visitas.find(v => v.status === 'em_execucao');
  const rExec = rel(emExec);
  if (rExec?.checkin_lat != null && rExec?.checkin_lng != null) {
    return { lat: rExec.checkin_lat, lng: rExec.checkin_lng, source: 'atual' };
  }
  const sorted = [...visitas].sort((a, b) => (a.ordem_rota ?? 999) - (b.ordem_rota ?? 999));
  const proxima = sorted.find(v => v.status === 'publicado');
  if (proxima?.cliente?.lat != null && proxima?.cliente?.lng != null) {
    return { lat: proxima.cliente.lat, lng: proxima.cliente.lng, source: 'proxima' };
  }
  const concluidas = sorted.filter(v => v.status === 'concluido').reverse();
  for (const c of concluidas) {
    const rC = rel(c);
    if (rC?.checkout_lat != null && rC?.checkout_lng != null) {
      return { lat: rC.checkout_lat, lng: rC.checkout_lng, source: 'ultima' };
    }
    if (c.cliente?.lat != null && c.cliente?.lng != null) {
      return { lat: c.cliente.lat, lng: c.cliente.lng, source: 'ultima' };
    }
  }
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
    result.push({
      id: fid,
      name: emp.name,
      cargo: emp.cargo,
      status: calcStatus(visitas, now),
      loc: getLocation(visitas),
      isMe: fid === String(meuId),
      totalVisitas: visitas.length,
      concluidas: visitas.filter(v => v.status === 'concluido').length,
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

function ico(s) {
  return { atrasado: '🔴', trabalhando: '🟢', ok: '⚪', adiantado: '🔵',
           concluido: '✅', sem_agenda: '⚫' }[s] || '⚪';
}

export async function renderEquipe() {
  const root = document.getElementById('sv-equipe');
  if (!root) return;

  const ses = AUTH.getSession();
  if (!ses?.employee_id) {
    root.innerHTML = `<div class="eq-empty">Sua conta não está vinculada a um funcionário.</div>`;
    return;
  }

  // Preserva conteúdo anterior enquanto recarrega (evita flash de "Carregando")
  if (!root.innerHTML.trim()) {
    root.innerHTML = `<div class="eq-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando equipe...</div>`;
  }

  try {
    const [agenda, funcionarios] = await Promise.all([loadAgendaHoje(), loadFuncionarios()]);
    const now = new Date();
    const equipe = processar(agenda, funcionarios, now, ses.employee_id);

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
    sub = `<strong>${s.total} visitas realizadas</strong> — você pode ajudar quem está atrasado abaixo`;
  } else {
    sub = 'Sem visitas hoje';
  }

  return `
    <div class="eq-me eq-me--${s.s}">
      <div class="eq-me__lbl">Você</div>
      <div class="eq-me__row">
        <span class="eq-me__ico">${ico(s.s)}</span>
        <div class="eq-me__body">
          <div class="eq-me__status">${esc(s.label)}</div>
          <div class="eq-me__sub">${sub}</div>
        </div>
      </div>
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
    sub = `${cli}${rest}`;
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

  return `
    <div class="eq-card eq-card--${s.s}">
      <div class="eq-card__row">
        <span class="eq-card__ico">${ico(s.s)}</span>
        <div class="eq-card__body">
          <div class="eq-card__name">${esc(c.name)} <span class="eq-card__cargo">${esc(c.cargo || '')}</span></div>
          <div class="eq-card__status">${esc(s.label)}</div>
          <div class="eq-card__sub">${sub}</div>
          ${distStr ? `<div class="eq-card__dist"><i class="fa-solid fa-location-dot"></i> ${distStr}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

export function stopEquipeRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}
