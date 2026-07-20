import { state, save, dbAddEmployee, dbDeleteEmployee, dbUpdateEmployee } from './store.js';
import { supabase } from './supabase.js';
import { HM, toast, esc } from './utils.js';
import { AUTH } from './auth.js';

export function renderConfig() {
  document.getElementById('cfg-count').textContent = state.EMP.length;
  document.getElementById('cfg-list').innerHTML = state.EMP.map((e, i) => `
    <div class="cfg-row">
      <div style="flex:1;min-width:0">
        <div class="cfg-name">${esc(e.name)}</div>
        <div class="cfg-info">${esc(e.cargo)} · ${esc(e.c)} · ${e.j}h/dia · Banco: <strong style="color:${e.bank >= 0 ? '#1D9E75' : '#E24B4A'}">${HM(e.bank)}</strong></div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button onclick="editEmp(${i})" class="bsm" style="padding:5px 10px" title="Editar ${esc(e.name)}">
          <i class="fa-solid fa-pen" style="font-size:12px"></i>
        </button>
        <button onclick="removeEmp(${i})" class="bsm" style="color:#E24B4A;border-color:#E24B4A;padding:5px 10px" title="Remover ${esc(e.name)}">
          <i class="fa-solid fa-user-minus" style="font-size:12px"></i>
        </button>
      </div>
    </div>`).join('');
}

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
  if (state.EMP.some(e => e.name.toLowerCase() === name.toLowerCase())) { toast('Colaborador já existe', false); return; }

  const emp = { name, cargo, c, j, bank: 0, worked: 0, extra: 0, due: 0, days: 0 };
  (async () => {
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

export function resetAll() {
  if (!confirm('Limpar TODOS os dados salvos? Esta ação não pode ser desfeita.')) return;
  ['vi-emp', 'vi-ps', 'vi-hist', 'vi-justs'].forEach(k => localStorage.removeItem(k));
  Object.keys(state.PS).forEach(k   => (state.PS[k]   = []));
  Object.keys(state.HIST).forEach(k => (state.HIST[k] = []));
  state.JUSTS.length = 0;
  toast('Dados locais limpos');
}
