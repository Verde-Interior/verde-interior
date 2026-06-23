import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Verificar que o caller é gestor
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) return json({ error: 'Não autenticado' }, 401);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'gestor') return json({ error: 'Sem permissão' }, 403);

  const { username, password, employee_id } = await req.json();
  if (!username || !password) return json({ error: 'username e password obrigatórios' }, 400);

  const { data, error } = await supabase.auth.admin.createUser({
    email: `${username}@vi.app`,
    password,
    email_confirm: true,
    user_metadata: { username, role: 'colab', employee_id },
  });
  if (error) return json({ error: error.message }, 400);

  const { error: pe } = await supabase.from('profiles').insert({
    id: data.user.id, employee_id, username, role: 'colab',
  });
  if (pe) return json({ error: pe.message }, 400);

  return json({ ok: true, user_id: data.user.id });
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
