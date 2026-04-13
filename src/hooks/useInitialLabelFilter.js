import { useLayoutEffect, useRef, useState } from 'react';

/**
 * One-time label filter initialization from profile default (Supabase).
 * After init, `setLabelFilter` is fully controlled by the caller.
 *
 * @param {{
 *   defaultLabelName: string | null,
 *   profilePreferencesLoaded: boolean,
 *   useRemote: boolean,
 *   userId: string | undefined,
 * }} opts
 * @returns {readonly [string, (v: string | ((prev: string) => string)) => void]}
 */
export function useInitialLabelFilter({
  defaultLabelName,
  profilePreferencesLoaded,
  useRemote,
  userId,
}) {
  const [labelFilter, setLabelFilter] = useState('all');
  const didInit = useRef(false);
  const lastUserId = useRef(userId);

  useLayoutEffect(() => {
    if (lastUserId.current !== userId) {
      didInit.current = false;
      lastUserId.current = userId;
    }
  }, [userId]);

  useLayoutEffect(() => {
    if (didInit.current) return;

    if (!useRemote) {
      setLabelFilter('all');
      didInit.current = true;
      return;
    }
    if (!userId) {
      setLabelFilter('all');
      didInit.current = true;
      return;
    }
    if (!profilePreferencesLoaded) return;

    setLabelFilter(defaultLabelName ?? 'all');
    didInit.current = true;
  }, [defaultLabelName, profilePreferencesLoaded, useRemote, userId]);

  return [labelFilter, setLabelFilter];
}
