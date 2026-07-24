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
import { renderAgenda } from './agenda.js';

// Cargos que só veem Minha Agenda + Meu Perfil
const CARGOS_RUA = ['Campo', 'Facilities'];

export function buildBars() {
  const ses = AUTH.getSession();

  // Aba Colaborador é SEMPRE pessoal — só a conta logada, mesmo pra gestor.
  // Gestor vê equipe inteira só na aba "Gestor" (#eubar / #ru).
  const i = state.cu;
  const emp = state.EMP[i];
  const name = emp ? emp.name : '';
  document.getElementById('ubar').innerHTML =
    `<button class="uch on">${name}</button>`;

  document.getElementById('eubar').innerHTML = state.EMP.map((e, i) =>
    `<button class="uch${i === state.eu ? ' on' : ''}" onclick="selEU(${i},this)">${e.name}</button>`
  ).join('');
  document.getElementById('ru').innerHTML = '<option value="all">Todos</option>' +
    state.EMP.map((e, i) => `<option value="${i}">${e.name}</option>`).join('');
  buildEditDates();

  // Modo rua: só Agenda + Perfil para colaboradores de campo/facilities
  const ehRua = ses && ses.role !== 'gestor' && emp && CARGOS_RUA.includes(emp.cargo);
  if (ehRua) _aplicarModoRua();
  else       _removerModoRua();
}

const ABAS_OCULTAS_RUA = ['ponto', 'espelho', 'banco', 'just'];

function _aplicarModoRua() {
  // Ocultar botões de aba desnecessários
  document.querySelectorAll('#ctabs .ch').forEach(btn => {
    const match = btn.getAttribute('onclick')?.match(/setSv\('(\w+)'/);
    const sv = match?.[1];
    if (sv) btn.style.display = ABAS_OCULTAS_RUA.includes(sv) ? 'none' : '';
  });

  // Se a sub-view ativa for uma das ocultas, navegar para Agenda
  const svAtivo = document.querySelector('#vw-colab .sv.on');
  if (svAtivo && ABAS_OCULTAS_RUA.some(sv => svAtivo.id === 'sv-' + sv)) {
    document.querySelectorAll('#vw-colab .sv').forEach(e => e.classList.remove('on'));
    document.querySelectorAll('#ctabs .ch').forEach(e => e.classList.remove('on'));
    const agendaSv  = document.getElementById('sv-agenda');
    const agendaBtn = document.querySelector('#ctabs .ch[onclick*="\'agenda\'"]');
    if (agendaSv)  agendaSv.classList.add('on');
    if (agendaBtn) agendaBtn.classList.add('on');
    renderAgenda();
  }
}

function _removerModoRua() {
  document.querySelectorAll('#ctabs .ch').forEach(btn => { btn.style.display = ''; });
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
  if (sv === 'agenda')  renderAgenda();
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
