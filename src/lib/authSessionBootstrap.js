/**
 * Subscribes to Supabase auth state for SPA session restore.
 * Session and "ready" state come from onAuthStateChange (INITIAL_SESSION first),
 * not from getSession().finally(), so refresh/recovery can finish before UI gates.
 *
 * If INITIAL_SESSION is null but a token exists in storage, onReady is deferred until
 * a follow-up auth event or a short timeout so protected routes do not flash /login.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   onSession: (session: import('@supabase/supabase-js').Session | null) => void,
 *   onReady: () => void,
 *   logEvents?: boolean,
 *   supabaseUrl?: string,
 *   restoreWaitMs?: number,
 * }} handlers
 * @returns {() => void} unsubscribe
 */
export function subscribeToAuthSession(
  supabase,
  { onSession, onReady, logEvents = false, supabaseUrl, restoreWaitMs = 3000 }
) {
  let ready = false;
  let awaitingRestore = false;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let restoreTimeout;

  const finishReady = () => {
    if (ready) return;
    ready = true;
    awaitingRestore = false;
    if (restoreTimeout != null) {
      clearTimeout(restoreTimeout);
      restoreTimeout = undefined;
    }
    onReady();
  };

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (logEvents) {
      console.debug('[auth]', event, session?.user?.id ?? null);
    }
    onSession(session);

    if (ready) return;

    if (session) {
      finishReady();
      return;
    }

    if (event === 'INITIAL_SESSION') {
      if (supabaseUrl && hasAuthStorageToken(supabaseUrl)) {
        awaitingRestore = true;
        restoreTimeout = setTimeout(finishReady, restoreWaitMs);
        return;
      }
      finishReady();
      return;
    }

    if (awaitingRestore) {
      finishReady();
    }
  });

  return () => {
    if (restoreTimeout != null) clearTimeout(restoreTimeout);
    subscription.unsubscribe();
  };
}

/**
 * @param {string} supabaseUrl
 */
export function hasAuthStorageToken(supabaseUrl) {
  const storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : null;
  if (!storage?.getItem) return false;
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    const key = `sb-${ref}-auth-token`;
    return storage.getItem(key) != null;
  } catch {
    return false;
  }
}

/**
 * DevTools helper: logs whether the default Supabase auth storage key exists.
 * @param {string} supabaseUrl
 */
export function logAuthStoragePresence(supabaseUrl) {
  const storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : null;
  if (!storage?.getItem) return;
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    const key = `sb-${ref}-auth-token`;
    const raw = storage.getItem(key);
    console.debug('[auth] localStorage', key, raw ? 'present' : 'missing');
  } catch (e) {
    console.debug('[auth] localStorage check failed', e);
  }
}
