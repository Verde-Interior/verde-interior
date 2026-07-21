import { supabase } from './supabase.js';
import { state } from './store.js';
import { toast } from './utils.js';

let _session = null; // { role, name, employee_id, user_id }

function showErr(msg) {
  document.getElementById('lerrtxt').textContent = msg;
  document.getElementById('lerrmsg').classList.add('show');
  document.getElementById('lu').classList.add('lerr');
  document.getElementById('lp').classList.add('lerr');
}
function clearErr() {
  document.getElementById('lerrmsg').classList.remove('show');
  document.getElementById('lu').classList.remove('lerr');
  document.getElementById('lp').classList.remove('lerr');
}
function _showNav(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? '' : 'none';
}

function _buildSession(user) {
  const meta = user.user_metadata || {};
  return {
    role:        meta.role        || 'colab',
    name:        meta.username    || 'Usuário',
    employee_id: meta.employee_id || null,
    user_id:     user.id,
  };
}

export async function initSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) _session = _buildSession(data.session.user);
}

function applySession() {
  if (!_session) return;
  const badge = document.getElementById('sessao-badge');
  const wrap  = document.getElementById('sessao-wrap');

  if (_session.role === 'gestor') {
    badge.textContent = 'Gestor';
    badge.className   = 'sbadge gestor';
    _showNav('nb-admin',  true);
    _showNav('nb-config', true);
  } else {
    badge.textContent = _session.name.split(' ')[0];
    badge.className   = 'sbadge';
    const idx = state.EMP.findIndex(e => e.id === _session.employee_id);
    state.cu  = idx >= 0 ? idx : 0;
    _showNav('nb-admin',  false);
    _showNav('nb-config', false);
  }
  if (wrap) wrap.style.display = 'flex';
}

function login() {
  const u = (document.getElementById('lu').value || '').trim().toLowerCase();
  const p = (document.getElementById('lp').value || '');
  clearErr();
  if (!u || !p) {
    document.getElementById('lerrtxt').textContent = 'Preencha usuário e senha';
    document.getElementById('lerrmsg').classList.add('show');
    return;
  }
  const btn = document.getElementById('lbtn');
  document.getElementById('lbtntxt').style.display = 'none';
  document.getElementById('lspinner').style.display = 'block';
  btn.disabled = true;

  supabase.auth.signInWithPassword({ email: `${u}@vi.app`, password: p })
    .then(async ({ data, error }) => {
      if (error) {
        document.getElementById('lbtntxt').style.display = '';
        document.getElementById('lspinner').style.display = 'none';
        btn.disabled = false;
        showErr('Usuário ou senha incorretos');
        return;
      }
      _session = _buildSession(data.user);
      const { load } = await import('./store.js');
      await load();
      applySession();
      if (window.buildBars)   window.buildBars();
      if (window.renderPunch) window.renderPunch();
      if (window.requestNotifyPermission) window.requestNotifyPermission();
      if (window.startNotifyChecker)      window.startNotifyChecker();
      const el = document.getElementById('ls');
      el.classList.add('fade');
      setTimeout(() => { el.style.display = 'none'; }, 300);
      document.getElementById('lbtntxt').style.display = '';
      document.getElementById('lspinner').style.display = 'none';
      btn.disabled = false;
    });
}

function logout() {
  supabase.auth.signOut().then(() => {
    _session = null;
    document.getElementById('lu').value = '';
    document.getElementById('lp').value = '';
    clearErr();
    document.getElementById('sessao-wrap').style.display = 'none';
    const el = document.getElementById('ls');
    el.style.display = 'flex';
    el.classList.remove('fade');
    document.querySelectorAll('.vw').forEach(e => e.classList.remove('on'));
    document.querySelectorAll('.ntb').forEach(e => e.classList.remove('on'));
    document.getElementById('vw-colab').classList.add('on');
    const nc = document.getElementById('nb-colab');
    if (nc) nc.classList.add('on');
    setTimeout(() => { const lu = document.getElementById('lu'); if (lu) lu.focus(); }, 150);
  });
}

function changePassword() {
  const p1 = (document.getElementById('np1').value || '');
  const p2 = (document.getElementById('np2').value || '');
  if (p1.length < 6) { toast('Mínimo 6 caracteres', false); return; }
  if (p1 !== p2)     { toast('Senhas não coincidem', false); return; }
  supabase.auth.updateUser({ password: p1 }).then(({ error }) => {
    if (error) { toast('Erro: ' + error.message, false); return; }
    document.getElementById('np1').value = '';
    document.getElementById('np2').value = '';
    toast('✓ Senha alterada com sucesso');
  });
}

// Reset de senha (Fase 5) — colaborador esqueceu a senha.
//
// Como nossos auth users têm e-mail interno fake (`beto@vi.app`),
// o supabase.auth.resetPasswordForEmail entregaria numa caixa que não existe.
// Por isso delegamos para a Edge Function `send-reset-email`, que:
//   1. Busca o profile pelo email_recuperacao (com service_role, ignora RLS)
//   2. Gera o link de recovery via admin.generateLink
//   3. Envia direto para o e-mail real via API HTTP do Resend
//
// Requer:
//   - Migration 018 (coluna email_recuperacao em profiles)
//   - Edge Function `send-reset-email` deployada
//   - Secret RESEND_API_KEY configurada no projeto Supabase
//   - Domínio verificado no Resend (ou usar onboarding@resend.dev pra teste)
//
// Silêncio se e-mail não achado — não vaza quais estão cadastrados.
export async function solicitarResetSenha(emailReal) {
  if (!emailReal || !emailReal.includes('@')) {
    return { error: { message: 'E-mail inválido' } };
  }
  const redirectTo = new URL('/reset.html', window.location.origin).toString();
  const { data, error } = await supabase.functions.invoke('send-reset-email', {
    body: {
      email_recuperacao: emailReal.trim().toLowerCase(),
      redirect_to: redirectTo,
    },
  });
  if (error) return { error, sent: false };
  if (data?.error) return { error: { message: data.error }, sent: false };
  return { error: null, sent: !!data?.sent };
}

export const AUTH = {
  login, logout, applySession, initSession, changePassword, solicitarResetSenha,
  getSession: () => _session,
  loaded: true,
};
