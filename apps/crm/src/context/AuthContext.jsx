// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelado) {
        setSession(data.session ?? null);
        setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => {
      cancelado = true;
      sub.subscription?.unsubscribe();
    };
  }, []);

  async function entrar(usuario, senha) {
    const email = usuario.includes('@') ? usuario : `${usuario}@vi.app`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) return { ok: false, error: error.message };
    setSession(data.session);
    return { ok: true };
  }

  async function sair() {
    await supabase.auth.signOut();
    setSession(null);
  }

  const usuario = session?.user
    ? {
        id:    session.user.id,
        email: session.user.email,
        nome:  session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Usuário',
        role:  session.user.user_metadata?.role || 'colab',
      }
    : null;

  return (
    <AuthContext.Provider value={{ usuario, loading, entrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa de AuthProvider no topo da árvore');
  return ctx;
}
