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

/**
 * Public site origin for auth redirects (email confirmation, etc.).
 * Prefer `VITE_SITE_URL` in production builds so confirmation links are not tied to localhost.
 * Falls back to `window.location.origin` in the browser when unset (correct for local dev).
 */
export function getSiteOrigin() {
  const raw = (import.meta.env.VITE_SITE_URL ?? '').trim().replace(/\/$/, '');
  if (raw) return raw;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
