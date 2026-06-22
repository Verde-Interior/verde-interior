import { supabase } from './supabase.js';
import { TKEY } from './utils.js';

export const state = {
  EMP: [],
  PS:  {},
  HIST: {},
  JUSTS: [],
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
    id:     e.id,
    name:   e.name,
    cargo:  e.cargo,
    c:      e.contract_type,
    j:      e.daily_hours,
    bank:   e.bank_minutes,
    worked: Number(e.worked_hours),
    extra:  Number(e.extra_hours),
    due:    Number(e.due_hours),
    days:   e.days_worked,
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
      if (p.date === TKEY) {
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
}

// ── DB operations ─────────────────────────────────────────
export async function dbAddPunch(empIdx, rec, date) {
  const emp = state.EMP[empIdx];
  if (!emp?.id) return null;
  const row = {
    employee_id: emp.id,
    date:        date || TKEY,
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
  if (!emp?.id) return;
  const { error } = await supabase.from('employees').update({
    bank_minutes: emp.bank,
    worked_hours: emp.worked,
    extra_hours:  emp.extra,
    due_hours:    emp.due,
    days_worked:  emp.days,
  }).eq('id', emp.id);
  if (error) console.error('dbUpdateEmployeeStats:', error.message);
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
