// src/agenda.js — Sistema de Campo: Minha Agenda (funcionário)
import { supabase } from './supabase.js';
import { AUTH } from './auth.js';
import { toast, F, getHoje } from './utils.js';

const DIAS_LABEL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

// Marcador que separa observações do usuário da parte gerada a partir de legendas
// (tudo depois do marcador é auto-regenerado quando fotos mudam)
const RELATO_MARKER = '\n\n— Fotos —\n';

// ── Estado local ──────────────────────────────────────────────────
const st = {
  view:          'list',     // list | detail | exec | photos | report | sign | review | done
  data:          getHoje(),
  visitas:       [],
  visitaSel:     null,
  relatorioSel:  null,
  fotos:         [],
  pendingFotos:  [],         // [{ tempId, relatorioId, file, error, tentando }]
  sigPad:        null,
};

// ── Persistência de estado de execução (resiliência a reload) ────
const STORAGE_KEY = 'vi-agenda-exec';
const PENDING_KEY = 'vi-agenda-pending-fotos';

function persistirEstado() {
  const emExecucao = ['detail','exec','photos','report','sign','review'].includes(st.view)
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
    if (data.ts && Date.now() - data.ts > 12 * 3600 * 1000) {
      limparEstadoPersistido();
      return null;
    }
    return data;
  } catch { return null; }
}

// ── Persistência de fila de fotos pendentes (sobrevive a reload) ──
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('FileReader falhou'));
    r.readAsDataURL(file);
  });
}

function base64ToFile(dataUrl, name, type) {
  try {
    const arr = dataUrl.split(',');
    const bstr = atob(arr[1]);
    const u8 = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    return new File([u8], name, { type: type || 'image/jpeg' });
  } catch { return null; }
}

async function persistPending() {
  try {
    // Só persiste até 20 fotos (limite conservador do localStorage ~5MB)
    const items = await Promise.all(st.pendingFotos.slice(0, 20).map(async p => ({
      tempId: p.tempId,
      relatorioId: p.relatorioId,
      fileName: p.file?.name || 'foto.jpg',
      fileType: p.file?.type || 'image/jpeg',
      fileB64: p.fileB64 || (p.file ? await fileToBase64(p.file) : null),
      error: p.error,
    })));
    localStorage.setItem(PENDING_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Falha ao persistir fila pendente:', e);
  }
}

function loadPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    return items.map(item => {
      const file = item.fileB64 ? base64ToFile(item.fileB64, item.fileName, item.fileType) : null;
      return file ? {
        tempId: item.tempId,
        relatorioId: item.relatorioId,
        file,
        fileB64: item.fileB64,
        error: item.error,
        tentando: false,
      } : null;
    }).filter(Boolean);
  } catch { return []; }
}

function limparPending() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}

// ── Compressão de imagem (client-side, sem lib) ───────────────────
// WebP 1024px quality 0.75 → ~40-80KB por foto (vs ~300-500KB do JPEG 1600px original)
// Ainda mantém detalhes suficientes para avaliar saúde da planta (folhas, cor, pragas).
// Fallback JPEG 0.75 se browser não suportar WebP canvas.
async function comprimirImagem(file, maxDim = 1024, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else                { width  = Math.round(width  * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        // Tenta WebP primeiro
        canvas.toBlob(blob => {
          if (blob && blob.type === 'image/webp') {
            const nome = (file.name || 'foto').replace(/\.[^.]+$/, '') + '.webp';
            return resolve(new File([blob], nome, { type: 'image/webp' }));
          }
          // Fallback: WebP não suportado → JPEG
          canvas.toBlob(jpegBlob => {
            if (!jpegBlob) return reject(new Error('toBlob retornou null'));
            const nome = (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
            resolve(new File([jpegBlob], nome, { type: 'image/jpeg' }));
          }, 'image/jpeg', quality);
        }, 'image/webp', quality);
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('Falha ao ler imagem'));
    img.src = URL.createObjectURL(file);
  });
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
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
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
  if (!ses || !ses.employee_id) {
    root.innerHTML = `<div class="ag-empty">Sua conta não está vinculada a um funcionário — sem agenda para exibir.</div>`;
    return;
  }

  // Restaura estado de execução se houver
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

        // Restaura fila de fotos pendentes que sobrou de uma sessão anterior
        const pend = loadPending();
        if (pend.length && st.relatorioSel) {
          st.pendingFotos = pend.filter(p => p.relatorioId === st.relatorioSel.id);
          if (st.pendingFotos.length) setTimeout(() => processarFilaUpload(), 500);
        }

        toast('Retomando visita em andamento...');
        renderCurrentView();
        if (st.view === 'exec') startTimer();
        return;
      } else {
        limparEstadoPersistido();
        limparPending();
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
  if (st.view === 'list')    root.innerHTML = viewList();
  if (st.view === 'detail')  root.innerHTML = viewDetail();
  if (st.view === 'exec')    root.innerHTML = viewExec();
  if (st.view === 'photos')  root.innerHTML = viewPhotos();
  if (st.view === 'report')  { root.innerHTML = viewReport(); wireReportInputs(); }
  if (st.view === 'sign')    { root.innerHTML = viewSign(); wireSignature(); }
  if (st.view === 'review')  root.innerHTML = viewReview();
  if (st.view === 'done')    root.innerHTML = viewDone();
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
        <div class="ag-card__nome">${esc(c?.nome_empresa) || '—'}</div>
        <div class="ag-card__end">
          ${c?.bairro ? `<i class="fa-solid fa-location-dot"></i> ${esc(c.bairro)}` : ''}
          ${c?.endereco ? ` · ${esc(c.endereco)}` : ''}
        </div>
        <div class="ag-card__meta">
          <span><i class="fa-regular fa-clock"></i> ${fmtHora(v.hora_estimada_chegada)}</span>
          <span>· ${fmtDur(v.duracao_estimada_min)}</span>
          ${c?.grupo_servico ? `<span>· ${esc(c.grupo_servico)}</span>` : ''}
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
        <div class="ag-title">${esc(c?.nome_empresa) || '—'}</div>
        <div class="ag-sub">Visita ${v.ordem_rota ?? '—'} · <span class="ag-badge ${s.cls}">${s.txt}</span></div>
      </div>
    </div>

    <div class="ag-detail">
      <section class="ag-sec">
        <div class="ag-sec__title"><i class="fa-solid fa-location-dot"></i> Endereço</div>
        <div class="ag-sec__body">
          <div><strong>${esc(c?.endereco) || '—'}</strong></div>
          ${c?.complemento ? `<div class="ag-sec__hint">${esc(c.complemento)}</div>` : ''}
          ${c?.bairro ? `<div class="ag-sec__hint">${esc(c.bairro)}</div>` : ''}
          ${mapaUrl ? `<a class="ag-linkbtn" href="${mapaUrl}" target="_blank" rel="noopener"><i class="fa-solid fa-diamond-turn-right"></i> Abrir no mapa</a>` : ''}
        </div>
      </section>

      ${c?.contato_nome || c?.contato_telefone ? `
      <section class="ag-sec">
        <div class="ag-sec__title"><i class="fa-solid fa-user"></i> Contato</div>
        <div class="ag-sec__body">
          ${c.contato_nome ? `<div><strong>${esc(c.contato_nome)}</strong></div>` : ''}
          ${c.contato_telefone ? `<a class="ag-linkbtn" href="tel:${esc(c.contato_telefone)}"><i class="fa-solid fa-phone"></i> ${esc(c.contato_telefone)}</a>` : ''}
        </div>
      </section>` : ''}

      <section class="ag-sec">
        <div class="ag-sec__title"><i class="fa-regular fa-clock"></i> Horário previsto</div>
        <div class="ag-sec__body">
          <div><strong>${fmtHora(v.hora_estimada_chegada)}</strong> · duração ${fmtDur(v.duracao_estimada_min)}</div>
          ${c?.grupo_servico ? `<div class="ag-sec__hint">${esc(c.grupo_servico)}</div>` : ''}
        </div>
      </section>

      ${c?.observacoes ? `
      <section class="ag-sec ag-sec--warn">
        <div class="ag-sec__title"><i class="fa-solid fa-triangle-exclamation"></i> Instruções especiais</div>
        <div class="ag-sec__body">${esc(c.observacoes)}</div>
      </section>` : ''}

      ${v.observacoes_gestor ? `
      <section class="ag-sec ag-sec--gestor">
        <div class="ag-sec__title"><i class="fa-solid fa-comment"></i> Observação do gestor</div>
        <div class="ag-sec__body">${esc(v.observacoes_gestor)}</div>
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

// ── VIEW: MENU DE EXECUÇÃO (após check-in) — estilo Auvo ─────────
function viewExec() {
  const v = st.visitaSel;
  const r = st.relatorioSel;
  if (!v || !r) return viewList();

  const nFotos    = st.fotos.length;
  const nPend     = st.pendingFotos.length;
  // Considera relato "preenchido" se há texto no relato OU legendas nas fotos (que vão pra obs)
  const temRelato = (r.relato || '').trim().length > 0 || st.fotos.some(f => (f.observacao || '').trim());
  const temAssin  = !!r.assinatura_responsavel_img;

  return `
    <div class="ag-header ag-header--sub">
      <button class="ag-back" onclick="agendaBackToList()"><i class="fa-solid fa-arrow-left"></i></button>
      <div>
        <div class="ag-title">${esc(v.cliente?.nome_empresa) || '—'}</div>
        <div class="ag-sub"><span class="ag-badge ag-badge--exec">Em execução</span> · desde ${elapsedFrom(r.checkin_at)}</div>
      </div>
    </div>

    <div class="ag-menu">
      <div class="ag-exec__hero ag-exec__hero--compact">
        <div class="ag-exec__timer" id="ag-timer">${elapsedFrom(r.checkin_at)}</div>
        <div class="ag-exec__hint">Tempo de visita</div>
      </div>

      ${nPend > 0 ? `<div class="ag-menu-alert"><i class="fa-solid fa-cloud-arrow-up"></i> ${nPend} foto${nPend>1?'s':''} enviando em segundo plano — não feche o app</div>` : ''}

      <button class="ag-menu-item" onclick="agendaGoTo('photos')">
        <div class="ag-menu-item__ico"><i class="fa-solid fa-camera"></i></div>
        <div class="ag-menu-item__body">
          <div class="ag-menu-item__title">Fotos</div>
          <div class="ag-menu-item__meta">${nFotos > 0 ? `${nFotos} foto${nFotos>1?'s':''} salva${nFotos>1?'s':''}${nPend>0 ? ` · ${nPend} enviando` : ''}` : (nPend>0 ? `${nPend} enviando…` : 'Nenhuma foto ainda')}</div>
        </div>
        ${nFotos > 0 ? '<i class="fa-solid fa-circle-check ag-menu-item__ok"></i>' : ''}
        <i class="fa-solid fa-chevron-right ag-menu-item__arrow"></i>
      </button>

      <button class="ag-menu-item" onclick="agendaGoTo('report')">
        <div class="ag-menu-item__ico"><i class="fa-solid fa-file-pen"></i></div>
        <div class="ag-menu-item__body">
          <div class="ag-menu-item__title">Relato da tarefa</div>
          <div class="ag-menu-item__meta">${temRelato ? 'Preenchido' : 'Ainda não escrito'}</div>
        </div>
        ${temRelato ? '<i class="fa-solid fa-circle-check ag-menu-item__ok"></i>' : ''}
        <i class="fa-solid fa-chevron-right ag-menu-item__arrow"></i>
      </button>

      <button class="ag-menu-item" onclick="agendaGoTo('sign')">
        <div class="ag-menu-item__ico"><i class="fa-solid fa-signature"></i></div>
        <div class="ag-menu-item__body">
          <div class="ag-menu-item__title">Assinatura</div>
          <div class="ag-menu-item__meta">${temAssin ? `${esc(r.assinatura_responsavel_nome || 'Coletada')}` : 'Ainda não assinado'}</div>
        </div>
        ${temAssin ? '<i class="fa-solid fa-circle-check ag-menu-item__ok"></i>' : ''}
        <i class="fa-solid fa-chevron-right ag-menu-item__arrow"></i>
      </button>

      <button class="ag-menu-item ag-menu-item--acao" onclick="agendaGoTo('review')">
        <div class="ag-menu-item__ico"><i class="fa-solid fa-eye"></i></div>
        <div class="ag-menu-item__body">
          <div class="ag-menu-item__title">Revisar e finalizar</div>
          <div class="ag-menu-item__meta">Confira tudo antes do check-out</div>
        </div>
        <i class="fa-solid fa-chevron-right ag-menu-item__arrow"></i>
      </button>
    </div>
  `;
}

// ── VIEW: Fotos (dedicada) ────────────────────────────────────────
function viewPhotos() {
  const v = st.visitaSel;
  if (!v) return viewList();

  return `
    <div class="ag-header ag-header--sub">
      <button class="ag-back" onclick="agendaGoTo('exec')"><i class="fa-solid fa-arrow-left"></i></button>
      <div>
        <div class="ag-title">Fotos</div>
        <div class="ag-sub">${esc(v.cliente?.nome_empresa) || '—'}</div>
      </div>
    </div>

    <div class="ag-photos">
      <div class="ag-photos__actions">
        <label class="ag-btn ag-btn--pri">
          <input type="file" accept="image/*" capture="environment"
                 onchange="agendaAddPhoto(this)" style="display:none">
          <i class="fa-solid fa-camera"></i> Câmera
        </label>
        <label class="ag-btn ag-btn--sec">
          <input type="file" accept="image/*" multiple
                 onchange="agendaAddPhoto(this)" style="display:none">
          <i class="fa-solid fa-images"></i> Galeria
        </label>
      </div>

      ${st.pendingFotos.length > 0 ? `<div class="ag-menu-alert"><i class="fa-solid fa-cloud-arrow-up"></i> ${st.pendingFotos.length} enviando em segundo plano</div>` : ''}

      <div class="ag-photos__list">
        ${st.fotos.map((f, i) => photoItem(f, i)).join('')}
        ${st.pendingFotos.map(p => photoPending(p)).join('')}
      </div>

      ${st.fotos.length === 0 && st.pendingFotos.length === 0
        ? '<div class="ag-photos__empty">Nenhuma foto ainda. Toque em <strong>Câmera</strong> ou <strong>Galeria</strong> para adicionar.</div>'
        : ''}
      <small class="ag-hint">Legendas escritas aqui aparecem automaticamente nas observações.</small>
    </div>
  `;
}

function photoItem(f, i) {
  return `
    <div class="ag-photo-item" data-id="${f.id}">
      <img src="${f.url}" alt="foto ${i+1}">
      <div class="ag-photo-item__body">
        <input class="ag-photo-item__obs" placeholder="Legenda (aparece nas observações)"
               value="${esc(f.observacao)}"
               onblur="agendaSaveFotoObs('${f.id}', this.value)">
        <div class="ag-photo-item__acoes">
          <button class="ag-photo-item__acao" onclick="agendaRemoveFoto('${f.id}')">
            <i class="fa-solid fa-trash-can"></i> Excluir
          </button>
        </div>
      </div>
    </div>
  `;
}

function photoPending(p) {
  const previewUrl = p._previewUrl || (p._previewUrl = URL.createObjectURL(p.file));
  return `
    <div class="ag-photo-item ag-photo-item--pending" data-tid="${p.tempId}">
      <img src="${previewUrl}" alt="foto pendente">
      <div class="ag-photo-item__body">
        <div class="ag-photo-item__msg">
          <i class="fa-solid ${p.tentando ? 'fa-cloud-arrow-up' : 'fa-triangle-exclamation'}"></i>
          ${p.tentando ? 'Enviando...' : 'Ainda não enviou'}
        </div>
        <div class="ag-photo-item__acoes">
          <button class="ag-photo-item__acao" onclick="agendaRetryFoto('${p.tempId}')" ${p.tentando ? 'disabled' : ''}>
            <i class="fa-solid fa-rotate-right"></i> Reenviar
          </button>
          <button class="ag-photo-item__acao ag-photo-item__acao--danger" onclick="agendaDescartaPending('${p.tempId}')">
            <i class="fa-solid fa-xmark"></i> Descartar
          </button>
        </div>
      </div>
    </div>
  `;
}

// ── VIEW: Relatório (só o texto — fotos migraram para viewPhotos) ─
function viewReport() {
  const v = st.visitaSel;
  const r = st.relatorioSel;
  if (!v || !r) return viewList();

  // Migração lazy: relatos antigos podem ter o marker de fotos misturado —
  // agora as legendas vão só pra observações. Remove tudo depois do marker.
  const relatoLimpo = (r.relato || '').split(RELATO_MARKER)[0].trim();

  return `
    <div class="ag-header ag-header--sub">
      <button class="ag-back" onclick="agendaGoTo('exec')"><i class="fa-solid fa-arrow-left"></i></button>
      <div>
        <div class="ag-title">Relato da tarefa</div>
        <div class="ag-sub">${esc(v.cliente?.nome_empresa) || '—'}</div>
      </div>
    </div>

    <div class="ag-form">
      <div class="ag-field">
        <label>O que foi feito na visita</label>
        <textarea id="ag-relato" rows="6" placeholder="Descreva o que foi executado...">${esc(relatoLimpo)}</textarea>
      </div>

      <div class="ag-field">
        <label>Observações gerais</label>
        <textarea id="ag-obs" rows="4" placeholder="Plantas que precisam atenção, materiais consumidos, etc.">${esc(r.observacoes)}</textarea>
        <small class="ag-hint">Legendas das fotos aparecem automaticamente abaixo depois do marcador <em>— Fotos —</em>.</small>
      </div>

      <div class="ag-actions">
        <button class="ag-btn ag-btn--pri ag-btn--big" onclick="agendaSaveReport()">
          <i class="fa-solid fa-floppy-disk"></i> Salvar e voltar
        </button>
      </div>
      <small class="ag-hint">O texto é salvo automaticamente enquanto você digita.</small>
    </div>
  `;
}

function wireReportInputs() {
  const relato = document.getElementById('ag-relato');
  const obs = document.getElementById('ag-obs');
  if (!relato || !obs) return;
  let timer;
  function agendarSave() {
    clearTimeout(timer);
    timer = setTimeout(() => saveRelatoObs(true), 1200);
  }
  relato.addEventListener('input', agendarSave);
  obs.addEventListener('input', agendarSave);
}

// ── VIEW: Assinatura (fullscreen) ────────────────────────────────
function viewSign() {
  const v = st.visitaSel;
  const r = st.relatorioSel;
  if (!v || !r) return viewList();

  const nomeDefault = r.assinatura_responsavel_nome || v.cliente?.contato_nome || '';

  return `
    <div class="ag-sign-full">
      <button class="ag-sign-full__close" onclick="agendaGoTo('exec')" aria-label="Fechar">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <button class="ag-sign-full__clear" onclick="agendaSigClear()">Limpar</button>

      <div class="ag-sign-full__canvas-wrap">
        <canvas id="ag-sig-canvas"></canvas>
      </div>

      <div class="ag-sign-full__footer">
        <div class="ag-sign-full__label">Assinatura</div>
        <button class="ag-sign-full__save" onclick="agendaConfirmSign()">Salvar</button>
      </div>

      <input type="hidden" id="ag-sig-nome" value="${esc(nomeDefault)}">
    </div>
  `;
}

// Configura o canvas de assinatura corretamente para tocar exatamente onde o dedo está
function wireSignature() {
  const canvas = document.getElementById('ag-sig-canvas');
  if (!canvas) return;

  // Espera o layout terminar antes de medir (fix crítico para o offset de toque)
  requestAnimationFrame(() => setupCanvasEDrawing(canvas));

  // Re-setup + preserva desenho quando gira o dispositivo
  function onResize() {
    if (!document.getElementById('ag-sig-canvas')) return;
    setupCanvasEDrawing(canvas, /*preservar=*/true);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

function setupCanvasEDrawing(canvas, preservar = false) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    // ainda sem layout — tenta novamente
    return requestAnimationFrame(() => setupCanvasEDrawing(canvas, preservar));
  }

  // Preserva desenho anterior via dataURL antes de resetar o canvas
  let dataAnterior = null;
  if (preservar && st.sigPad && !st.sigPad.empty) {
    try { dataAnterior = canvas.toDataURL('image/png'); } catch { /* ignore */ }
  }

  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#1a1a1a';

  st.sigPad = st.sigPad || { canvas, ctx, empty: true };
  st.sigPad.canvas = canvas;
  st.sigPad.ctx = ctx;

  if (dataAnterior) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
    img.src = dataAnterior;
  }

  // Handlers só na primeira vez
  if (canvas._wired) return;
  canvas._wired = true;

  const pad = { drawing: false, last: null };

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    // ctx já foi escalado por DPR, então coordenadas em CSS pixels bastam
    return {
      x: t.clientX - r.left,
      y: t.clientY - r.top,
    };
  }
  function start(e) {
    if (e.cancelable) e.preventDefault();
    pad.drawing = true;
    pad.last = pos(e);
    st.sigPad.empty = false;
  }
  function move(e) {
    if (!pad.drawing) return;
    if (e.cancelable) e.preventDefault();
    const p = pos(e);
    const c = st.sigPad.ctx;
    c.beginPath();
    c.moveTo(pad.last.x, pad.last.y);
    c.lineTo(p.x, p.y);
    c.stroke();
    pad.last = p;
  }
  function end() { pad.drawing = false; pad.last = null; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove',  move,  { passive: false });
  canvas.addEventListener('touchend',   end);
  canvas.addEventListener('touchcancel', end);
}

// ── VIEW: Revisar tudo antes do checkout ─────────────────────────
function viewReview() {
  const v = st.visitaSel;
  const r = st.relatorioSel;
  if (!v || !r) return viewList();

  const nFotos = st.fotos.length;
  const nPend  = st.pendingFotos.length;
  const temRelato = (r.relato || '').trim().length > 0 || st.fotos.some(f => (f.observacao || '').trim());
  const temAssin  = !!r.assinatura_responsavel_img;
  const podeFinalizar = temRelato && temAssin && nPend === 0;

  return `
    <div class="ag-header ag-header--sub">
      <button class="ag-back" onclick="agendaGoTo('exec')"><i class="fa-solid fa-arrow-left"></i></button>
      <div>
        <div class="ag-title">Revisar e finalizar</div>
        <div class="ag-sub">${esc(v.cliente?.nome_empresa) || '—'}</div>
      </div>
    </div>

    <div class="ag-review">
      <section class="ag-review__sec" onclick="agendaGoTo('photos')">
        <div class="ag-review__hd">
          <span><i class="fa-solid fa-camera"></i> Fotos <span class="ag-review__count">${nFotos}</span></span>
          <i class="fa-solid fa-pen ag-review__edit"></i>
        </div>
        ${nFotos === 0
          ? '<div class="ag-review__empty">Nenhuma foto adicionada.</div>'
          : `<div class="ag-review__grid">${st.fotos.map(f => `
              <div class="ag-review__thumb">
                <img src="${f.url}" alt="foto">
                ${f.observacao ? `<div class="ag-review__thumb-obs">${esc(f.observacao)}</div>` : ''}
              </div>`).join('')}</div>`}
        ${nPend > 0 ? `<div class="ag-menu-alert"><i class="fa-solid fa-cloud-arrow-up"></i> ${nPend} foto${nPend>1?'s':''} ainda enviando — aguarde antes de finalizar</div>` : ''}
      </section>

      <section class="ag-review__sec" onclick="agendaGoTo('report')">
        <div class="ag-review__hd">
          <span><i class="fa-solid fa-file-pen"></i> Relato ${temRelato ? '<i class="fa-solid fa-circle-check ag-review__ok"></i>' : '<i class="fa-solid fa-triangle-exclamation ag-review__warn"></i>'}</span>
          <i class="fa-solid fa-pen ag-review__edit"></i>
        </div>
        ${temRelato
          ? `<div class="ag-review__texto">${esc(r.relato).replace(/\n/g, '<br>')}</div>`
          : '<div class="ag-review__empty">Nenhum relato escrito.</div>'}
        ${r.observacoes ? `<div class="ag-review__texto ag-review__texto--obs"><strong>Obs:</strong> ${esc(r.observacoes).replace(/\n/g, '<br>')}</div>` : ''}
      </section>

      <section class="ag-review__sec" onclick="agendaGoTo('sign')">
        <div class="ag-review__hd">
          <span><i class="fa-solid fa-signature"></i> Assinatura ${temAssin ? '<i class="fa-solid fa-circle-check ag-review__ok"></i>' : '<i class="fa-solid fa-triangle-exclamation ag-review__warn"></i>'}</span>
          <i class="fa-solid fa-pen ag-review__edit"></i>
        </div>
        ${temAssin
          ? `<div class="ag-review__sig">
               <img src="${r.assinatura_responsavel_img}" alt="assinatura">
               <div class="ag-review__sig-nome">${esc(r.assinatura_responsavel_nome)}</div>
             </div>`
          : '<div class="ag-review__empty">Ainda não assinado.</div>'}
      </section>

      <div class="ag-actions">
        <button class="ag-btn ag-btn--pri ag-btn--big" onclick="agendaSubmit()" ${podeFinalizar ? '' : 'disabled'}>
          <i class="fa-solid fa-flag-checkered"></i> Finalizar e fazer check-out
        </button>
        ${!podeFinalizar
          ? `<small class="ag-hint ag-hint--warn">${nPend > 0 ? `Aguarde ${nPend} foto${nPend>1?'s':''} terminar de enviar.` : 'Complete relato e assinatura antes de finalizar.'}</small>`
          : '<small class="ag-hint">GPS e horário de saída serão capturados agora.</small>'}
      </div>
    </div>
  `;
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
  // Autosalva relato/obs ao sair da tela de relato
  if (st.view === 'report' && view !== 'report') {
    await saveRelatoObs(true);
  }
  st.view = view;
  renderCurrentView();
  if (view === 'exec') startTimer();
}

export function back() {
  if (st.view === 'detail') { st.view = 'list'; st.visitaSel = null; renderCurrentView(); return; }
  if (['exec','photos','report','sign','review'].includes(st.view)) { st.view = 'detail'; renderCurrentView(); return; }
  st.view = 'list';
  renderCurrentView();
}

export async function backToList() {
  st.view = 'list';
  st.visitaSel = null;
  st.relatorioSel = null;
  st.fotos = [];
  // Não limpa pendingFotos — se voltou pra lista com uploads pendentes,
  // eles continuam na fila e podem ser retomados na próxima abertura da visita.
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
    // Carrega pendentes dessa visita se houver
    const pend = loadPending();
    if (pend.length && st.relatorioSel) {
      st.pendingFotos = pend.filter(p => p.relatorioId === st.relatorioSel.id);
      if (st.pendingFotos.length) setTimeout(() => processarFilaUpload(), 500);
    }
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
let checkinEmAndamento = false;

export async function checkIn() {
  if (checkinEmAndamento) return;
  const v = st.visitaSel;
  if (!v) return;
  const ses = AUTH.getSession();

  checkinEmAndamento = true;
  try {
    const existente = await loadRelatorio(v.id);
    if (existente) {
      st.relatorioSel = existente;
      st.fotos = await loadFotos(existente.id);
      v.status = 'em_execucao';
      toast('✓ Relatório já iniciado — retomando');
      st.view = 'exec';
      renderCurrentView();
      startTimer();
      return;
    }

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
    if (err1) {
      if (err1.code === '23505' || err1.message.includes('duplicate')) {
        const rec = await loadRelatorio(v.id);
        if (rec) {
          st.relatorioSel = rec;
          st.fotos = await loadFotos(rec.id);
          v.status = 'em_execucao';
          toast('✓ Retomando visita já iniciada');
          st.view = 'exec';
          renderCurrentView();
          startTimer();
          return;
        }
      }
      toast('Erro ao iniciar: ' + err1.message, false);
      return;
    }

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
  } finally {
    checkinEmAndamento = false;
  }
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

// ── Fotos: upload confiável com compressão + fila persistente ─────
async function tentarUploadFoto(file, relatorioId) {
  try {
    const ext  = file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${relatorioId}/${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('field-photos')
      .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
    if (upErr) return { ok: false, error: 'Upload: ' + upErr.message };

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
    if (recErr) return { ok: false, error: 'DB: ' + recErr.message };

    return { ok: true, rec };
  } catch (e) {
    return { ok: false, error: e?.message || 'Erro desconhecido' };
  }
}

// Processa a fila em background. Reentrada é segura via flag.
let processandoFila = false;
async function processarFilaUpload() {
  if (processandoFila) return;
  processandoFila = true;
  try {
    while (st.pendingFotos.length > 0) {
      const p = st.pendingFotos[0];
      p.tentando = true;
      renderCurrentView();
      const res = await tentarUploadFoto(p.file, p.relatorioId);
      if (res.ok) {
        st.fotos.push(res.rec);
        st.pendingFotos.shift();
        await persistPending();
        renderCurrentView();
      } else {
        p.tentando = false;
        p.error = res.error;
        renderCurrentView();
        break; // Aguarda retry manual ou reconexão
      }
    }
    if (st.pendingFotos.length === 0) limparPending();
  } finally {
    processandoFila = false;
    renderCurrentView();
  }
}

export async function addPhoto(input) {
  const files = Array.from(input.files ?? []);
  if (!files.length) return;
  const r = st.relatorioSel;
  if (!r) { toast('Erro: sem relatório ativo', false); return; }
  input.value = '';

  toast(files.length > 1 ? `Comprimindo ${files.length} fotos...` : 'Comprimindo foto...');
  for (const original of files) {
    let file = original;
    try { file = await comprimirImagem(original); }
    catch (e) { console.warn('Falha na compressão, usando original:', e); }
    const b64 = await fileToBase64(file).catch(() => null);
    st.pendingFotos.push({
      tempId: 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      relatorioId: r.id,
      file,
      fileB64: b64,
      error: null,
      tentando: false,
    });
  }
  await persistPending();
  renderCurrentView();
  processarFilaUpload();
}

export async function retryFoto(tempId) {
  const p = st.pendingFotos.find(x => x.tempId === tempId);
  if (!p || p.tentando) return;
  // Move essa foto para o início da fila
  st.pendingFotos = [p, ...st.pendingFotos.filter(x => x.tempId !== tempId)];
  processarFilaUpload();
}

export async function descartarPending(tempId) {
  const idx = st.pendingFotos.findIndex(p => p.tempId === tempId);
  if (idx >= 0) {
    st.pendingFotos.splice(idx, 1);
    await persistPending();
    renderCurrentView();
  }
}

export async function removePhoto(fotoId) {
  const foto = st.fotos.find(f => f.id === fotoId);
  if (!foto) return;
  if (!confirm('Remover esta foto?')) return;
  if (foto.storage_path) {
    await supabase.storage.from('field-photos').remove([foto.storage_path]);
  }
  await supabase.from('fotos_relatorio').delete().eq('id', fotoId);
  st.fotos = st.fotos.filter(f => f.id !== fotoId);
  await sincronizarLegendasNoRelato();
  renderCurrentView();
}

export async function saveFotoObs(fotoId, texto) {
  const val = (texto || '').trim() || null;
  await supabase.from('fotos_relatorio').update({ observacao: val }).eq('id', fotoId);
  const foto = st.fotos.find(f => f.id === fotoId);
  if (foto) foto.observacao = val;
  await sincronizarLegendasNoRelato();
}

// ── Legenda → Observações (auto-sincroniza) ───────────────────────
async function sincronizarLegendasNoRelato() {
  const r = st.relatorioSel;
  if (!r) return;

  const obsAtual = r.observacoes || '';
  const idx = obsAtual.indexOf(RELATO_MARKER);
  const textoUsuario = idx >= 0 ? obsAtual.slice(0, idx) : obsAtual;

  const linhasFoto = st.fotos
    .map((f, i) => (f.observacao || '').trim() ? `${i+1}. ${f.observacao.trim()}` : null)
    .filter(Boolean);

  let novoObs;
  if (linhasFoto.length === 0) {
    novoObs = textoUsuario.replace(/\s+$/, '');
  } else {
    const userLimpo = textoUsuario.replace(/\s+$/, '');
    novoObs = userLimpo + RELATO_MARKER + linhasFoto.join('\n');
  }

  if (novoObs === obsAtual) return;

  const { error } = await supabase.from('relatorios').update({ observacoes: novoObs || null }).eq('id', r.id);
  if (error) { console.warn('Falha ao sincronizar observações:', error); return; }
  st.relatorioSel = { ...r, observacoes: novoObs };
}

// ── Salvar relato + observações ───────────────────────────────────
async function saveRelatoObs(silent = false) {
  const r = st.relatorioSel;
  if (!r) return;
  const relatoRaw = document.getElementById('ag-relato')?.value ?? '';
  // Blindagem: se o usuário digitar/colar o marker no relato, ainda joga fora
  // (legendas vivem só em observacoes agora)
  const relato = relatoRaw.split(RELATO_MARKER)[0].trim();
  const obsRaw = document.getElementById('ag-obs')?.value ?? '';

  // Legendas ficam em observacoes: preserva a parte auto-gerada (após o marker)
  const obsAtual = r.observacoes || '';
  const idxAtual = obsAtual.indexOf(RELATO_MARKER);
  const parteAuto = idxAtual >= 0 ? obsAtual.slice(idxAtual) : '';

  // O textarea de obs contém o texto COMPLETO (usuário + auto). Precisa separar:
  const idxNovo = obsRaw.indexOf(RELATO_MARKER);
  const textoUsuario = (idxNovo >= 0 ? obsRaw.slice(0, idxNovo) : obsRaw).replace(/\s+$/, '');

  const novoObs = parteAuto
    ? (textoUsuario + parteAuto)
    : textoUsuario;

  const { error } = await supabase
    .from('relatorios')
    .update({ relato: relato || null, observacoes: novoObs || null })
    .eq('id', r.id);
  if (error) { if (!silent) toast('Erro ao salvar: ' + error.message, false); return; }

  st.relatorioSel = { ...r, relato: relato || null, observacoes: novoObs || null };
  if (!silent) toast('✓ Relato salvo');
}

// Botão "Salvar e voltar" no viewReport
export async function saveReport() {
  await saveRelatoObs(false);
  st.view = 'exec';
  renderCurrentView();
  startTimer();
}

// ── Assinatura ────────────────────────────────────────────────────
export function sigClear() {
  if (!st.sigPad) return;
  const { canvas, ctx } = st.sigPad;
  const ratio = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
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

// Salva assinatura agora (não espera checkout) e volta pro menu
export async function confirmSign() {
  const v = st.visitaSel;
  const r = st.relatorioSel;
  if (!v || !r) return;

  // Nome vem do contato do cliente (hidden input pré-preenchido); fallback genérico
  const nomeInput = document.getElementById('ag-sig-nome')?.value?.trim() ?? '';
  const nome = nomeInput || v.cliente?.contato_nome || 'Responsável';
  if (!st.sigPad || st.sigPad.empty) { toast('Faça a assinatura antes de salvar', false); return; }

  toast('Enviando assinatura...');
  let sigUrl, sigPath;
  try {
    const res = await uploadSignature(st.sigPad.canvas, r.id);
    sigUrl = res.url;
    sigPath = res.path;
  } catch (e) {
    toast('Erro no upload da assinatura: ' + e.message, false);
    return;
  }

  const { error } = await supabase
    .from('relatorios')
    .update({
      assinatura_responsavel_nome: nome,
      assinatura_responsavel_img:  sigUrl,
      assinatura_storage_path:     sigPath,
    })
    .eq('id', r.id);
  if (error) { toast('Erro ao salvar: ' + error.message, false); return; }

  st.relatorioSel = {
    ...r,
    assinatura_responsavel_nome: nome,
    assinatura_responsavel_img:  sigUrl,
    assinatura_storage_path:     sigPath,
  };
  toast('✓ Assinatura confirmada');
  st.view = 'exec';
  renderCurrentView();
  startTimer();
}

// ── Check-out final (só valida + carimba fim) ─────────────────────
export async function submit() {
  const v = st.visitaSel;
  const r = st.relatorioSel;
  if (!v || !r) return;

  if (!r.assinatura_responsavel_img) {
    toast('Assinatura ainda não coletada', false); return;
  }
  if (st.pendingFotos.length > 0) {
    const ok = confirm(`Ainda existem ${st.pendingFotos.length} foto(s) que não foram enviadas. Finalizar mesmo assim? Elas serão perdidas.`);
    if (!ok) return;
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
  limparPending();
  const pendentes = st.pendingFotos.length;
  st.pendingFotos = [];
  toast(pendentes > 0
    ? `✓ Concluída · ⚠ ${pendentes} foto${pendentes > 1 ? 's' : ''} não subiu`
    : '✓ Visita concluída');
  st.view = 'done';
  renderCurrentView();
}

// Reenvia fila quando volta o online
window.addEventListener('online', () => {
  if (st.pendingFotos.length > 0) processarFilaUpload();
});
