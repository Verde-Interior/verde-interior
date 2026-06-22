import './styles/main.css';

import { load } from './store.js';
import { F, WDS, MESES, toast } from './utils.js';
import { AUTH } from './auth.js';
import { renderPunch, doPunch, doExit, delTR } from './punch.js';
import { renderMirror, printMirror } from './mirror.js';
import { handleFiles, removeFile, handleDrag, handleDrop } from './upload.js';
import { sendJust } from './justs.js';
import { resolveJ, renderEdit, delER, openAdd, closeAdd, saveAdd, expCSV } from './admin.js';
import { addEmp, removeEmp, resetAll, editEmp, closeEditEmp, saveEditEmp } from './config.js';
import { buildBars, selU, selEU, setV, setSv, setAs } from './nav.js';
import { installPWA, dismissInstall, applyUpdate } from './pwa.js';
import { requestNotifyPermission, startNotifyChecker } from './notify.js';

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
window.addEmp         = addEmp;
window.removeEmp      = removeEmp;
window.resetAll       = resetAll;
window.editEmp        = editEmp;
window.closeEditEmp   = closeEditEmp;
window.saveEditEmp    = saveEditEmp;
window.setV           = setV;
window.setSv          = setSv;
window.setAs          = setAs;
window.selU           = selU;
window.selEU          = selEU;
window.buildBars      = buildBars;
window.requestNotifyPermission = requestNotifyPermission;
window.startNotifyChecker      = startNotifyChecker;
window.installPWA              = installPWA;
window.dismissInstall = dismissInstall;
window.applyUpdate    = applyUpdate;
window.toast          = toast;

tick();
setInterval(tick, 1000);

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
