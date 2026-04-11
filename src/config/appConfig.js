/**
 * Environment-driven app mode. Vite exposes env vars as import.meta.env.VITE_*.
 * @type {'local' | 'production'}
 */
export const APP_MODE = import.meta.env.VITE_APP_MODE === 'production' ? 'production' : 'local';

export const VITE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const VITE_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/** Local dev: in-memory notes, no required auth. */
export function isLocalMode() {
  return APP_MODE !== 'production';
}

/** Production: Supabase auth + Postgres when configured. */
export function isProductionMode() {
  return APP_MODE === 'production';
}

export function isSupabaseConfigured() {
  return Boolean(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY);
}

/**
 * True when we should use Supabase for auth and data (production mode + env present).
 */
export function useSupabaseBackend() {
  return isProductionMode() && isSupabaseConfigured();
}

/** Save/create flows that require login only apply in production with Supabase. */
export function requiresAuthForPersistence() {
  return useSupabaseBackend();
}
