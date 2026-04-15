import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * @typedef {{ audioEl: HTMLAudioElement, anchorEl: HTMLElement, label: string }} ActiveNoteAudioPlayback
 */

const NoteEditFloatingAudioContext = createContext(
  /** @type {null | {
 *   active: ActiveNoteAudioPlayback | null,
 *   setActivePlayback: (p: ActiveNoteAudioPlayback | null) => void,
 *   clearActivePlayback: (audioEl: HTMLAudioElement) => void,
 *   dockUiVisible: boolean,
 *   setDockUiVisible: (v: boolean) => void,
 * }} */ (null)
);

/**
 * Only mount around the note-detail rich editor in edit mode so floating dock + registration
 * do not run in the floating composer or read view.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export function NoteEditFloatingAudioProvider({ children }) {
  const [active, setActive] = useState(/** @type {ActiveNoteAudioPlayback | null} */ (null));
  const [dockUiVisible, setDockUiVisible] = useState(false);

  const setActivePlayback = useCallback((payload) => {
    if (import.meta.env.DEV) {
      console.debug('[floating-audio] setActivePlayback', {
        label: payload?.label,
        anchorConnected: payload?.anchorEl?.isConnected,
      });
    }
    setActive(payload);
  }, []);

  const clearActivePlayback = useCallback((audioEl) => {
    setActive((prev) => (prev && prev.audioEl === audioEl ? null : prev));
  }, []);

  const value = useMemo(
    () => ({
      active,
      setActivePlayback,
      clearActivePlayback,
      dockUiVisible,
      setDockUiVisible,
    }),
    [active, setActivePlayback, clearActivePlayback, dockUiVisible]
  );

  return (
    <NoteEditFloatingAudioContext.Provider value={value}>{children}</NoteEditFloatingAudioContext.Provider>
  );
}

/**
 * @returns {null | {
 *   active: ActiveNoteAudioPlayback | null,
 *   setActivePlayback: (p: ActiveNoteAudioPlayback | null) => void,
 *   clearActivePlayback: (audioEl: HTMLAudioElement) => void,
 *   dockUiVisible: boolean,
 *   setDockUiVisible: (v: boolean) => void,
 * }}
 */
export function useNoteEditFloatingAudio() {
  return useContext(NoteEditFloatingAudioContext);
}
