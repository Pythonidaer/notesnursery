import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSupabaseBackend } from '../config/appConfig.js';
import * as remote from '../data/notesSupabase.js';
import { useAuth } from './AuthContext.jsx';

/** @typedef {{ id: string, sourceFileName: string, title: string, bodyHtml: string, bodyMarkdown: string, contentType: string, createdAtSource: string, modifiedAtSource: string, comedyRating?: number | null, labels: string[] }} ParsedNote */

const NotesContext = createContext(null);

export function NotesProvider({ children }) {
  const { user, authInitializing } = useAuth();
  const [notes, setNotes] = useState(/** @type {ParsedNote[]} */ ([]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  /** False until the first notes list fetch for the current session/user finishes (Supabase only). Local mode is always ready. */
  const [noteListReady, setNoteListReady] = useState(() => !useSupabaseBackend());

  const userId = user?.id;
  const useRemote = useSupabaseBackend();

  useEffect(() => {
    setError(null);
    if (!useRemote) {
      setNoteListReady(true);
      return;
    }
    if (authInitializing) return;
    if (!userId) {
      setNotes([]);
      setNoteListReady(true);
      return;
    }
    let cancelled = false;
    setNoteListReady(false);
    setLoading(true);
    remote
      .fetchNotesForUser(userId)
      .then((rows) => {
        if (!cancelled) setNotes(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load notes');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setNoteListReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, authInitializing, useRemote]);

  const addNotes = useCallback(
    async (/** @type {ParsedNote[]} */ imported) => {
      if (!useRemote) {
        setNotes((prev) => [...prev, ...imported]);
        return;
      }
      if (!userId) {
        const err = new Error('Not signed in');
        setError(err.message);
        throw err;
      }
      setLoading(true);
      setError(null);
      try {
        const created = [];
        for (const note of imported) {
          const row = await remote.upsertImportedNote(userId, note);
          created.push(row);
        }
        setNotes((prev) => {
          const next = [...prev];
          for (const row of created) {
            const idx = next.findIndex((n) => n.id === row.id);
            if (idx >= 0) next[idx] = row;
            else next.push(row);
          }
          return next;
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not save notes';
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [userId, useRemote]
  );

  const updateNote = useCallback(
    async (/** @type {string} */ id, /** @type {Partial<ParsedNote>} */ updates) => {
      if (!useRemote) {
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
        return;
      }
      if (!userId) {
        const err = new Error('Not signed in');
        setError(err.message);
        throw err;
      }
      setError(null);
      try {
        await remote.updateNoteRemote(userId, id, updates);
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not update note';
        console.error('[notes] updateNote failed', { id, err: e });
        setError(msg);
        throw e;
      }
    },
    [userId, useRemote]
  );

  const deleteNote = useCallback(
    async (/** @type {string} */ id) => {
      if (!useRemote) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        return;
      }
      if (!userId) {
        const err = new Error('Not signed in');
        setError(err.message);
        throw err;
      }
      setError(null);
      try {
        await remote.deleteNoteRemote(userId, id);
        setNotes((prev) => prev.filter((n) => n.id !== id));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not delete note';
        console.error('[notes] deleteNote failed', { id, err: e });
        setError(msg);
        throw e;
      }
    },
    [userId, useRemote]
  );

  const value = useMemo(
    () => ({
      notes,
      loading,
      noteListReady,
      error,
      addNotes,
      updateNote,
      deleteNote,
    }),
    [notes, loading, noteListReady, error, addNotes, updateNote, deleteNote]
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) {
    throw new Error('useNotes must be used within NotesProvider');
  }
  return ctx;
}
