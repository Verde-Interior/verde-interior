// supabase/functions/send-reset-email/index.ts
// Envia link de redefinição de senha usando a API HTTP do Resend
// (em vez do SMTP nativo do Supabase).
//
// Por que? Porque nossos usuários têm auth email interno (`beto@vi.app`)
// e o Supabase resetPasswordForEmail entrega no endereço registrado — não
// existe caixa em `@vi.app`. Aqui pegamos o e-mail real de `profiles.email_recuperacao`
// e enviamos DIRETO pra ele com o link de recovery gerado pela admin API.
//
// Deploy:
//   supabase functions deploy send-reset-email
//
// Secrets necessárias (rode no PowerShell, dentro de apps/ponto):
//   supabase secrets set RESEND_API_KEY=re_xxxxx
//   supabase secrets set RESEND_FROM=noreply@verdeinterior.com.br   (opcional, default onboarding@resend.dev)
//   supabase secrets set RESEND_FROM_NAME="Verde Interior"          (opcional)

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
    const { email_recuperacao, redirect_to } = await req.json();

    if (!email_recuperacao || typeof email_recuperacao !== 'string' || !email_recuperacao.includes('@')) {
      return json({ error: 'E-mail inválido' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Encontra o profile pelo email_recuperacao
    const { data: profile } = await admin
      .from('profiles')
      .select('username')
      .eq('email_recuperacao', email_recuperacao.trim().toLowerCase())
      .maybeSingle();

    // Silêncio se não achou — não vaza quais e-mails estão cadastrados
    if (!profile) return json({ sent: false }, 200);

    // 2. Gera o link de recovery via admin API do Supabase
    const authEmail = `${profile.username}@vi.app`;
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: authEmail,
      options: redirect_to ? { redirectTo: redirect_to } : undefined,
    });

    if (linkErr) return json({ error: 'Falha ao gerar link: ' + linkErr.message }, 500);

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) return json({ error: 'Link não retornado pela Supabase' }, 500);

    // 3. Envia o e-mail via API HTTP do Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY não configurada' }, 500);

    const RESEND_FROM      = Deno.env.get('RESEND_FROM')      || 'onboarding@resend.dev';
    const RESEND_FROM_NAME = Deno.env.get('RESEND_FROM_NAME') || 'Verde Interior';

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb">
        <div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
          <h1 style="color:#2d5a1b;font-size:22px;margin:0 0 12px">🔐 Redefinir sua senha</h1>
          <p style="color:#374151;font-size:14px;line-height:1.55">Olá!</p>
          <p style="color:#374151;font-size:14px;line-height:1.55">
            Recebemos um pedido para redefinir sua senha no <strong>Verde Interior Ponto</strong>.
            Clique no botão abaixo para escolher uma nova senha:
          </p>
          <p style="text-align:center;margin:28px 0">
            <a href="${actionLink}"
               style="display:inline-block;background:#2d5a1b;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
              Redefinir senha
            </a>
          </p>
          <p style="color:#6b7280;font-size:12px;line-height:1.55">
            Se o botão não funcionar, cole este link no navegador:
          </p>
          <p style="word-break:break-all;color:#2d5a1b;font-size:11px;background:#f3f4f6;padding:8px 10px;border-radius:6px">
            ${actionLink}
          </p>
          <p style="color:#9ca3af;font-size:12px;line-height:1.55;margin-top:20px">
            Se você não solicitou essa alteração, pode ignorar este e-mail com segurança — sua senha não será alterada.
          </p>
          <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0">
            Verde Interior — Ponto &amp; Banco de Horas
          </p>
        </div>
      </div>
    `.trim();

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    `${RESEND_FROM_NAME} <${RESEND_FROM}>`,
        to:      [email_recuperacao.trim().toLowerCase()],
        subject: 'Redefina sua senha — Verde Interior Ponto',
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return json({ error: `Resend: ${errBody}` }, 500);
    }

    return json({ sent: true }, 200);
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
