import { supabase } from './supabase.js';
import { getHoje, calcWorkClosed, F } from './utils.js';

export const state = {
  EMP: [],
  PS:  {},
  HIST: {},
  JUSTS: [],
  BLOQ: new Map(), // employee_id -> motivo (ausência justificada hoje: férias/folga/atestado — ver employee_bloqueios)
  BLOQUEIOS: [],   // todas as linhas de employee_bloqueios (qualquer data), usado no relatório de frequência
  cu: 0,
  eu: 0,
  pendingFiles: [],
};

export function save() {
  try {
    localStorage.setItem('vi-emp',   JSON.stringify(state.EMP));
    localStorage.setItem('vi-ps',    JSON.stringify(state.PS));
    localStorage.setItem('vi-hist',  JSON.stringify(state.HIST));
    localStorage.setItem('vi-justs', JSON.stringify(
      state.JUSTS.map(j => ({ ...j, files: (j.files || []).map(f => ({ name: f.name, type: f.type, size: f.size })) }))
    ));
    const s = document.getElementById('sav');
    if (s) { s.classList.add('on'); setTimeout(() => s.classList.remove('on'), 1500); }
  } catch { /* storage unavailable */ }
}

function _loadLocal() {
  try {
    const e = localStorage.getItem('vi-emp');    if (e) state.EMP   = JSON.parse(e);
    const p = localStorage.getItem('vi-ps');     if (p) state.PS    = JSON.parse(p);
    const h = localStorage.getItem('vi-hist');   if (h) state.HIST  = JSON.parse(h);
    const j = localStorage.getItem('vi-justs');  if (j) state.JUSTS = JSON.parse(j);
  } catch { /* storage unavailable */ }
}

export async function load() {
  const { data: emps, error: empErr } = await supabase.from('employees').select('*').order('name');
  if (empErr || !emps || !emps.length) { _loadLocal(); return; }

  state.EMP = emps.map(e => ({
    id:       e.id,
    name:     e.name,
    cargo:    e.cargo,
    c:        e.contract_type,
    j:        e.daily_hours,
    bank:     e.bank_minutes,
    worked:   Number(e.worked_hours),
    extra:    Number(e.extra_hours),
    due:      Number(e.due_hours),
    days:     e.days_worked,
    authId:   e.auth_user_id   || null,
    username: e.username       || null,
  }));

  const { data: punches } = await supabase.from('punch_records').select('*').order('time');
  state.PS   = {};
  state.HIST = {};
  if (punches) {
    punches.forEach(p => {
      const idx = state.EMP.findIndex(e => e.id === p.employee_id);
      if (idx < 0) return;
      const rec = { type: p.type, time: p.time, _id: p.id };
      if (p.obs) rec.obs = p.obs;
      if (p.lat != null) rec.lat = p.lat;
      if (p.lng != null) rec.lng = p.lng;
      if (p.date === getHoje()) {
        if (!state.PS[idx]) state.PS[idx] = [];
        state.PS[idx].push(rec);
      } else {
        if (!state.HIST[idx]) state.HIST[idx] = [];
        let dh = state.HIST[idx].find(d => d.date === p.date);
        if (!dh) { dh = { date: p.date, records: [] }; state.HIST[idx].push(dh); }
        dh.records.push(rec);
      }
    });
  }

  const { data: justs } = await supabase.from('justifications').select('*').order('date', { ascending: false });
  if (justs) {
    state.JUSTS = justs.map(j => {
      const idx = state.EMP.findIndex(e => e.id === j.employee_id);
      return { _id: j.id, user: idx, date: j.date, type: j.type, desc: j.description, status: j.status, files: [] };
    });
  }

  // Ausências já aprovadas no CRM (Escala > Bloqueios: férias/folga/feriado/
  // atestado) — mesma tabela que impede agendamento de visita lá. Usada aqui
  // pra não marcar como "Ausente"/gerar alerta quem já está de folga.
  const hoje = getHoje();
  const { data: bloqueios } = await supabase
    .from('employee_bloqueios')
    .select('funcionario_id, motivo')
    .lte('data_inicio', hoje)
    .gte('data_fim', hoje);
  state.BLOQ = new Map((bloqueios ?? []).map(b => [String(b.funcionario_id), b.motivo || 'Ausência justificada']));

  // Todos os bloqueios (passado, presente e futuro) — usado pelo relatório de
  // frequência pra não contar férias/folga/feriado/atestado como falta.
  const { data: bloqueiosAll } = await supabase
    .from('employee_bloqueios')
    .select('funcionario_id, data_inicio, data_fim, motivo');
  state.BLOQUEIOS = bloqueiosAll ?? [];

  await closeOpenShifts();
}

async function closeOpenShifts() {
  const hoje = getHoje();
  for (let idx = 0; idx < state.EMP.length; idx++) {
    const emp = state.EMP[idx];
    if (!emp?.id) continue;

    const hist = state.HIST[idx] || [];
    const openDays = hist.filter(dh => {
      if (dh.date === hoje) return false;
      const recs = dh.records || [];
      return recs.some(r => r.type === 'entry') && !recs.some(r => r.type === 'exit');
    });

    for (const dh of openDays) {
      let closeTime = '17:00';

      const { data: agendas } = await supabase
        .from('agenda')
        .select('id')
        .eq('funcionario_id', emp.id)
        .eq('data_agendada', dh.date);

      if (agendas?.length) {
        const { data: rels } = await supabase
          .from('relatorios')
          .select('checkout_at')
          .in('agendamento_id', agendas.map(a => a.id))
          .not('checkout_at', 'is', null)
          .order('checkout_at', { ascending: false })
          .limit(1);
        if (rels?.[0]?.checkout_at) {
          const d = new Date(rels[0].checkout_at);
          closeTime = F(d.getHours()) + ':' + F(d.getMinutes());
        }
      }

      const exitRec = { type: 'exit', time: closeTime, obs: 'auto' };
      const dbRec = await dbAddPunch(idx, exitRec, dh.date);
      if (dbRec) exitRec._id = dbRec.id;
      dh.records.push(exitRec);

      const workedMin  = calcWorkClosed(dh.records);
      const dailySaldo = workedMin - emp.j * 60;
      emp.bank   += dailySaldo;
      emp.days   += 1;
      emp.worked  = Number((emp.worked + workedMin / 60).toFixed(2));
      if (dailySaldo > 0) emp.extra = Number((emp.extra + dailySaldo / 60).toFixed(2));
      else                emp.due   = Number((emp.due   - dailySaldo / 60).toFixed(2));
    }

    if (openDays.length > 0) await dbUpdateEmployeeStats(idx);
  }
}

// ── DB operations ─────────────────────────────────────────
export async function dbAddPunch(empIdx, rec, date) {
  const emp = state.EMP[empIdx];
  if (!emp?.id) return null;
  const row = {
    employee_id: emp.id,
    date:        date || getHoje(),
    type:        rec.type,
    time:        rec.time,
    obs:         rec.obs || null,
  };
  if (rec.lat != null) row.lat = rec.lat;
  if (rec.lng != null) row.lng = rec.lng;

  const { data, error } = await supabase.from('punch_records')
    .insert(row)
    .select().single();
  if (error) console.error('dbAddPunch:', error.message);
  return data;
}

export async function dbDeletePunch(rec) {
  if (!rec?._id) return;
  const { error } = await supabase.from('punch_records').delete().eq('id', rec._id);
  if (error) console.error('dbDeletePunch:', error.message);
}

export async function dbAddEmployee(emp) {
  const { data, error } = await supabase.from('employees').insert({
    name: emp.name, cargo: emp.cargo, contract_type: emp.c, daily_hours: emp.j,
    bank_minutes: 0, worked_hours: 0, extra_hours: 0, due_hours: 0, days_worked: 0,
  }).select().single();
  if (error) console.error('dbAddEmployee:', error.message);
  return data;
}

export async function dbDeleteEmployee(emp) {
  if (!emp?.id) return;
  const { error } = await supabase.from('employees').delete().eq('id', emp.id);
  if (error) console.error('dbDeleteEmployee:', error.message);
}

export async function dbUpdateJustStatus(just, status) {
  if (!just?._id) return;
  const { error } = await supabase.from('justifications').update({ status }).eq('id', just._id);
  if (error) console.error('dbUpdateJustStatus:', error.message);
}

export async function dbUpdateEmployee(empIdx) {
  const emp = state.EMP[empIdx];
  if (!emp?.id) return;
  const { error } = await supabase.from('employees').update({
    name:          emp.name,
    cargo:         emp.cargo,
    contract_type: emp.c,
    daily_hours:   emp.j,
    bank_minutes:  emp.bank,
    worked_hours:  emp.worked,
    extra_hours:   emp.extra,
    due_hours:     emp.due,
    days_worked:   emp.days,
  }).eq('id', emp.id);
  if (error) console.error('dbUpdateEmployee:', error.message);
}

export async function dbUpdateEmployeeStats(empIdx) {
  const emp = state.EMP[empIdx];
  if (!emp?.id) return true;
  const { error } = await supabase.from('employees').update({
    bank_minutes: emp.bank,
    worked_hours: emp.worked,
    extra_hours:  emp.extra,
    due_hours:    emp.due,
    days_worked:  emp.days,
  }).eq('id', emp.id);
  if (error) { console.error('dbUpdateEmployeeStats:', error.message); return false; }
  return true;
}

// ── Fila offline ─────────────────────────────────────────────────────────────
const PENDING_PUNCHES_KEY = 'vi-pending-punches';

export function queuePendingPunch(empIdx, rec, date) {
  const q = JSON.parse(localStorage.getItem(PENDING_PUNCHES_KEY) || '[]');
  q.push({ empIdx, rec, date });
  localStorage.setItem(PENDING_PUNCHES_KEY, JSON.stringify(q));
}

export function hasPendingPunches() {
  return JSON.parse(localStorage.getItem(PENDING_PUNCHES_KEY) || '[]').length > 0;
}

export async function replayPendingPunches() {
  const q = JSON.parse(localStorage.getItem(PENDING_PUNCHES_KEY) || '[]');
  if (!q.length) return 0;
  let synced = 0;
  const failed = [];
  for (const item of q) {
    const dbRec = await dbAddPunch(item.empIdx, item.rec, item.date);
    if (dbRec) synced++;
    else failed.push(item);
  }
  localStorage.setItem(PENDING_PUNCHES_KEY, JSON.stringify(failed));
  return synced;
}

export async function dbAddJust(empIdx, just) {
  const emp = state.EMP[empIdx];
  if (!emp?.id) return null;
  const { data, error } = await supabase.from('justifications').insert({
    employee_id: emp.id, date: just.date, type: just.type, description: just.desc, status: 'pendente',
  }).select().single();
  if (error) console.error('dbAddJust:', error.message);
  return data;
}
