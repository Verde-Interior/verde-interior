import './styles/main.css';

import { load } from './store.js';
import { F, WDS, MESES, toast } from './utils.js';
import { AUTH } from './auth.js';
import { renderPunch, doPunch, doExit, delTR } from './punch.js';
import { renderMirror, printMirror } from './mirror.js';
import { handleFiles, removeFile, handleDrag, handleDrop } from './upload.js';
import { sendJust } from './justs.js';
import { resolveJ, renderEdit, delER, openAdd, closeAdd, saveAdd, expCSV, expXLSX } from './admin.js';
import { addEmp, removeEmp, resetAll, editEmp, closeEditEmp, saveEditEmp, adminResetSenha, fecharModalResetPwd, confirmarAdminResetSenha } from './config.js';
import { buildBars, selU, selEU, setV, setSv, setAs } from './nav.js';
import { installPWA, dismissInstall, applyUpdate } from './pwa.js';
import { requestNotifyPermission, startNotifyChecker } from './notify.js';
import {
  renderAgenda, openDetail as agOpenDetail, back as agBack, backToList as agBackToList,
  goTo as agGoTo, changeDate as agChangeDate, goToday as agGoToday,
  checkIn as agCheckIn, addPhoto as agAddPhoto, removePhoto as agRemovePhoto,
  saveFotoObs as agSaveFotoObs, saveReport as agSaveReport,
  sigClear as agSigClear, confirmSign as agConfirmSign, submit as agSubmit,
  retryFoto as agRetryFoto, descartarPending as agDescartaPending,
} from './agenda.js';

function tick() {
  const n = new Date();
  document.getElementById('clk').textContent = F(n.getHours()) + ':' + F(n.getMinutes()) + ':' + F(n.getSeconds());
  document.getElementById('cdt').textContent = `${WDS[n.getDay()]}, ${n.getDate()} de ${MESES[n.getMonth()]} ${n.getFullYear()}`;
}

// Expor para os onclick handlers inline no HTML
window.AUTH            = AUTH;
window.changePassword  = AUTH.changePassword;
window.doPunch        = doPunch;
window.doExit         = doExit;
window.delTR          = delTR;
window.renderMirror   = renderMirror;
window.printMirror    = printMirror;
window.handleFiles    = handleFiles;
window.removeFile     = removeFile;
window.handleDrag     = handleDrag;
window.handleDrop     = handleDrop;
window.sendJust       = sendJust;
window.resolveJ       = resolveJ;
window.renderEdit     = renderEdit;
window.delER          = delER;
window.openAdd        = openAdd;
window.closeAdd       = closeAdd;
window.saveAdd        = saveAdd;
window.expCSV         = expCSV;
window.expXLSX        = expXLSX;
window.addEmp                   = addEmp;
window.removeEmp                = removeEmp;
window.resetAll                 = resetAll;
window.editEmp                  = editEmp;
window.closeEditEmp             = closeEditEmp;
window.saveEditEmp              = saveEditEmp;
window.adminResetSenha          = adminResetSenha;
window.fecharModalResetPwd      = fecharModalResetPwd;
window.confirmarAdminResetSenha = confirmarAdminResetSenha;
window.setV           = setV;
window.setSv          = setSv;
window.setAs          = setAs;
window.selU           = selU;
window.selEU          = selEU;
window.buildBars      = buildBars;
// ── Esqueci minha senha ──────────────────────────────────────────
window.toggleEsqueci = function() {
  const panel = document.getElementById('esqueci-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') document.getElementById('esqueci-email').focus();
};

window.enviarResetSenha = async function() {
  const email  = (document.getElementById('esqueci-email').value || '').trim();
  const msgEl  = document.getElementById('esqueci-msg');
  const btn    = document.getElementById('esqueci-btn');
  const btntxt = document.getElementById('esqueci-btntxt');
  const spin   = document.getElementById('esqueci-spinner');

  function showMsg(txt, ok) {
    msgEl.textContent   = txt;
    msgEl.style.display = 'block';
    msgEl.style.background = ok ? '#ecfdf5' : '#fef2f2';
    msgEl.style.color      = ok ? '#065f46' : '#991b1b';
    msgEl.style.border     = ok ? '1px solid #a7f3d0' : '1px solid #fecaca';
  }

  if (!email || !email.includes('@')) { showMsg('Informe um e-mail válido.', false); return; }

  btn.disabled = true;
  btntxt.style.display = 'none';
  spin.style.display   = 'block';

  const { error } = await AUTH.solicitarResetSenha(email);

  btn.disabled = false;
  btntxt.style.display = '';
  spin.style.display   = 'none';

  if (error) { showMsg('Erro: ' + error.message, false); return; }
  // Always show success (don't leak which emails are registered)
  showMsg('Se esse e-mail estiver cadastrado, você receberá o link em instantes.', true);
  document.getElementById('esqueci-email').value = '';
};

window.requestNotifyPermission = requestNotifyPermission;
window.startNotifyChecker      = startNotifyChecker;
window.installPWA              = installPWA;
window.dismissInstall = dismissInstall;
window.applyUpdate    = applyUpdate;
window.toast          = toast;

// Sistema de Campo — Minha Agenda
window.renderAgenda        = renderAgenda;
window.agendaOpenDetail    = agOpenDetail;
window.agendaBack          = agBack;
window.agendaBackToList    = agBackToList;
window.agendaGoTo          = agGoTo;
window.agendaChangeDate    = agChangeDate;
window.agendaGoToday       = agGoToday;
window.agendaCheckIn       = agCheckIn;
window.agendaAddPhoto      = agAddPhoto;
window.agendaRemoveFoto    = agRemovePhoto;
window.agendaSaveFotoObs   = agSaveFotoObs;
window.agendaSaveReport    = agSaveReport;
window.agendaSigClear      = agSigClear;
window.agendaConfirmSign   = agConfirmSign;
window.agendaSubmit        = agSubmit;
window.agendaRetryFoto     = agRetryFoto;
window.agendaDescartaPending = agDescartaPending;

tick();
setInterval(tick, 1000);

// ── Banner de status de conexão ─────────────────────────────────
function setupOfflineBanner() {
  const el = document.createElement('div');
  el.id = 'net-banner';
  el.innerHTML = `<i class="fa-solid fa-plug-circle-xmark"></i> Sem internet — as fotos e o relatório vão salvar quando reconectar`;
  document.body.prepend(el);
  function refresh() {
    if (navigator.onLine) el.classList.remove('on');
    else el.classList.add('on');
  }
  window.addEventListener('online',  refresh);
  window.addEventListener('offline', refresh);
  refresh();
}
setupOfflineBanner();

async function init() {
  await AUTH.initSession();
  if (AUTH.getSession()) {
    await load();
    AUTH.applySession();
    buildBars();
    renderPunch();
    document.getElementById('ls').style.display = 'none';
    requestNotifyPermission();
    startNotifyChecker();
  } else {
    buildBars();
    renderPunch();
    setTimeout(() => { const lu = document.getElementById('lu'); if (lu) lu.focus(); }, 200);
  }
}

init();
"" 
