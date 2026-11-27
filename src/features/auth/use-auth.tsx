'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createBrowserSupabase, isAuthConfigured } from '../../lib/supabase/browser.ts';
import type { UserProfile, UserStats } from '../../auth/validation.ts';

export type AuthUser = { id: string; email?: string };

type AuthContextValue = {
  enabled: boolean;
  loading: boolean;
  user: AuthUser | null;
  profile: UserProfile | null;
  stats: UserStats | null;
  refresh: () => Promise<void>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string; unconfirmed?: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  enabled: false,
  loading: false,
  user: null,
  profile: null,
  stats: null,
  refresh: async () => {},
  signIn: async () => ({ ok: false, error: 'Autenticação indisponível.' }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const enabled = isAuthConfigured();
  const [loading, setLoading] = useState(enabled);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        user: AuthUser | null;
        profile: UserProfile | null;
        stats: UserStats | null;
      };
      setUser(data.user);
      setProfile(data.profile);
      setStats(data.stats);
    } catch {
      // Ignora falha de rede silenciosamente
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [enabled, refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const supabase = createBrowserSupabase();
      if (!supabase) return { ok: false as const, error: 'Autenticação indisponível.' };
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('email not confirmed')) {
          return {
            ok: false as const,
            error: 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.',
            unconfirmed: true,
          };
        }
        return { ok: false as const, error: 'E-mail ou senha incorretos.' };
      }
      await refresh();
      return { ok: true as const };
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    const supabase = createBrowserSupabase();
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setStats(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ enabled, loading, user, profile, stats, refresh, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
