/** Canonical localStorage key for appearance (must match inline script in index.html). */
export const COLOR_SCHEME_STORAGE_KEY = 'notesNursery_colorScheme';

/** Legacy notes-test-only key; migrated once to canonical. */
export const LEGACY_NOTES_TEST_DARK_BG_KEY = 'notesNursery_notesTestUseDarkBg';

/** @param {unknown} raw */
export function normalizeColorScheme(raw) {
  return raw === 'dark' || raw === 'light' ? raw : null;
}

/**
 * @returns {'light' | 'dark' | null} null if unset (client should treat as provisional light until profile reconciles)
 */
export function readStoredColorScheme() {
  if (typeof localStorage === 'undefined') return null;
  try {
    return normalizeColorScheme(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** @param {'light' | 'dark'} scheme */
export function writeStoredColorScheme(scheme) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme);
  } catch {
    /* ignore quota / private mode */
  }
}

/** @param {'light' | 'dark'} scheme */
export function applyColorSchemeToDocument(scheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', scheme);
  document.documentElement.setAttribute('data-notes-canvas', scheme);
  document.documentElement.style.colorScheme = scheme;
}

/**
 * Migrate legacy notes-test dark flag into canonical storage.
 * @returns {'light' | 'dark' | null} effective stored scheme after migration, or null if still unset
 */
export function migrateLegacyNotesTestDarkPreference() {
  if (typeof localStorage === 'undefined') return null;
  try {
    let v = normalizeColorScheme(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY));
    if (v) return v;
    if (localStorage.getItem(LEGACY_NOTES_TEST_DARK_BG_KEY) === '1') {
      writeStoredColorScheme('dark');
      localStorage.removeItem(LEGACY_NOTES_TEST_DARK_BG_KEY);
      return 'dark';
    }
  } catch {
    /* ignore */
  }
  return null;
}
