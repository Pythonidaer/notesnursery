import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSupabaseBackend } from '../config/appConfig.js';
import * as profileRemote from '../data/profileSupabase.js';
import { getSupabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

/**
 * Returns the current user from Supabase Auth, or null if unavailable / not signed in.
 * Safe to call when Supabase backend is disabled (returns null).
 */
export async function getCurrentUser() {
  if (!useSupabaseBackend()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    console.error('[auth] getCurrentUser', error);
    return null;
  }
  if (user) return user;
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.user ?? null;
}

export function AuthProvider({ children }) {
  const useRemote = useSupabaseBackend();
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [lastError, setLastError] = useState(/** @type {string | null} */ (null));
  const [defaultLabelId, setDefaultLabelId] = useState(/** @type {string | null} */ (null));
  const [defaultLabelName, setDefaultLabelName] = useState(/** @type {string | null} */ (null));
  const [profilePreferencesLoaded, setProfilePreferencesLoaded] = useState(() => !useRemote);

  useEffect(() => {
    if (!useRemote) {
      setInitializing(false);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setInitializing(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, [useRemote]);

  useEffect(() => {
    if (!useRemote) {
      setDefaultLabelId(null);
      setDefaultLabelName(null);
      setProfilePreferencesLoaded(true);
      return;
    }
    if (initializing) {
      setProfilePreferencesLoaded(false);
      return;
    }
    const userId = session?.user?.id;
    if (!userId) {
      setDefaultLabelId(null);
      setDefaultLabelName(null);
      setProfilePreferencesLoaded(true);
      return;
    }

    let cancelled = false;
    setProfilePreferencesLoaded(false);
    profileRemote
      .fetchProfileDefaultLabel(userId)
      .then((p) => {
        if (!cancelled) {
          setDefaultLabelId(p.defaultLabelId);
          setDefaultLabelName(p.defaultLabelName);
        }
      })
      .catch((e) => {
        console.error('[auth] fetchProfileDefaultLabel', e);
        if (!cancelled) {
          setDefaultLabelId(null);
          setDefaultLabelName(null);
        }
      })
      .finally(() => {
        if (!cancelled) setProfilePreferencesLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [useRemote, initializing, session?.user?.id]);

  const applyDefaultLabelPreference = useCallback((id, name) => {
    setDefaultLabelId(id);
    setDefaultLabelName(name);
  }, []);

  const signIn = useCallback(async (email, password) => {
    setLastError(null);
    if (!useSupabaseBackend()) {
      const msg = 'Sign in requires production mode with Supabase env vars.';
      setLastError(msg);
      return { error: new Error(msg) };
    }
    const supabase = getSupabase();
    if (!supabase) {
      const msg = 'Supabase client is not available.';
      setLastError(msg);
      return { error: new Error(msg) };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[auth] signIn', error);
      setLastError(error.message);
      return { error };
    }
    console.log('[auth] login success');
    return { error: null };
  }, []);

  const signUp = useCallback(async ({ email, password, username }) => {
    setLastError(null);
    if (!useSupabaseBackend()) {
      const msg = 'Sign up requires production mode with Supabase env vars.';
      setLastError(msg);
      return { error: new Error(msg) };
    }
    const supabase = getSupabase();
    if (!supabase) {
      const msg = 'Supabase client is not available.';
      setLastError(msg);
      return { error: new Error(msg) };
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error('[auth] signUp', error);
      setLastError(error.message);
      return { error };
    }

    const uid = data.user?.id;
    if (uid && username?.trim()) {
      const { error: profileError } = await supabase.from('profiles').upsert(
        { id: uid, username: username.trim() },
        { onConflict: 'id' }
      );
      if (profileError) {
        console.error('[auth] profiles upsert', profileError);
        setLastError(profileError.message);
        return { error: profileError };
      }
    }

    console.log('[auth] signup success', uid ? `(user id ${uid})` : '(awaiting confirmation?)');
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    setLastError(null);
    if (!useSupabaseBackend()) return;
    const supabase = getSupabase();
    await supabase?.auth.signOut();
  }, []);

  const user = session?.user ?? null;

  const value = useMemo(
    () => ({
      session,
      user,
      isAuthenticated: Boolean(user),
      /** @deprecated use isAuthenticated — kept for older screens */
      isLoggedIn: Boolean(user),
      authInitializing: initializing,
      authError: lastError,
      setAuthError: setLastError,
      defaultLabelId,
      defaultLabelName,
      profilePreferencesLoaded,
      applyDefaultLabelPreference,
      signIn,
      signUp,
      signOut,
    }),
    [
      session,
      user,
      initializing,
      lastError,
      defaultLabelId,
      defaultLabelName,
      profilePreferencesLoaded,
      applyDefaultLabelPreference,
      signIn,
      signUp,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
