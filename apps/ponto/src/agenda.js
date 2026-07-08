// src/agenda.js — Sistema de Campo: Minha Agenda (funcionário)
import { supabase } from './supabase.js';
import { AUTH } from './auth.js';
import { toast, F, getHoje } from './utils.js';

const DIAS_LABEL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

// ── Estado local ──────────────────────────────────────────────────
const st = {
  view:          'list',     // list | detail | exec | report | sign | done
  data:          getHoje(),       // data que está sendo visualizada
  visitas:       [],
  visitaSel:     null,       // objeto da visita atual
  relatorioSel:  null,       // relatório em andamento
  fotos:         [],         // fotos já salvas em fotos_relatorio
  pendingFotos:  [],         // fotos que falharam upload: [{ tempId, file, error, tentando }]
  sigPad:        null,       // { canvas, ctx, points, drawing }
};

// ── Persistência de estado de execução (resiliência a reload) ────
const STORAGE_KEY = 'vi-agenda-exec';

function persistirEstado() {
  // Só persiste quando o funcionário está no meio de uma visita
  const emExecucao = ['detail','exec','report','sign'].includes(st.view)
    && st.visitaSel?.id;
  if (!emExecucao) {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      view:        st.view,
      data:        st.data,
      visitaId:    st.visitaSel.id,
      relatorioId: st.relatorioSel?.id ?? null,
      ts:          Date.now(),
    }));
  } catch { /* ignore */ }
}

function limparEstadoPersistido() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

function lerEstadoPersistido() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Descarta estado com mais de 12 horas (evita restaurar visita de ontem)
    if (data.ts && Date.now() - data.ts > 12 * 3600 * 1000) {
      limparEstadoPersistido();
      return null;
    }
    return data;
  } catch { return null; }
}

// ── Helpers ───────────────────────────────────────────────────────
function fmtData(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00');
  return `${DIAS_LABEL[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
function fmtHora(h) {
  if (!h) return '—';
  return h.slice(0, 5);
}
function fmtDur(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${F(m)}`;
  if (h) return `${h}h`;
  return `${m} min`;
}
function elapsedFrom(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h${F(m)}m` : `${m}min`;
}
function statusLabel(s) {
  return ({
    publicado:   { txt: 'Aguardando',   cls: 'ag-badge--wait' },
    em_execucao: { txt: 'Em execução',  cls: 'ag-badge--exec' },
    concluido:   { txt: 'Concluída',    cls: 'ag-badge--done' },
    cancelado:   { txt: 'Cancelada',    cls: 'ag-badge--cancel' },
  })[s] || { txt: s, cls: '' };
}

async function captureGPS() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: null, lng: null });
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

// ── Data ──────────────────────────────────────────────────────────
async function loadVisitas() {
  const ses = AUTH.getSession();
  if (!ses?.employee_id) return [];

  const { data, error } = await supabase
    .from('agenda')
    .select(`
      id, data_agendada, hora_estimada_chegada, duracao_estimada_min,
      ordem_rota, status, publicado_em, observacoes_gestor,
      funcionario_id, cliente_id, cliente_servico_id,
      cliente:clientes(
        id, nome_empresa, endereco, complemento, bairro,
        lat, lng, contato_nome, contato_telefone,
        observacoes, grupo_servico, frequencia_visita
      ),
      contrato:cliente_servicos(id, tipo_servico, frequencia, quantidade_vasos)
    `)
    .eq('funcionario_id', String(ses.employee_id))
    .eq('data_agendada', st.data)
    .neq('status', 'rascunho')
    .order('ordem_rota', { ascending: true });

  if (error) { console.error(error); toast('Erro ao carregar agenda', false); return []; }
  return data ?? [];
}

async function loadRelatorio(agendaId) {
  const { data } = await supabase
    .from('relatorios')
    .select('*')
    .eq('agendamento_id', agendaId)
    .maybeSingle();
  return data;
}

async function loadFotos(relatorioId) {
  if (!relatorioId) return [];
  const { data } = await supabase
    .from('fotos_relatorio')
    .select('*')
    .eq('relatorio_id', relatorioId)
    .order('ordem', { ascending: true });
  return data ?? [];
}

// ── Render principal ──────────────────────────────────────────────
export async function renderAgenda() {
  const root = document.getElementById('sv-agenda');
  if (!root) return;

  const ses = AUTH.getSession();
  if (!ses || ses.role === 'gestor') {
    root.innerHTML = `<div class="ag-empty">Área do funcionário.</div>`;
    return;
  }

  // Tenta restaurar estado de execução se houver
  const persist = lerEstadoPersistido();
  if (persist && !st.visitaSel) {
    try {
      st.data = persist.data || st.data;
      st.visitas = await loadVisitas();
      const v = st.visitas.find(x => x.id === persist.visitaId);
      if (v && v.status !== 'concluido' && v.status !== 'cancelado') {
        st.visitaSel = v;
        if (persist.relatorioId) {
          st.relatorioSel = await loadRelatorio(v.id);
          st.fotos = st.relatorioSel ? await loadFotos(st.relatorioSel.id) : [];
        }
        st.view = persist.view;
        toast('Retomando visita em andamento...');
        renderCurrentView();
        if (st.view === 'exec') startTimer();
        return;
      } else {
        // Visita não encontrada ou já finalizada — descarta
        limparEstadoPersistido();
      }
    } catch (e) {
      console.warn('Não foi possível restaurar estado:', e);
      limparEstadoPersistido();
    }
  }

  st.visitas = await loadVisitas();
  renderCurrentView();
}

function renderCurrentView() {
  const root = document.getElementById('sv-agenda');
  if (!root) return;
  if (st.view === 'list')   root.innerHTML = viewList();
  if (st.view === 'detail') root.innerHTML = viewDetail();
  if (st.view === 'exec')   root.innerHTML = viewExec();
  if (st.view === 'report') { root.innerHTML = viewReport(); wireReportInputs(); }
  if (st.view === 'sign')   { root.innerHTML = viewSign(); wireSignature(); }
  if (st.view === 'done')   root.innerHTML = viewDone();
  persistirEstado();
}

// ── VIEW: Lista de visitas do dia ─────────────────────────────────
function viewList() {
  const d = new Date(st.data + 'T12:00');
  const dataLabel = `${DIAS_LABEL[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
  const isToday = st.data === getHoje();

  if (st.visitas.length === 0) {
    return `
      <div class="ag-header">
        <div>
          <div class="ag-title">Minha Agenda</div>
          <div class="ag-sub">${dataLabel}${isToday ? ' · Hoje' : ''}</div>
        </div>
        ${dateNavHTML()}
      </div>
      <div class="ag-empty">
        <i class="fa-solid fa-calendar-day"></i>
        <p>Nenhuma visita publicada para este dia.</p>
        <small>Se você espera visitas, aguarde o gestor publicar a agenda.</small>
      </div>
    `;
  }

  const total = st.visitas.length;
  const feitas = st.visitas.filter(v => v.status === 'concluido').length;

  return `
    <div class="ag-header">
      <div>
        <div class="ag-title">Minha Agenda</div>
        <div class="ag-sub">${dataLabel}${isToday ? ' · Hoje' : ''} · ${feitas}/${total} concluídas</div>
      </div>
      ${dateNavHTML()}
    </div>

    <div class="ag-list">
      ${st.visitas.map((v, i) => cardVisitaLista(v, i)).join('')}
    </div>
  `;
}

function dateNavHTML() {
  return `
    <div class="ag-datenav">
      <button class="ag-datebtn" onclick="agendaChangeDate(-1)"><i class="fa-solid fa-chevron-left"></i></button>
      <button class="ag-datebtn ag-datebtn--today" onclick="agendaGoToday()">Hoje</button>
      <button class="ag-datebtn" onclick="agendaChangeDate(1)"><i class="fa-solid fa-chevron-right"></i></button>
    </div>
  `;
}

function cardVisitaLista(v, idx) {
  const c = v.cliente;
  const s = statusLabel(v.status);
  const podeIniciar = v.status === 'publicado';
  const emExec = v.status === 'em_execucao';
  const feita = v.status === 'concluido';

  return `
    <div class="ag-card ag-card--${v.status}" onclick="agendaOpenDetail('${v.id}')">
      <div class="ag-card__ord">${v.ordem_rota ?? (idx + 1)}</div>
      <div class="ag-card__info">
        <div class="ag-card__nome">${c?.nome_empresa ?? '—'}</div>
        <div class="ag-card__end">
          ${c?.bairro ? `<i class="fa-solid fa-location-dot"></i> ${c.bairro}` : ''}
          ${c?.endereco ? ` · ${c.endereco}` : ''}
        </div>
        <div class="ag-card__meta">
          <span><i class="fa-regular fa-clock"></i> ${fmtHora(v.hora_estimada_chegada)}</span>
          <span>· ${fmtDur(v.duracao_estimada_min)}</span>
          ${c?.grupo_servico ? `<span>· ${c.grupo_servico}</span>` : ''}
        </div>
      </div>
      <div class="ag-card__acao">
        <span class="ag-badge ${s.cls}">${s.txt}</span>
        ${podeIniciar ? '<i class="fa-solid fa-play ag-card__ico"></i>' : ''}
        ${emExec     ? '<i class="fa-solid fa-hourglass-half ag-card__ico ag-card__ico--exec"></i>' : ''}
        ${feita      ? '<i class="fa-solid fa-check ag-card__ico ag-card__ico--done"></i>' : ''}
      </div>
    </div>
  `;
}

// ── VIEW: Detalhe da visita (antes/depois do check-in) ────────────
function viewDetail() {
  const v = st.visitaSel;
  if (!v) return viewList();
  const c = v.cliente;
  const s = statusLabel(v.status);

  const mapaUrl = c?.lat && c?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`
    : (c?.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.endereco)}` : null);

  return `
    <div class="ag-header ag-header--sub">
      <button class="ag-back" onclick="agendaBack()"><i class="fa-solid fa-arrow-left"></i></button>
      <div>
        <div class="ag-title">${c?.nome_empresa ?? '—'}</div>
        <div class="ag-sub">Visita ${v.ordem_rota ?? '—'} · <span class="ag-badge ${s.cls}">${s.txt}</span></div>
      </div>
    </div>

    <div class="ag-detail">
      <section class="ag-sec">
        <div class="ag-sec__title"><i class="fa-solid fa-location-dot"></i> Endereço</div>
        <div class="ag-sec__body">
          <div><strong>${c?.endereco ?? '—'}</strong></div>
          ${c?.complemento ? `<div class="ag-sec__hint">${c.complemento}</div>` : ''}
          ${c?.bairro ? `<div class="ag-sec__hint">${c.bairro}</div>` : ''}
          ${mapaUrl ? `<a class="ag-linkbtn" href="${mapaUrl}" target="_blank" rel="noopener"><i class="fa-solid fa-diamond-turn-right"></i> Abrir no mapa</a>` : ''}
        </div>
      </section>

      ${c?.contato_nome || c?.contato_telefone ? `
      <section class="ag-sec">
        <div class="ag-sec__title"><i class="fa-solid fa-user"></i> Contato</div>
        <div class="ag-sec__body">
          ${c.contato_nome ? `<div><strong>${c.contato_nome}</strong></div>` : ''}
          ${c.contato_telefone ? `<a class="ag-linkbtn" href="tel:${c.contato_telefone}"><i class="fa-solid fa-phone"></i> ${c.contato_telefone}</a>` : ''}
        </div>
      </section>` : ''}

      <section class="ag-sec">
        <div class="ag-sec__title"><i class="fa-regular fa-clock"></i> Horário previsto</div>
        <div class="ag-sec__body">
          <div><strong>${fmtHora(v.hora_estimada_chegada)}</strong> · duração ${fmtDur(v.duracao_estimada_min)}</div>
          ${c?.grupo_servico ? `<div class="ag-sec__hint">${c.grupo_servico}</div>` : ''}
        </div>
      </section>

      ${c?.observacoes ? `
      <section class="ag-sec ag-sec--warn">
        <div class="ag-sec__title"><i class="fa-solid fa-triangle-exclamation"></i> Instruções especiais</div>
        <div class="ag-sec__body">${c.observacoes}</div>
      </section>` : ''}

      ${v.observacoes_gestor ? `
      <section class="ag-sec ag-sec--gestor">
        <div class="ag-sec__title"><i class="fa-solid fa-comment"></i> Observação do gestor</div>
        <div class="ag-sec__body">${v.observacoes_gestor}</div>
      </section>` : ''}

      <div class="ag-actions">
        ${v.status === 'publicado' ? `
          <button class="ag-btn ag-btn--big" onclick="agendaCheckIn()">
            <i class="fa-solid fa-play"></i> Iniciar visita (check-in)
          </button>
          <small class="ag-hint">Ao iniciar, capturamos sua localização e o horário de chegada.</small>
        ` : ''}
        ${v.status === 'em_execucao' ? `
          <button class="ag-btn ag-btn--big" onclick="agendaGoTo('exec')">
            <i class="fa-solid fa-arrow-right"></i> Continuar execução
          </button>
        ` : ''}
        ${v.status === 'concluido' ? `
          <div class="ag-done-info"><i class="fa-solid fa-check"></i> Visita concluída</div>
        ` : ''}
      </div>
    </div>
  `;
}

// ── VIEW: Em execução (após check-in) ─────────────────────────────
function viewExec() {
  const v = st.visitaSel;
  const r = st.relatorioSel;
  if (!v || !r) return viewList();
  const c = v.cliente;

  const nFotos = st.fotos.length;
  const temRelato = !!(r.relato && r.relato.trim());

  return `
    <div class="ag-header ag-header--sub">
      <button class="ag-back" onclick="agendaBackToList()"><i class="fa-solid fa-arrow-left"></i></button>
      <div>
        <div class="ag-title">${c?.nome_empresa ?? '—'}</div>
        <div class="ag-sub"><span class="ag-badge ag-badge--exec">Em execução</span> · desde ${elapsedFrom(r.checkin_at)}</div>
      </div>
    </div>

    <div class="ag-exec">
      <div class="ag-exec__hero">
        <div class="ag-exec__timer" id="ag-timer">${elapsedFrom(r.checkin_at)}</div>
        <div class="ag-exec__hint">Tempo desde o check-in</div>
      </div>

      <div class="ag-exec__grid">
        <div class="ag-exec__stat">
          <div class="ag-exec__stat-lbl">Relato</div>
          <div class="ag-exec__stat-val ${temRelato ? 'ok' : 'wait'}">
            ${temRelato ? '<i class="fa-solid fa-check"></i> preenchido' : 'pendente'}
          </div>
        </div>
        <div class="ag-exec__stat">
          <div class="ag-exec__stat-lbl">Fotos</div>
          <div class="ag-exec__stat-val ${nFotos > 0 ? 'ok' : 'wait'}">
            ${nFotos > 0 ? `<i class="fa-solid fa-check"></i> ${nFotos} foto${nFotos > 1 ? 's' : ''}` : 'nenhuma'}
          </div>
        </div>
      </div>

      <div class="ag-actions ag-actions--grid">
        <button class="ag-btn ag-btn--sec" onclick="agendaGoTo('report')">
          <i class="fa-solid fa-file-pen"></i> Preencher relatório e fotos
        </button>
        <button class="ag-btn ag-btn--pri ${(!temRelato || nFotos === 0) ? 'ag-btn--warn' : ''}" onclick="agendaGoTo('sign')">
          <i class="fa-solid fa-signature"></i> Finalizar visita
        </button>
      </div>
      ${(!temRelato || nFotos === 0) ? `<small class="ag-hint ag-hint--warn"><i class="fa-solid fa-circle-info"></i> Recomendado preencher relato e pelo menos 1 foto antes de finalizar.</small>` : ''}
    </div>
  `;
}

// ── VIEW: Relatório (relato + observações + fotos) ────────────────
function viewReport() {
  const v = st.visitaSel;
  const r = st.relatorioSel;
  if (!v || !r) return viewList();

  return `
    <div class="ag-header ag-header--sub">
      <button class="ag-back" onclick="agendaGoTo('exec')"><i class="fa-solid fa-arrow-left"></i></button>
      <div>
        <div class="ag-title">Relatório</div>
        <div class="ag-sub">${v.cliente?.nome_empresa ?? '—'}</div>
      </div>
    </div>

    <div class="ag-form">
      <div class="ag-field">
        <label>Relato da tarefa executada</label>
        <textarea id="ag-relato" rows="4" placeholder="Descreva o que foi feito na visita...">${r.relato ?? ''}</textarea>
      </div>

      <div class="ag-field">
        <label>Observações gerais</label>
        <textarea id="ag-obs" rows="3" placeholder="Plantas que precisam de atenção, materiais consumidos, etc.">${r.observacoes ?? ''}</textarea>
      </div>

      <div class="ag-field">
        <label>Fotos (${st.fotos.length}${st.pendingFotos.length > 0 ? ` · <span class="ag-pend-count">${st.pendingFotos.length} pendente${st.pendingFotos.length > 1 ? 's' : ''}</span>` : ''})</label>
        <div class="ag-fotos">
          ${st.fotos.map(fotoCard).join('')}
          ${st.pendingFotos.map(pendingCard).join('')}
          <label class="ag-foto-add">
            <input type="file" accept="image/*" capture="environment"
                   onchange="agendaAddPhoto(this)" style="display:none">
            <i class="fa-solid fa-camera"></i>
            <span>Adicionar foto</span>
          </label>
        </div>
      </div>

      <div class="ag-actions">
        <button class="ag-btn ag-btn--pri" onclick="agendaSaveReport()">
          <i class="fa-solid fa-check"></i> Salvar e voltar
        </button>
      </div>
    </div>
  `;
}

function fotoCard(f) {
  return `
    <div class="ag-foto" data-id="${f.id}">
      <img src="${f.url}" alt="foto">
      <input class="ag-foto__obs" placeholder="Legenda (opcional)"
             value="${(f.observacao ?? '').replace(/"/g, '&quot;')}"
             onblur="agendaSaveFotoObs('${f.id}', this.value)">
      <button class="ag-foto__del" onclick="agendaRemoveFoto('${f.id}')">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;
}

function pendingCard(p) {
  // Preview local via URL.createObjectURL do file
  const previewUrl = p._previewUrl || (p._previewUrl = URL.createObjectURL(p.file));
  return `
    <div class="ag-foto ag-foto--pending" data-tid="${p.tempId}">
      <img src="${previewUrl}" alt="foto pendente">
      <div class="ag-foto__pending-msg">
        <i class="fa-solid fa-triangle-exclamation"></i>
        ${p.tentando ? 'Tentando...' : 'Não enviou'}
      </div>
      <div class="ag-foto__pending-acoes">
        <button class="ag-foto__retry" onclick="agendaRetryFoto('${p.tempId}')" ${p.tentando ? 'disabled' : ''}>
          <i class="fa-solid fa-rotate-right"></i> Reenviar
        </button>
        <button class="ag-foto__descarta" onclick="agendaDescartaPending('${p.tempId}')" title="Descartar">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  `;
}

function wireReportInputs() {
  // (nothing to auto-wire; salva-se explicitamente com o botão)
}

// ── VIEW: Assinatura + check-out ──────────────────────────────────
function viewSign() {
  const v = st.visitaSel;
  const r = st.relatorioSel;
  if (!v || !r) return viewList();

  return `
    <div class="ag-header ag-header--sub">
      <button class="ag-back" onclick="agendaGoTo('exec')"><i class="fa-solid fa-arrow-left"></i></button>
      <div>
        <div class="ag-title">Assinatura</div>
        <div class="ag-sub">${v.cliente?.nome_empresa ?? '—'}</div>
      </div>
    </div>

    <div class="ag-sign">
      <div class="ag-sign__msg">
        <i class="fa-solid fa-hand-point-right"></i>
        Peça ao responsável da empresa para assinar abaixo.
      </div>

      <div class="ag-field">
        <label>Nome do responsável</label>
        <input type="text" id="ag-sig-nome"
               value="${r.assinatura_responsavel_nome ?? v.cliente?.contato_nome ?? ''}"
               placeholder="Nome completo">
      </div>

      <div class="ag-field">
        <label>Assinatura</label>
        <div class="ag-sig-wrap">
          <canvas id="ag-sig-canvas" width="600" height="220"></canvas>
          <button class="ag-sig-clear" onclick="agendaSigClear()">
            <i class="fa-solid fa-eraser"></i> Limpar
          </button>
        </div>
      </div>

      <div class="ag-actions">
        <button class="ag-btn ag-btn--pri ag-btn--big" onclick="agendaSubmit()">
          <i class="fa-solid fa-flag-checkered"></i> Finalizar visita (check-out)
        </button>
        <small class="ag-hint">Ao finalizar, capturamos GPS + horário de saída e enviamos tudo ao gestor.</small>
      </div>
    </div>
  `;
}

function wireSignature() {
  const canvas = document.getElementById('ag-sig-canvas');
  if (!canvas) return;

  // Ajusta tamanho real do canvas para o CSS
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1a1a1a';

  const pad = { drawing: false, last: null };
  st.sigPad = { canvas, ctx, empty: true };

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }
  function start(e) { e.preventDefault(); pad.drawing = true; pad.last = pos(e); st.sigPad.empty = false; }
  function move(e) {
    if (!pad.drawing) return;
    e.preventDefault();
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(pad.last.x, pad.last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    pad.last = p;
  }
  function end() { pad.drawing = false; pad.last = null; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove',  move,  { passive: false });
  canvas.addEventListener('touchend',   end);
}

// ── VIEW: Concluído ───────────────────────────────────────────────
function viewDone() {
  return `
    <div class="ag-done">
      <div class="ag-done__ico"><i class="fa-solid fa-circle-check"></i></div>
      <div class="ag-done__title">Visita concluída!</div>
      <div class="ag-done__sub">Relatório enviado ao gestor.</div>
      <button class="ag-btn ag-btn--pri" onclick="agendaBackToList()">
        <i class="fa-solid fa-list"></i> Voltar para agenda
      </button>
    </div>
  `;
}

// ── Ações ─────────────────────────────────────────────────────────
export async function goTo(view) {
  st.view = view;
  renderCurrentView();
  if (view === 'exec') startTimer();
}

export function back() {
  if (st.view === 'detail') { st.view = 'list'; st.visitaSel = null; renderCurrentView(); return; }
  if (st.view === 'exec')   { st.view = 'detail'; renderCurrentView(); return; }
  st.view = 'list';
  renderCurrentView();
}

export async function backToList() {
  st.view = 'list';
  st.visitaSel = null;
  st.relatorioSel = null;
  st.fotos = [];
  limparEstadoPersistido();
  await renderAgenda();
}

export async function openDetail(visitaId) {
  const v = st.visitas.find(x => x.id === visitaId);
  if (!v) return;
  st.visitaSel = v;
  if (v.status === 'em_execucao' || v.status === 'concluido') {
    st.relatorioSel = await loadRelatorio(v.id);
    st.fotos = st.relatorioSel ? await loadFotos(st.relatorioSel.id) : [];
  }
  st.view = 'detail';
  renderCurrentView();
}

export function changeDate(delta) {
  const d = new Date(st.data + 'T12:00');
  d.setDate(d.getDate() + delta);
  st.data = `${d.getFullYear()}-${F(d.getMonth() + 1)}-${F(d.getDate())}`;
  renderAgenda();
}

export function goToday() { st.data = getHoje(); renderAgenda(); }

// ── Check-in ──────────────────────────────────────────────────────
export async function checkIn() {
  const v = st.visitaSel;
  if (!v) return;
  const ses = AUTH.getSession();

  toast('Capturando localização...');
  const gps = await captureGPS();
  const gpsFalhou = gps.lat == null || gps.lng == null;
  const now = new Date().toISOString();

  const { data: rel, error: err1 } = await supabase
    .from('relatorios')
    .insert({
      agendamento_id: v.id,
      funcionario_id: String(ses.employee_id),
      checkin_at:  now,
      checkin_lat: gps.lat,
      checkin_lng: gps.lng,
      status: 'em_andamento',
    })
    .select()
    .single();
  if (err1) { toast('Erro ao iniciar: ' + err1.message, false); return; }

  const { error: err2 } = await supabase
    .from('agenda')
    .update({ status: 'em_execucao' })
    .eq('id', v.id);
  if (err2) { toast('Erro ao atualizar visita: ' + err2.message, false); return; }

  v.status = 'em_execucao';
  st.relatorioSel = rel;
  st.fotos = [];
  toast(gpsFalhou
    ? '✓ Visita iniciada · ⚠ GPS não capturado'
    : '✓ Visita iniciada');
  st.view = 'exec';
  renderCurrentView();
  startTimer();
}

// ── Timer da execução ─────────────────────────────────────────────
let timerInterval = null;
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const el = document.getElementById('ag-timer');
    if (!el || !st.relatorioSel) return clearInterval(timerInterval);
    el.textContent = elapsedFrom(st.relatorioSel.checkin_at);
  }, 30000);
}

// ── Fotos ─────────────────────────────────────────────────────────
function preservarTextoRelatorio() {
  const rel = document.getElementById('ag-relato')?.value ?? null;
  const obs = document.getElementById('ag-obs')?.value ?? null;
  if (rel === null && obs === null) return;
  const r = st.relatorioSel;
  if (r) st.relatorioSel = { ...r, relato: rel ?? r.relato, observacoes: obs ?? r.observacoes };
}

// Tenta subir uma foto para o Storage + criar registro em fotos_relatorio
// Retorna: { ok: bool, rec?: obj, error?: string }
async function tentarUploadFoto(file, relatorioId) {
  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${relatorioId}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('field-photos')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) return { ok: false, error: 'Falha no upload: ' + upErr.message };

    const { data: signed } = await supabase.storage
      .from('field-photos')
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    const { data: rec, error: recErr } = await supabase
      .from('fotos_relatorio')
      .insert({
        relatorio_id: relatorioId,
        url:          signed?.signedUrl ?? path,
        storage_path: path,
        observacao:   null,
        tipo:         'geral',
        ordem:        st.fotos.length + 1,
      })
      .select()
      .single();
    if (recErr) return { ok: false, error: 'Falha ao salvar registro: ' + recErr.message };

    return { ok: true, rec };
  } catch (e) {
    return { ok: false, error: e?.message || 'Erro desconhecido' };
  }
}

export async function addPhoto(input) {
  const file = input.files?.[0];
  if (!file) return;
  const r = st.relatorioSel;
  if (!r) { toast('Erro: sem relatório ativo', false); return; }

  preservarTextoRelatorio();
  input.value = '';

  const tempId = 'tmp_' + Date.now();
  toast('Enviando foto...');
  const res = await tentarUploadFoto(file, r.id);
  if (res.ok) {
    st.fotos.push(res.rec);
    toast('✓ Foto adicionada');
  } else {
    st.pendingFotos.push({ tempId, file, error: res.error, tentando: false });
    toast('⚠ Foto não enviada — toque em Reenviar', false);
  }
  renderCurrentView();
}

export async function retryFoto(tempId) {
  const idx = st.pendingFotos.findIndex(p => p.tempId === tempId);
  if (idx < 0) return;
  const p = st.pendingFotos[idx];
  const r = st.relatorioSel;
  if (!r) return;

  preservarTextoRelatorio();
  p.tentando = true;
  renderCurrentView();

  const res = await tentarUploadFoto(p.file, r.id);
  if (res.ok) {
    st.fotos.push(res.rec);
    st.pendingFotos.splice(idx, 1);
    toast('✓ Foto enviada');
  } else {
    p.tentando = false;
    p.error = res.error;
    toast('Ainda falhou. Tenta novamente daqui a pouco.', false);
  }
  renderCurrentView();
}

export function descartarPending(tempId) {
  const idx = st.pendingFotos.findIndex(p => p.tempId === tempId);
  if (idx >= 0) {
    st.pendingFotos.splice(idx, 1);
    renderCurrentView();
  }
}

export async function removePhoto(fotoId) {
  const foto = st.fotos.find(f => f.id === fotoId);
  if (!foto) return;
  if (!confirm('Remover esta foto?')) return;
  preservarTextoRelatorio();
  if (foto.storage_path) {
    await supabase.storage.from('field-photos').remove([foto.storage_path]);
  }
  await supabase.from('fotos_relatorio').delete().eq('id', fotoId);
  st.fotos = st.fotos.filter(f => f.id !== fotoId);
  renderCurrentView();
}

export async function saveFotoObs(fotoId, texto) {
  await supabase.from('fotos_relatorio').update({ observacao: texto || null }).eq('id', fotoId);
  const foto = st.fotos.find(f => f.id === fotoId);
  if (foto) foto.observacao = texto || null;
}

// ── Salvar relato + observações ───────────────────────────────────
export async function saveReport() {
  const relato = document.getElementById('ag-relato')?.value?.trim() ?? '';
  const obs    = document.getElementById('ag-obs')?.value?.trim() ?? '';
  const r = st.relatorioSel;
  if (!r) return;

  const { error } = await supabase
    .from('relatorios')
    .update({ relato: relato || null, observacoes: obs || null })
    .eq('id', r.id);
  if (error) { toast('Erro ao salvar: ' + error.message, false); return; }

  st.relatorioSel = { ...r, relato: relato || null, observacoes: obs || null };
  toast('✓ Relatório salvo');
  st.view = 'exec';
  renderCurrentView();
  startTimer();
}

// ── Assinatura ────────────────────────────────────────────────────
export function sigClear() {
  if (!st.sigPad) return;
  const { canvas, ctx } = st.sigPad;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  st.sigPad.empty = true;
}

async function uploadSignature(canvas, relatorioId) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('Falha ao gerar imagem'));
      const path = `${relatorioId}/assinatura.png`;
      const { error } = await supabase.storage
        .from('field-photos')
        .upload(path, blob, { contentType: 'image/png', upsert: true });
      if (error) return reject(error);
      const { data: signed } = await supabase.storage
        .from('field-photos')
        .createSignedUrl(path, 60 * 60 * 24 * 30);
      resolve({ url: signed?.signedUrl ?? path, path });
    }, 'image/png');
  });
}

// ── Check-out + submit ────────────────────────────────────────────
export async function submit() {
  const v = st.visitaSel;
  const r = st.relatorioSel;
  if (!v || !r) return;

  const nome = document.getElementById('ag-sig-nome')?.value?.trim() ?? '';
  if (!nome) { toast('Preencha o nome do responsável', false); return; }
  if (!st.sigPad || st.sigPad.empty) { toast('Faça a assinatura antes de finalizar', false); return; }
  if (st.pendingFotos.length > 0) {
    const ok = confirm(`Ainda existem ${st.pendingFotos.length} foto(s) que não foram enviadas. Finalizar mesmo assim? Elas serão perdidas.`);
    if (!ok) return;
  }

  toast('Enviando assinatura...');
  let sigUrl = null;
  let sigPath = null;
  try {
    const res = await uploadSignature(st.sigPad.canvas, r.id);
    sigUrl = res.url;
    sigPath = res.path;
  } catch (e) {
    toast('Erro no upload da assinatura: ' + e.message, false);
    return;
  }

  toast('Capturando localização...');
  const gps = await captureGPS();
  const now = new Date().toISOString();

  const { error: err1 } = await supabase
    .from('relatorios')
    .update({
      checkout_at:  now,
      checkout_lat: gps.lat,
      checkout_lng: gps.lng,
      assinatura_responsavel_nome: nome,
      assinatura_responsavel_img:  sigUrl,
      assinatura_storage_path:     sigPath,
      status: 'concluido',
    })
    .eq('id', r.id);
  if (err1) { toast('Erro ao salvar: ' + err1.message, false); return; }

  const { error: err2 } = await supabase
    .from('agenda')
    .update({ status: 'concluido' })
    .eq('id', v.id);
  if (err2) { toast('Erro ao concluir: ' + err2.message, false); return; }

  const { error: err3 } = await supabase
    .from('clientes')
    .update({ ultima_visita: st.data })
    .eq('id', v.cliente_id);
  if (err3) console.warn('ultima_visita não atualizada:', err3.message);

  clearInterval(timerInterval);
  limparEstadoPersistido();
  const pendentes = st.pendingFotos.length;
  toast(pendentes > 0
    ? `✓ Concluída · ⚠ ${pendentes} foto${pendentes > 1 ? 's' : ''} não subiu`
    : '✓ Visita concluída');
  st.view = 'done';
  renderCurrentView();
}
