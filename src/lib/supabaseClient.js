import { createClient } from '@supabase/supabase-js';
import {
  isSupabaseConfigured,
  useSupabaseBackend,
  VITE_SUPABASE_ANON_KEY,
  VITE_SUPABASE_URL,
} from '../config/appConfig.js';

let client = null;

/**
 * Returns a singleton Supabase client, or null when not configured / not in Supabase mode.
 */
export function getSupabase() {
  if (!useSupabaseBackend() || !isSupabaseConfigured()) {
    return null;
  }
  if (!client) {
    client = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

/**
 * TEMP (local dev only): expose session token for testing Edge Functions from Node.
 * Browser console: `await getToken()` then pass to `SUPABASE_ACCESS_TOKEN=... npm run test:embed`.
 * Remove before shipping if you prefer zero globals; gated off in production builds.
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.getToken = async () => {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };
}
