/**
 * Corrige usuários sem profile e cria os que estão faltando.
 * Uso: node --experimental-vm-modules scripts/fix-users.js
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_PROD_URL;
const SERVICE_KEY  = process.env.SUPABASE_PROD_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Variáveis de ambiente faltando. Rode com: node --env-file=.env scripts/fix-users.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Tatyana e Larissa já têm auth.users — só falta o profile + reset de senha
const EXISTENTES = [
  { authId: 'b306a464-cb9b-4ec2-8b96-4db89735f66f', empId: 12, username: 'tatyana',  role: 'gestor' },
  { authId: '00539fcc-1f38-420a-9c82-e6a1c2338eed', empId: 14, username: 'larissa',  role: 'colab'  },
  { authId: 'f240cb9a-b41f-427e-b6f5-36f5fd815156', empId: 13, username: 'rafael',   role: 'gestor' },
  { authId: '6817eb4e-a0a7-43c8-a454-5c05d6bd7252', empId:  9, username: 'paulo',    role: 'gestor' },
  { authId: '4bc9a5e9-f0d2-4bf2-8d7f-a9c70f2ca622', empId: 11, username: 'thamires', role: 'gestor' },
];

const NOVOS = [];

const SENHA = 'verde123';

async function run() {
  // 1. Criar profiles para quem já tem auth.users
  console.log('── Corrigindo Tatyana e Larissa ──');
  for (const u of EXISTENTES) {
    // Reset de senha
    const { error: pe } = await supabase.auth.admin.updateUserById(u.authId, { password: SENHA });
    if (pe) console.error(`  ❌ senha ${u.username}:`, pe.message);
    else console.log(`  ✓ senha ${u.username} redefinida`);

    // Inserir profile (ignora se já existir)
    const { error: prE } = await supabase.from('profiles').upsert({
      id: u.authId, employee_id: u.empId, username: u.username, role: u.role,
    }, { onConflict: 'id' });
    if (prE) console.error(`  ❌ profile ${u.username}:`, prE.message);
    else console.log(`  ✓ profile ${u.username} criado/atualizado`);
  }

  // 2. Criar auth.users + profiles para os novos
  console.log('\n── Criando Rafael, Paulo e Thamires ──');
  for (const u of NOVOS) {
    const { data: au, error: ae } = await supabase.auth.admin.createUser({
      email: `${u.username}@vi.app`,
      password: SENHA,
      email_confirm: true,
      user_metadata: { username: u.username, role: u.role, employee_id: u.empId },
    });
    if (ae) { console.error(`  ❌ auth ${u.username}:`, ae.message); continue; }

    const { error: prE } = await supabase.from('profiles').insert({
      id: au.user.id, employee_id: u.empId, username: u.username, role: u.role,
    });
    if (prE) console.error(`  ❌ profile ${u.username}:`, prE.message);
    else console.log(`  ✓ ${u.username} (${u.role}) criado`);
  }

  console.log('\nPronto!');
}

run().catch(console.error);
