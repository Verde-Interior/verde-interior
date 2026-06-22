/**
 * Script de seed — executa UMA vez para popular o banco.
 * Usa a chave service_role (nunca expor no frontend).
 *
 * Uso: npm run seed
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mcaqxfogzvrqqnoixptv.supabase.co';
const SERVICE_KEY  = 'sb_secret_ZsJcpghIzaHy_ldir1ib5A_69-BpVjU';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── helpers ─────────────────────────────────────────────────
const pad = n => (n < 10 ? '0' + n : String(n));
function dayOffset(days) {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const TODAY     = dayOffset(0);
const YESTERDAY = dayOffset(-1);
const DAY2      = dayOffset(-2);

// ── dados ────────────────────────────────────────────────────
const EMPLOYEES = [
  { name: 'Beto',        cargo: 'Vendas',     contract_type: 'CLT', daily_hours: 8, bank_minutes:  480, worked_hours: 174, extra_hours: 10, due_hours: 0, days_worked: 22 },
  { name: 'Brenno',      cargo: 'Consultor',  contract_type: 'PJ',  daily_hours: 6, bank_minutes:  180, worked_hours: 126, extra_hours:  6, due_hours: 0, days_worked: 21 },
  { name: 'Bruno',       cargo: 'Designer',   contract_type: 'CLT', daily_hours: 8, bank_minutes:   60, worked_hours: 158, extra_hours:  2, due_hours: 0, days_worked: 21 },
  { name: 'Carlos',      cargo: 'TI',         contract_type: 'CLT', daily_hours: 8, bank_minutes:   60, worked_hours: 160, extra_hours:  0, due_hours: 0, days_worked: 21 },
  { name: 'Greg',        cargo: 'Estagiário', contract_type: 'CLT', daily_hours: 8, bank_minutes:  -90, worked_hours: 154, extra_hours:  0, due_hours: 6, days_worked: 20 },
  { name: 'Miriam',      cargo: 'RH',         contract_type: 'CLT', daily_hours: 8, bank_minutes: -120, worked_hours: 149, extra_hours:  0, due_hours: 8, days_worked: 19 },
  { name: 'Pedro Silva', cargo: 'Financeiro', contract_type: 'CLT', daily_hours: 8, bank_minutes:  240, worked_hours: 168, extra_hours:  4, due_hours: 0, days_worked: 21 },
  { name: 'Peterson',    cargo: 'Arquiteto',  contract_type: 'CLT', daily_hours: 8, bank_minutes:  120, worked_hours: 162, extra_hours:  2, due_hours: 0, days_worked: 21 },
];

const USERS = [
  { u: 'beto',     pw: 'ponto0',    role: 'colab',  name: 'Beto' },
  { u: 'brenno',   pw: 'ponto1',    role: 'colab',  name: 'Brenno' },
  { u: 'bruno',    pw: 'ponto2',    role: 'colab',  name: 'Bruno' },
  { u: 'carlos',   pw: 'ponto3',    role: 'colab',  name: 'Carlos' },
  { u: 'greg',     pw: 'ponto4',    role: 'colab',  name: 'Greg' },
  { u: 'miriam',   pw: 'ponto5',    role: 'colab',  name: 'Miriam' },
  { u: 'pedro',    pw: 'ponto6',    role: 'colab',  name: 'Pedro Silva' },
  { u: 'peterson', pw: 'ponto7',    role: 'colab',  name: 'Peterson' },
  { u: 'fernando', pw: 'Bebel2007', role: 'gestor', name: null },
];

// ── seed ─────────────────────────────────────────────────────
async function seed() {
  console.log('🌱 Iniciando seed do Verde Interior...\n');

  // 1. Inserir colaboradores
  const { data: emps, error: empErr } = await supabase
    .from('employees').insert(EMPLOYEES).select();
  if (empErr) { console.error('❌ employees:', empErr.message); process.exit(1); }
  console.log(`✓ ${emps.length} colaboradores inseridos`);

  const byName = Object.fromEntries(emps.map(e => [e.name, e.id]));

  // 2. Criar usuários Auth + perfis
  console.log('\nCriando usuários...');
  for (const u of USERS) {
    const empId = u.name ? byName[u.name] ?? null : null;
    const { data: au, error: ae } = await supabase.auth.admin.createUser({
      email: `${u.u}@vi.app`,
      password: u.pw,
      email_confirm: true,
      user_metadata: { username: u.u, role: u.role, employee_id: empId },
    });
    if (ae) { console.error(`  ❌ ${u.u}:`, ae.message); continue; }
    const { error: pe } = await supabase.from('profiles').insert({
      id: au.user.id, employee_id: empId, username: u.u, role: u.role,
    });
    if (pe) console.error(`  ❌ profile ${u.u}:`, pe.message);
    else console.log(`  ✓ ${u.u} (${u.role})`);
  }

  // 3. Registros de ponto de hoje
  const todayRecs = [
    { name: 'Beto',        recs: [{ type: 'entry', time: '07:55' }] },
    { name: 'Bruno',       recs: [{ type: 'entry', time: '08:10' }, { type: 'break', time: '12:00' }, { type: 'return', time: '13:00' }] },
    { name: 'Carlos',      recs: [{ type: 'entry', time: '08:05' }, { type: 'break', time: '12:00' }, { type: 'return', time: '13:00' }, { type: 'exit', time: '17:00' }] },
    { name: 'Greg',        recs: [{ type: 'entry', time: '08:05' }, { type: 'break', time: '12:00' }, { type: 'return', time: '13:00' }, { type: 'exit', time: '17:00' }] },
    { name: 'Pedro Silva', recs: [{ type: 'entry', time: '08:10' }, { type: 'break', time: '12:30' }, { type: 'return', time: '13:30' }, { type: 'exit', time: '17:15' }] },
    { name: 'Peterson',    recs: [{ type: 'entry', time: '09:15' }, { type: 'break', time: '12:00' }, { type: 'return', time: '13:05' }] },
  ];
  const todayRows = todayRecs.flatMap(({ name, recs }) =>
    recs.map(r => ({ employee_id: byName[name], date: TODAY, ...r }))
  ).filter(r => r.employee_id);
  const { error: tErr } = await supabase.from('punch_records').insert(todayRows);
  if (tErr) console.error('\n❌ today punches:', tErr.message);
  else console.log(`\n✓ ${todayRows.length} registros de hoje inseridos (${TODAY})`);

  // 4. Histórico
  const histRecs = [
    { name: 'Beto',        date: YESTERDAY, recs: [{ type: 'entry', time: '07:55' }, { type: 'break', time: '12:00' }, { type: 'return', time: '13:00' }, { type: 'exit', time: '17:05' }] },
    { name: 'Beto',        date: DAY2,      recs: [{ type: 'entry', time: '08:00' }, { type: 'break', time: '12:00' }, { type: 'return', time: '13:00' }, { type: 'exit', time: '17:00' }] },
    { name: 'Bruno',       date: YESTERDAY, recs: [{ type: 'entry', time: '08:10' }, { type: 'break', time: '12:00' }, { type: 'return', time: '13:00' }, { type: 'exit', time: '17:00' }] },
    { name: 'Pedro Silva', date: YESTERDAY, recs: [{ type: 'entry', time: '08:10' }, { type: 'break', time: '12:30' }, { type: 'return', time: '13:30' }, { type: 'exit', time: '17:15' }] },
    { name: 'Peterson',    date: YESTERDAY, recs: [{ type: 'entry', time: '09:20' }, { type: 'break', time: '12:30' }, { type: 'return', time: '13:30' }, { type: 'exit', time: '17:45' }] },
  ];
  const histRows = histRecs.flatMap(({ name, date, recs }) =>
    recs.map(r => ({ employee_id: byName[name], date, ...r }))
  ).filter(r => r.employee_id);
  const { error: hErr } = await supabase.from('punch_records').insert(histRows);
  if (hErr) console.error('❌ history:', hErr.message);
  else console.log(`✓ ${histRows.length} registros históricos inseridos`);

  // 5. Justificativas
  const justRows = [
    { employee_id: byName['Miriam'],  date: '2026-05-19', type: 'Atraso',               description: 'Consulta médica',           status: 'pendente' },
    { employee_id: byName['Greg'],    date: '2026-05-14', type: 'Falta',                description: 'Atestado médico',           status: 'pendente' },
    { employee_id: byName['Beto'],    date: '2026-05-10', type: 'Esquecimento de ponto', description: 'Esqueci de bater na saída', status: 'aprovado' },
  ].filter(j => j.employee_id);
  const { error: jErr } = await supabase.from('justifications').insert(justRows);
  if (jErr) console.error('❌ justifications:', jErr.message);
  else console.log(`✓ ${justRows.length} justificativas inseridas`);

  console.log('\n✅ Seed completo!');
}

seed().catch(e => { console.error(e); process.exit(1); });
