// supabase/functions/admin-reset-password/index.ts
// Edge Function para o gestor redefinir a senha de qualquer colaborador.
// Usa a SERVICE_ROLE_KEY (nunca exposta no cliente).
//
// Deploy:
//   supabase functions deploy admin-reset-password
//
// Uso do cliente (após deploy):
//   const { data, error } = await supabase.functions.invoke('admin-reset-password', {
//     body: { user_id: 'uuid-do-colaborador', nova_senha: 'senha_temp_123' },
//   });
//
// Segurança:
//   - Verifica JWT do chamador
//   - Confirma que o chamador tem role='gestor' em profiles
//   - Só então usa SERVICE_ROLE_KEY para trocar a senha

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401);
    }

    // 1. Verifica quem é o chamador via anon client + token do usuário
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: 'Invalid token' }, 401);
    }

    // 2. Confirma que o chamador é gestor
    const { data: caller } = await anonClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (caller?.role !== 'gestor') {
      return json({ error: 'Forbidden — only gestor can reset passwords' }, 403);
    }

    // 3. Body: { user_id, nova_senha }
    const { user_id, nova_senha } = await req.json();
    if (!user_id || !nova_senha || nova_senha.length < 6) {
      return json({ error: 'user_id and nova_senha (min 6 chars) required' }, 400);
    }

    // 4. Usa SERVICE_ROLE_KEY para atualizar a senha do alvo
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user_id, {
      password: nova_senha,
    });
    if (updateErr) {
      return json({ error: updateErr.message }, 500);
    }

    return json({ success: true }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
