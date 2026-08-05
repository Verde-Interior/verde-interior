import { state, save, dbAddEmployee, dbDeleteEmployee, dbUpdateEmployee } from './store.js';
import { supabase } from './supabase.js';
import { HM, toast, esc } from './utils.js';
import { AUTH } from './auth.js';

export function renderConfig() {
  document.getElementById('cfg-count').textContent = state.EMP.length;
  document.getElementById('cfg-list').innerHTML = state.EMP.map((e, i) => {
    const temAcesso = !!e.authId;
    const btnAcesso = temAcesso
      ? `<button onclick="adminResetSenha(${i})" class="bsm" style="padding:5px 10px" title="Redefinir senha de ${esc(e.name)}">
           <i class="fa-solid fa-key" style="font-size:12px"></i>
         </button>`
      : `<button onclick="abrirCriarAcesso(${i})" class="bsm" style="padding:5px 10px;color:#1D9E75;border-color:#1D9E75" title="Criar login para ${esc(e.name)}">
           <i class="fa-solid fa-user-lock" style="font-size:12px"></i>
         </button>`;
    return `
    <div class="cfg-row">
      <div style="flex:1;min-width:0">
        <div class="cfg-name">${esc(e.name)}</div>
        <div class="cfg-info">
          ${esc(e.cargo)} · ${esc(e.c)} · ${e.j}h/dia · Banco: <strong style="color:${e.bank >= 0 ? '#1D9E75' : '#E24B4A'}">${HM(e.bank)}</strong>
          ${e.username ? `<span style="color:var(--text3);margin-left:6px">· @${esc(e.username)}</span>` : '<span style="color:#E24B4A;margin-left:6px;font-size:11px">sem acesso</span>'}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${btnAcesso}
        <button onclick="editEmp(${i})" class="bsm" style="padding:5px 10px" title="Editar ${esc(e.name)}">
          <i class="fa-solid fa-pen" style="font-size:12px"></i>
        </button>
        <button onclick="removeEmp(${i})" class="bsm" style="color:#E24B4A;border-color:#E24B4A;padding:5px 10px" title="Remover ${esc(e.name)}">
          <i class="fa-solid fa-user-minus" style="font-size:12px"></i>
        </button>
      </div>
    </div>`;
  }).join('');
}

// ── Editar colaborador ──────────────────────────────────────────────────────

export function editEmp(i) {
  const e = state.EMP[i];
  document.getElementById('edit-emp-idx').value   = i;
  document.getElementById('edit-name').value      = e.name;
  document.getElementById('edit-cargo').value     = e.cargo;
  document.getElementById('edit-c').value         = e.c;
  document.getElementById('edit-j').value         = e.j;
  document.getElementById('edit-bank').value      = e.bank;
  document.getElementById('edit-days').value      = e.days;
  document.getElementById('edit-worked').value    = e.worked;
  document.getElementById('edit-emp-modal').style.display = 'flex';
}

export function closeEditEmp() {
  document.getElementById('edit-emp-modal').style.display = 'none';
}

export function saveEditEmp() {
  const i      = parseInt(document.getElementById('edit-emp-idx').value);
  const name   = document.getElementById('edit-name').value.trim();
  const cargo  = document.getElementById('edit-cargo').value.trim();
  const c      = document.getElementById('edit-c').value;
  const j      = parseFloat(document.getElementById('edit-j').value);
  const bank   = parseInt(document.getElementById('edit-bank').value);
  const days   = parseInt(document.getElementById('edit-days').value);
  const worked = parseFloat(document.getElementById('edit-worked').value);

  if (!name || !cargo || !j) { toast('Preencha todos os campos', false); return; }

  const emp = state.EMP[i];
  emp.name   = name;
  emp.cargo  = cargo;
  emp.c      = c;
  emp.j      = j;
  emp.bank   = isNaN(bank)   ? emp.bank   : bank;
  emp.days   = isNaN(days)   ? emp.days   : days;
  emp.worked = isNaN(worked) ? emp.worked : worked;

  if (emp.bank > 0) { emp.extra = emp.bank / 60; emp.due = 0; }
  else              { emp.due = -emp.bank / 60;  emp.extra = 0; }

  (async () => {
    await dbUpdateEmployee(i);
    state.EMP.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    closeEditEmp();
    save();
    if (window.buildBars) window.buildBars();
    renderConfig();
    toast(`✓ ${name} atualizado(a)`);
  })();
}

// ── Adicionar colaborador (novo employee + login em uma tacada) ─────────────

export function addEmp() {
  const name  = document.getElementById('cfg-name').value.trim();
  const cargo = document.getElementById('cfg-cargo').value.trim();
  const c     = document.getElementById('cfg-c').value;
  const j     = parseFloat(document.getElementById('cfg-j').value);
  const user  = document.getElementById('cfg-user').value.trim().toLowerCase();
  const pw    = document.getElementById('cfg-pw').value.trim();

  if (!name || !cargo)   { toast('Preencha nome e cargo', false); return; }
  if (!j || j <= 0)      { toast('Informe a jornada diária', false); return; }
  if (!user || !pw)      { toast('Preencha usuário e senha', false); return; }
  if (pw.length < 6)     { toast('Senha mínimo 6 caracteres', false); return; }
  if (state.EMP.some(e => e.name.toLowerCase() === name.toLowerCase())) {
    toast('Já existe um colaborador com esse nome', false); return;
  }

  (async () => {
    const emp = { name, cargo, c, j, bank: 0, worked: 0, extra: 0, due: 0, days: 0, authId: null, username: null };
    const dbEmp = await dbAddEmployee(emp);
    if (!dbEmp) { toast('Erro ao salvar no banco', false); return; }
    emp.id = dbEmp.id;

    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke('create-user', {
      body: { username: user, password: pw, employee_id: dbEmp.id },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    if (res.error || res.data?.error) {
      toast('Colaborador salvo, mas erro ao criar login: ' + (res.data?.error || res.error?.message), false);
    } else {
      emp.authId   = res.data?.user_id ?? null;
      emp.username = user;
    }

    state.EMP.push(emp);
    state.EMP.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    document.getElementById('cfg-name').value  = '';
    document.getElementById('cfg-cargo').value = '';
    document.getElementById('cfg-user').value  = '';
    document.getElementById('cfg-pw').value    = '';
    save();
    if (window.buildBars) window.buildBars();
    renderConfig();
    toast(`✓ ${name} adicionado(a) com login "${user}"`);
  })();
}

// ── Criar acesso para colaborador já existente (sem login) ─────────────────

export function abrirCriarAcesso(i) {
  const emp = state.EMP[i];
  document.getElementById('criar-acesso-empnome').textContent = emp.name;
  document.getElementById('criar-acesso-empidx').value        = i;
  document.getElementById('criar-acesso-user').value          = '';
  document.getElementById('criar-acesso-pw').value            = '';
  const msg = document.getElementById('criar-acesso-msg');
  msg.style.display = 'none';
  document.getElementById('criar-acesso-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('criar-acesso-user').focus(), 100);
}

export function fecharCriarAcesso() {
  document.getElementById('criar-acesso-modal').style.display = 'none';
}

export async function confirmarCriarAcesso() {
  const empIdx = parseInt(document.getElementById('criar-acesso-empidx').value);
  const user   = document.getElementById('criar-acesso-user').value.trim().toLowerCase();
  const pw     = document.getElementById('criar-acesso-pw').value.trim();

  function showMsg(txt, ok) {
    const el = document.getElementById('criar-acesso-msg');
    el.textContent      = txt;
    el.style.display    = 'block';
    el.style.background = ok ? '#ecfdf5' : '#fef2f2';
    el.style.color      = ok ? '#065f46' : '#991b1b';
    el.style.border     = ok ? '1px solid #a7f3d0' : '1px solid #fecaca';
  }

  if (!user)         { showMsg('Preencha o usuário.', false); return; }
  if (pw.length < 6) { showMsg('Senha mínimo 6 caracteres.', false); return; }

  const emp = state.EMP[empIdx];
  if (!emp) { showMsg('Colaborador não encontrado.', false); return; }

  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke('create-user', {
    body: { username: user, password: pw, employee_id: emp.id },
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });

  if (res.error || res.data?.error) {
    showMsg('Erro: ' + (res.data?.error || res.error?.message), false);
    return;
  }

  emp.authId   = res.data?.user_id ?? null;
  emp.username = user;
  fecharCriarAcesso();
  renderConfig();
  toast(`✓ Acesso criado para ${emp.name} (login: "${user}")`);
}

// ── Remover colaborador ────────────────────────────────────────────────────

export function removeEmp(i) {
  if (!confirm(`Remover ${state.EMP[i].name} da equipe?`)) return;
  const emp  = state.EMP[i];
  const name = emp.name;
  (async () => {
    await dbDeleteEmployee(emp);
    state.EMP.splice(i, 1);
    if (state.cu >= state.EMP.length) state.cu = 0;
    if (state.eu >= state.EMP.length) state.eu = 0;
    save();
    if (window.buildBars) window.buildBars();
    renderConfig();
    toast(`${name} removido(a)`);
  })();
}

// ── Redefinir senha (admin) ────────────────────────────────────────────────

export function adminResetSenha(empIdx) {
  const emp = state.EMP[empIdx];
  if (!emp) return;
  document.getElementById('reset-pwd-empnome').textContent = emp.name;
  document.getElementById('reset-pwd-empidx').value        = empIdx;
  document.getElementById('reset-pwd-nova').value          = '';
  document.getElementById('reset-pwd-msg').style.display   = 'none';
  document.getElementById('reset-pwd-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('reset-pwd-nova').focus(), 100);
}

export function fecharModalResetPwd() {
  document.getElementById('reset-pwd-modal').style.display = 'none';
}

export async function confirmarAdminResetSenha() {
  const empIdx    = parseInt(document.getElementById('reset-pwd-empidx').value);
  const novaSenha = document.getElementById('reset-pwd-nova').value.trim();

  function showMsg(txt, ok) {
    const msgEl = document.getElementById('reset-pwd-msg');
    msgEl.textContent      = txt;
    msgEl.style.display    = 'block';
    msgEl.style.background = ok ? '#ecfdf5' : '#fef2f2';
    msgEl.style.color      = ok ? '#065f46' : '#991b1b';
    msgEl.style.border     = ok ? '1px solid #a7f3d0' : '1px solid #fecaca';
  }

  if (novaSenha.length < 6) { showMsg('Mínimo 6 caracteres.', false); return; }

  const emp = state.EMP[empIdx];
  if (!emp) { showMsg('Colaborador não encontrado.', false); return; }

  const { data: empRow } = await supabase
    .from('employees')
    .select('auth_user_id')
    .eq('id', emp.id)
    .maybeSingle();

  if (!empRow?.auth_user_id) {
    showMsg('Colaborador sem login. Use o botão "Criar acesso" primeiro.', false);
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke('admin-reset-password', {
    body: { user_id: empRow.auth_user_id, nova_senha: novaSenha },
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });

  if (res.error || res.data?.error) {
    showMsg('Erro: ' + (res.data?.error || res.error?.message), false);
    return;
  }

  fecharModalResetPwd();
  toast(`✓ Senha de ${emp.name} redefinida com sucesso`);
}

export function resetAll() {
  if (!confirm('Limpar TODOS os dados salvos? Esta ação não pode ser desfeita.')) return;
  ['vi-emp', 'vi-ps', 'vi-hist', 'vi-justs'].forEach(k => localStorage.removeItem(k));
  Object.keys(state.PS).forEach(k   => (state.PS[k]   = []));
  Object.keys(state.HIST).forEach(k => (state.HIST[k] = []));
  state.JUSTS.length = 0;
  toast('Dados locais limpos');
}
