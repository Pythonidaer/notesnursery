/**
 * Subscribes to Supabase auth state for SPA session restore.
 * Session and "ready" state come from onAuthStateChange (INITIAL_SESSION first),
 * not from getSession().finally(), so refresh/recovery can finish before UI gates.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   onSession: (session: import('@supabase/supabase-js').Session | null) => void,
 *   onReady: () => void,
 *   logEvents?: boolean,
 * }} handlers
 * @returns {() => void} unsubscribe
 */
export function subscribeToAuthSession(supabase, { onSession, onReady, logEvents = false }) {
  let ready = false;

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (logEvents) {
      console.debug('[auth]', event, session?.user?.id ?? null);
    }
    onSession(session);
    if (!ready) {
      ready = true;
      onReady();
    }
  });

  return () => subscription.unsubscribe();
}

/**
 * DevTools helper: logs whether the default Supabase auth storage key exists.
 * @param {string} supabaseUrl
 */
export function logAuthStoragePresence(supabaseUrl) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    const key = `sb-${ref}-auth-token`;
    const raw = localStorage.getItem(key);
    console.debug('[auth] localStorage', key, raw ? 'present' : 'missing');
  } catch (e) {
    console.debug('[auth] localStorage check failed', e);
  }
}
