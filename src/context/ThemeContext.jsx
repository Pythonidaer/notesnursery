import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSupabaseBackend } from '../config/appConfig.js';
import * as profileRemote from '../data/profileSupabase.js';
import {
  applyColorSchemeToDocument,
  migrateLegacyNotesTestDarkPreference,
  readStoredColorScheme,
  writeStoredColorScheme,
} from '../utils/colorScheme.js';
import { useAuth } from './AuthContext.jsx';

const ThemeContext = createContext(null);

function readInitialColorSchemeFromDocument() {
  if (typeof document === 'undefined') return 'light';
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'dark' || t === 'light' ? t : 'light';
}

export function ThemeProvider({ children }) {
  const remote = useSupabaseBackend();
  const { user, authInitializing, profilePreferencesLoaded } = useAuth();
  const [colorScheme, setColorSchemeState] = useState(readInitialColorSchemeFromDocument);

  const setColorScheme = useCallback(
    async (nextRaw) => {
      const next = nextRaw === 'dark' ? 'dark' : 'light';
      applyColorSchemeToDocument(next);
      writeStoredColorScheme(next);
      setColorSchemeState(next);
      if (remote && user?.id) {
        try {
          await profileRemote.updateProfileColorScheme(user.id, next);
        } catch (e) {
          console.error('[theme] updateProfileColorScheme', e);
        }
      }
    },
    [remote, user?.id]
  );

  useEffect(() => {
    migrateLegacyNotesTestDarkPreference();
    const stored = readStoredColorScheme();
    if (stored) {
      applyColorSchemeToDocument(stored);
      setColorSchemeState(stored);
    }
  }, []);

  useEffect(() => {
    if (authInitializing) return;
    if (!remote || !user?.id || !profilePreferencesLoaded) return;
    if (readStoredColorScheme()) return;

    let cancelled = false;
    (async () => {
      try {
        const fromDb = await profileRemote.fetchProfileColorScheme(user.id);
        const resolved = fromDb === 'dark' ? 'dark' : 'light';
        if (!cancelled) {
          applyColorSchemeToDocument(resolved);
          writeStoredColorScheme(resolved);
          setColorSchemeState(resolved);
        }
      } catch (e) {
        console.error('[theme] fetchProfileColorScheme', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authInitializing, remote, user?.id, profilePreferencesLoaded]);

  const value = useMemo(
    () => ({
      colorScheme,
      setColorScheme,
      resolvedColorScheme: colorScheme,
    }),
    [colorScheme, setColorScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
