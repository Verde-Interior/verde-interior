import { state } from './store.js';
import { AUTH } from './auth.js';

import { renderPunch } from './punch.js';
import { renderMirror, buildMirrorMonths } from './mirror.js';
import { renderBank } from './bank.js';
import { renderProfile } from './profile.js';
import { renderAttachList } from './upload.js';
import { renderJusts } from './justs.js';
import { renderAdmin, buildEditDates, renderEdit } from './admin.js';
import { renderConfig } from './config.js';

export function buildBars() {
  const ses = AUTH.getSession();
  const isGestor = ses && ses.role === 'gestor';

  if (isGestor) {
    document.getElementById('ubar').innerHTML = state.EMP.map((e, i) =>
      `<button class="uch${i === state.cu ? ' on' : ''}" onclick="selU(${i},this)">${e.name}</button>`
    ).join('');
  } else {
    const i = state.cu;
    const name = state.EMP[i] ? state.EMP[i].name : '';
    document.getElementById('ubar').innerHTML =
      `<button class="uch on">${name}</button>`;
  }

  document.getElementById('eubar').innerHTML = state.EMP.map((e, i) =>
    `<button class="uch${i === state.eu ? ' on' : ''}" onclick="selEU(${i},this)">${e.name}</button>`
  ).join('');
  document.getElementById('ru').innerHTML = '<option value="all">Todos</option>' +
    state.EMP.map((e, i) => `<option value="${i}">${e.name}</option>`).join('');
  buildEditDates();
}

export function selU(i, btn) {
  state.cu = i;
  document.querySelectorAll('#ubar .uch').forEach(e => e.classList.remove('on'));
  btn.classList.add('on');
  buildMirrorMonths();
  renderPunch();
}

export function selEU(i, btn) {
  state.eu = i;
  document.querySelectorAll('#eubar .uch').forEach(e => e.classList.remove('on'));
  btn.classList.add('on');
  buildEditDates();
  renderEdit();
}

export function setV(v, btn) {
  document.querySelectorAll('.vw').forEach(e => e.classList.remove('on'));
  document.querySelectorAll('.ntb').forEach(e => e.classList.remove('on'));
  document.getElementById('vw-' + v).classList.add('on');
  btn.classList.add('on');
  if (v === 'admin')  renderAdmin();
  if (v === 'config') renderConfig();
}

export function setSv(sv, btn) {
  document.querySelectorAll('#vw-colab .sv').forEach(e => e.classList.remove('on'));
  document.querySelectorAll('#ctabs .ch').forEach(e => e.classList.remove('on'));
  document.getElementById('sv-' + sv).classList.add('on');
  btn.classList.add('on');
  if (sv === 'ponto')   renderPunch();
  if (sv === 'espelho') { buildMirrorMonths(); renderMirror(); }
  if (sv === 'banco')   renderBank();
  if (sv === 'perfil')  renderProfile();
  if (sv === 'just') { state.pendingFiles = []; renderAttachList(); renderJusts(); }
}

export function setAs(sv, btn) {
  document.querySelectorAll('.as').forEach(e => e.classList.remove('on'));
  document.querySelectorAll('#atabs .ch').forEach(e => e.classList.remove('on'));
  document.getElementById('as-' + sv).classList.add('on');
  btn.classList.add('on');
}
