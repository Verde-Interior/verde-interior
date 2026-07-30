/**
 * Seed do banco staging (verde-interior-staging) com os mesmos users da produção.
 * Todas as senhas ficam como 'verde123' para facilitar os testes.
 *
 * Uso: node tools/seed-staging.js
 *
 * ATENÇÃO: Nunca rodar contra produção. Este script cria/atualiza users.
 */
import { createClient } from '@supabase/supabase-js';

const STAGING_URL          = process.env.SUPABASE_STAGING_URL;
const STAGING_SERVICE_ROLE = process.env.SUPABASE_STAGING_SERVICE_KEY;

if (!STAGING_URL || !STAGING_SERVICE_ROLE) {
  console.error('❌ Variáveis de ambiente faltando. Rode com: node --env-file=.env scripts/seed-staging.js');
  process.exit(1);
}

// Snapshot dos users em produção — 27/07/2026.
const USERS = [
  { id: 1,  name: 'Beto',       cargo: 'TI',           contract: 'CLT', j: 8, username: 'beto',     role: 'gestor', email_rec: 'betoflaquer@gmail.com' },
  { id: 3,  name: 'Bruno',      cargo: 'Campo',        contract: 'CLT', j: 8, username: 'bruno',    role: 'colab' },
  { id: 4,  name: 'Carlos',     cargo: 'Campo',        contract: 'CLT', j: 8, username: 'carlos',   role: 'colab' },
  { id: 5,  name: 'Gregório',   cargo: 'Facilities',   contract: 'CLT', j: 8, username: 'greg',     role: 'colab', email_rec: 'gregfreitas@gmail.com' },
  { id: 6,  name: 'Mirian',     cargo: 'Campo',        contract: 'CLT', j: 8, username: 'mirian',   role: 'colab' },
  { id: 7,  name: 'Pedro Silva',cargo: 'Campo',        contract: 'CLT', j: 8, username: 'pedro',    role: 'colab' },
  { id: 8,  name: 'Peterson',   cargo: 'Campo',        contract: 'CLT', j: 8, username: 'peterson', role: 'colab' },
  { id: 9,  name: 'Paulo',      cargo: 'Sócio/Campo',  contract: 'CLT', j: 8, username: 'paulo',    role: 'gestor' },
  { id: 10, name: 'Fernando',   cargo: 'Sócio',        contract: 'PJ',  j: 8, username: 'fernando', role: 'gestor' },
  { id: 11, name: 'Thamires',   cargo: 'Rh',           contract: 'CLT', j: 8, username: 'thamires', role: 'gestor' },
  { id: 12, name: 'Tatyana',    cargo: 'Sócia',        contract: 'PJ',  j: 8, username: 'tatyana',  role: 'gestor' },
  { id: 13, name: 'Rafael',     cargo: 'Sócio',        contract: 'PJ',  j: 8, username: 'rafael',   role: 'gestor' },
  { id: 14, name: 'Larissa',    cargo: 'Campo',        contract: 'CLT', j: 8, username: 'larissa',  role: 'colab' },
  { id: 15, name: 'Nicole',     cargo: 'Campo',        contract: 'CLT', j: 8, username: 'nicole',   role: 'colab' },
  { id: 17, name: 'Kawany',     cargo: 'Campo',        contract: 'CLT', j: 8, username: 'kawany',   role: 'colab' },
];

const SENHA = 'verde123';

const supa = createClient(STAGING_URL, STAGING_SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log('── Seed do staging ──');
  console.log(`URL: ${STAGING_URL}`);
  console.log(`Users: ${USERS.length}`);
  console.log('');

  for (const u of USERS) {
    // 1. Insert employee (com ID fixo pra manter FK consistente)
    const { error: empErr } = await supa.from('employees').upsert({
      id:            u.id,
      name:          u.name,
      cargo:         u.cargo,
      contract_type: u.contract,
      daily_hours:   u.j,
    }, { onConflict: 'id' });
    if (empErr) { console.error(`  ❌ employee ${u.username}:`, empErr.message); continue; }

    // 2. Auth user — tenta criar; se já existe, atualiza senha + metadata
    const email = `${u.username}@vi.app`;
    let authId;
    const { data: created, error: createErr } = await supa.auth.admin.createUser({
      email,
      password: SENHA,
      email_confirm: true,
      user_metadata: { username: u.username, role: u.role, employee_id: u.id },
    });

    if (createErr) {
      // Usuário já existe — busca pelo email e atualiza
      const { data: list } = await supa.auth.admin.listUsers({ perPage: 200 });
      const existing = list?.users?.find(x => x.email === email);
      if (!existing) { console.error(`  ❌ auth ${u.username}:`, createErr.message); continue; }
      authId = existing.id;
      const { error: updErr } = await supa.auth.admin.updateUserById(authId, {
        password: SENHA,
        user_metadata: { username: u.username, role: u.role, employee_id: u.id },
      });
      if (updErr) { console.error(`  ❌ update ${u.username}:`, updErr.message); continue; }
    } else {
      authId = created.user.id;
    }

    // 3. Employee: preenche as colunas de identidade (fase 2: profiles foi mergeado)
    const { error: prErr } = await supa
      .from('employees')
      .update({
        auth_user_id:      authId,
        username:          u.username,
        role:              u.role,
        email_recuperacao: u.email_rec ?? null,
      })
      .eq('id', u.id);
    if (prErr) { console.error(`  ❌ employee update ${u.username}:`, prErr.message); continue; }

    console.log(`  ✓ ${u.name} (${u.role}) — login: ${u.username} / senha: ${SENHA}`);
  }

  console.log('\n✓ Seed concluído.');
  console.log(`\nTodos os users criados com senha "${SENHA}".`);
}

run().catch(err => { console.error(err); process.exit(1); });
