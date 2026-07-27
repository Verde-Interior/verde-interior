/**
 * Copia dados de produção para staging (READ-ONLY em prod, WRITE em staging).
 * Copia: clientes, cliente_servicos, agenda (últimos 60 dias), leads, ordens_servico, tarefas.
 *
 * Uso: node scripts/sync-prod-to-staging.js
 *
 * NÃO altera nada em produção. Apenas lê.
 */
import { createClient } from '@supabase/supabase-js';

const PROD_URL = 'https://mcaqxfogzvrqqnoixptv.supabase.co';
const PROD_SR  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jYXF4Zm9nenZycXFub2l4cHR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTExMDMzMiwiZXhwIjoyMDk2Njg2MzMyfQ.sk62pxMNzwivOtFu-j54OvUQ1OJQZvQDKcRfsyaKyvk';

const STG_URL = 'https://geyyxjbnnmiejssqjrwl.supabase.co';
const STG_SR  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdleXl4amJubm1pZWpzc3FqcndsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTE2MDg3NSwiZXhwIjoyMTAwNzM2ODc1fQ.Lk-Wf9boH2Coiagk14F8sqojno_eybNk5cbCcmQ_HRQ';

const prod = createClient(PROD_URL, PROD_SR, { auth: { persistSession: false } });
const stg  = createClient(STG_URL,  STG_SR,  { auth: { persistSession: false } });

async function copiarTabela(nome, opts = {}) {
  const { filtro, transform, onConflict = 'id' } = opts;
  process.stdout.write(`  Copiando ${nome}... `);

  let query = prod.from(nome).select('*');
  if (filtro) query = filtro(query);
  const { data: rows, error: readErr } = await query;
  if (readErr) { console.error('❌ leitura:', readErr.message); return 0; }
  if (!rows || rows.length === 0) { console.log('vazio'); return 0; }

  const payload = transform ? rows.map(transform) : rows;

  // Upsert em lotes de 100 pra evitar payload gigante
  let inseridos = 0;
  for (let i = 0; i < payload.length; i += 100) {
    const lote = payload.slice(i, i + 100);
    const { error: writeErr } = await stg.from(nome).upsert(lote, { onConflict });
    if (writeErr) { console.error(`\n    ❌ lote ${i}:`, writeErr.message); return inseridos; }
    inseridos += lote.length;
  }
  console.log(`${inseridos} linhas`);
  return inseridos;
}

async function run() {
  console.log('── Sync PROD → STAGING ──');
  console.log(`PROD:    ${PROD_URL}`);
  console.log(`STAGING: ${STG_URL}\n`);

  // Ordem importa por causa de FKs
  await copiarTabela('clientes');
  await copiarTabela('cliente_servicos');
  await copiarTabela('leads');
  await copiarTabela('ordens_servico');
  await copiarTabela('materiais');

  // Agenda: só os últimos 60 dias pra staging não ficar gigante
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 60);
  const dataStr = dataLimite.toISOString().slice(0, 10);
  await copiarTabela('agenda', {
    filtro: q => q.gte('data_agendada', dataStr),
  });

  await copiarTabela('tarefas');

  console.log('\n✓ Sync concluído.');
}

run().catch(err => { console.error(err); process.exit(1); });
