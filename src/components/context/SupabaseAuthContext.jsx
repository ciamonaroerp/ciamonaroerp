import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/components/lib/supabaseClient";

const SupabaseAuthContext = createContext({ ready: false, session: null, erpUsuario: null });

export function SupabaseAuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [erpUsuario, setErpUsuario] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let initialized = false;

    async function init() {
      if (initialized) return;
      initialized = true;

      try {
        if (!supabase) {
          console.warn('[SupabaseAuth] Cliente Supabase não inicializado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
          if (!cancelled) setReady(true);
          return;
        }
        // Verifica sessão ativa no Supabase
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (currentSession?.user) {
          if (!cancelled) setSession(currentSession);
          const email = currentSession.user.email;

          // Busca dados do usuário ERP diretamente no Supabase
          const { data, error } = await supabase
            .from('erp_usuarios')
            .select('*')
            .eq('email', email)
            .maybeSingle();

          if (!error && data && !cancelled) {
            setErpUsuario(data);
            console.log('[SupabaseAuth] erpUsuario carregado:', data.email, data.perfil);
          } else {
            console.warn('[SupabaseAuth] erpUsuario não encontrado para:', email, error?.message);
          }
        } else {
          if (!cancelled) setSession(null);
          console.warn('[SupabaseAuth] Sem sessão ativa no Supabase.');
        }
      } catch (err) {
        console.warn('[SupabaseAuth] Erro ao inicializar:', err.message);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    if (!supabase) {
      init();
      return () => { cancelled = true; };
    }

    // Registra listener ANTES de chamar init() para não perder eventos
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setErpUsuario(null);
      } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && sess?.user) {
        setSession(sess);
        const { data } = await supabase
          .from('erp_usuarios')
          .select('*')
          .eq('email', sess.user.email)
          .maybeSingle();
        if (data) setErpUsuario(data);
      }
    });

    init();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <SupabaseAuthContext.Provider value={{ ready, session, erpUsuario }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  return useContext(SupabaseAuthContext);
}

export async function clearSupabaseSession() {
  try {
    if (supabase) await supabase.auth.signOut();
  } catch (_) {
    // ignora
  }
  localStorage.removeItem('erp_sb_session_v2');
}

/** Mantém compatibilidade com código que importa getSupabase */
export function getSupabase() {
  return Promise.resolve(supabase);
}