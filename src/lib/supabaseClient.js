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
