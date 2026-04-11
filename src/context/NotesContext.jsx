import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSupabaseBackend } from '../config/appConfig.js';
import * as remote from '../data/notesSupabase.js';
import { useAuth } from './AuthContext.jsx';

/** @typedef {{ id: string, sourceFileName: string, title: string, bodyHtml: string, createdAtSource: string, modifiedAtSource: string, labels: string[] }} ParsedNote */

const NotesContext = createContext(null);

export function NotesProvider({ children }) {
  const { user, authInitializing } = useAuth();
  const [notes, setNotes] = useState(/** @type {ParsedNote[]} */ ([]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  const userId = user?.id;
  const useRemote = useSupabaseBackend();

  useEffect(() => {
    setError(null);
    if (!useRemote) {
      return;
    }
    if (authInitializing) return;
    if (!userId) {
      setNotes([]);
      return;
    }
    let cancelled = false;
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
        if (!cancelled) setLoading(false);
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
      console.log('[notes] addNotes start', { count: imported.length });
      try {
        const created = [];
        for (const note of imported) {
          const row = await remote.upsertImportedNote(userId, note);
          created.push(row);
        }
        console.log('[notes] addNotes ok', { saved: created.length });
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
        console.log('[notes] updateNote ok (local)', { id });
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
        console.log('[notes] updateNote ok', { id });
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
        console.log('[notes] deleteNote start (local)', { id });
        setNotes((prev) => prev.filter((n) => n.id !== id));
        console.log('[notes] deleteNote ok (local)');
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
        console.log('[notes] deleteNote ok (remote)', { id });
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
      error,
      addNotes,
      updateNote,
      deleteNote,
    }),
    [notes, loading, error, addNotes, updateNote, deleteNote]
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
