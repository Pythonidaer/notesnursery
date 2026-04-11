import { getSupabase } from '../lib/supabaseClient.js';
import { normalizeLabel } from '../utils/noteLabels.js';

/**
 * App note shape (camelCase) ↔ `public.notes` (snake_case).
 *
 * Intended DB columns are defined in `supabase/schema.sql`. Optional Apple Notes
 * metadata (`created_at_source`, `modified_at_source`) may be missing on older
 * projects; inserts omit those keys when empty so PostgREST does not reference
 * absent columns. Apply `supabase/migrations/001_notes_metadata_columns.sql`
 * (or the full schema) so imports can persist metadata.
 */

/**
 * @param {unknown} err
 * @param {string} context
 */
function logSupabaseNotesError(context, err) {
  console.error(`[db] ${context}`, err);
  const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : '';
  if (/schema cache|Could not find the .* column/i.test(msg)) {
    console.warn(
      '[db] Hint: `public.notes` may be missing columns. Compare the remote DB to `supabase/schema.sql` or run migrations under `supabase/migrations/`.'
    );
  }
}

/**
 * Row for `.from('notes').insert(...)`. Only includes optional metadata columns
 * when they have non-empty values so minimal / legacy schemas still accept rows.
 *
 * @param {string} userId
 * @param {{ title?: string, bodyHtml?: string, sourceFileName?: string, createdAtSource?: string, modifiedAtSource?: string }} note
 * @returns {Record<string, unknown>}
 */
function buildNotesInsertRow(userId, note) {
  const row = {
    user_id: userId,
    title: note.title ?? '',
    body_html: note.bodyHtml ?? '',
    source_file_name: note.sourceFileName ?? '',
  };
  const cas = note.createdAtSource != null ? String(note.createdAtSource).trim() : '';
  const mas = note.modifiedAtSource != null ? String(note.modifiedAtSource).trim() : '';
  if (cas) row.created_at_source = cas;
  if (mas) row.modified_at_source = mas;
  return row;
}

/**
 * @param {string} userId
 * @param {{ title?: string, bodyHtml?: string, sourceFileName?: string, createdAtSource?: string, modifiedAtSource?: string }} note
 */
async function insertNotesRowRaw(userId, note) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const row = buildNotesInsertRow(userId, note);
  return supabase.from('notes').insert(row).select().single();
}

/**
 * @param {object} row
 * @returns {{ id: string, title: string, bodyHtml: string, sourceFileName: string, createdAtSource: string, modifiedAtSource: string, labels: string[] }}
 */
function mapRowToNote(row) {
  const nl = row.note_labels ?? [];
  const labels = nl
    .map((x) => (x.labels && x.labels.name ? String(x.labels.name) : null))
    .filter(Boolean);
  return {
    id: row.id,
    title: row.title ?? '',
    bodyHtml: row.body_html ?? '',
    sourceFileName: row.source_file_name ?? '',
    createdAtSource: row.created_at_source ?? '',
    modifiedAtSource: row.modified_at_source ?? '',
    labels,
  };
}

async function getOrCreateLabelId(userId, rawName) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const name = normalizeLabel(rawName);
  if (!name) throw new Error('Invalid label');

  const { data: existing, error: selErr } = await supabase
    .from('labels')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing?.id) {
    console.log('[db] label found', { userId, name });
    return existing.id;
  }

  console.log('[db] label create', { userId, name });
  const { data: created, error: insErr } = await supabase
    .from('labels')
    .insert({ user_id: userId, name })
    .select('id')
    .single();
  if (insErr) throw insErr;
  return created.id;
}

/**
 * Replace join rows for a note.
 * @param {string} noteId
 * @param {string} userId
 * @param {string[]} labelNames
 */
export async function syncNoteLabels(noteId, userId, labelNames) {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error: delErr } = await supabase.from('note_labels').delete().eq('note_id', noteId);
  if (delErr) throw delErr;

  const uniq = [];
  const seen = new Set();
  for (const raw of labelNames ?? []) {
    const n = normalizeLabel(raw);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(n);
  }

  console.log('[db] syncNoteLabels', { noteId, userId, labelCount: uniq.length });

  for (const name of uniq) {
    const labelId = await getOrCreateLabelId(userId, name);
    const { error } = await supabase.from('note_labels').insert({ note_id: noteId, label_id: labelId });
    if (error) throw error;
  }
}

/**
 * @param {string} userId
 */
const SELECT_NOTE_WITH_LABELS = `
  *,
  note_labels (
    labels (
      name
    )
  )
`;

/**
 * @param {string} userId
 * @param {string} noteId
 */
export async function fetchNoteById(userId, noteId) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('notes')
    .select(SELECT_NOTE_WITH_LABELS)
    .eq('id', noteId)
    .eq('user_id', userId)
    .single();

  if (error) {
    logSupabaseNotesError('fetchNoteById', error);
    throw error;
  }
  return mapRowToNote(data);
}

export async function fetchNotesForUser(userId) {
  const supabase = getSupabase();
  if (!supabase) return [];

  console.log('[db] fetchNotesForUser start', { userId });

  const { data, error } = await supabase
    .from('notes')
    .select(SELECT_NOTE_WITH_LABELS)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    logSupabaseNotesError('fetchNotesForUser', error);
    throw error;
  }
  const rows = (data ?? []).map(mapRowToNote);
  console.log('[db] fetchNotesForUser ok', { count: rows.length });
  return rows;
}

/** Same as {@link fetchNotesForUser}; name reflects “logged-in user” usage. */
export async function fetchNotesForCurrentUser(userId) {
  return fetchNotesForUser(userId);
}

/** Floating composer uses this sentinel so import dedupe does not merge user-created notes. */
const COMPOSER_SOURCE_SENTINEL = 'Notes Nursery';

/**
 * @param {{ sourceFileName?: string }} note
 */
export function isComposerCreatedNote(note) {
  return (note.sourceFileName ?? '') === COMPOSER_SOURCE_SENTINEL;
}

/**
 * Normalizes metadata for fingerprint matching (aligned with {@link buildNotesInsertRow}).
 * @param {{ title?: string, sourceFileName?: string, createdAtSource?: string, modifiedAtSource?: string }} note
 */
function fingerprintParts(note) {
  const title = (note.title ?? '').trim();
  const sourceFileName = note.sourceFileName ?? '';
  const cas = note.createdAtSource != null ? String(note.createdAtSource).trim() : '';
  const mas = note.modifiedAtSource != null ? String(note.modifiedAtSource).trim() : '';
  return { title, sourceFileName, cas, mas };
}

/**
 * Finds an existing note row for the same imported file identity (MVP dedupe).
 * @param {string} userId
 * @param {{ title?: string, sourceFileName?: string, createdAtSource?: string, modifiedAtSource?: string }} note
 * @returns {Promise<{ id: string } | null>}
 */
export async function findNoteByImportFingerprint(userId, note) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { title, sourceFileName, cas, mas } = fingerprintParts(note);

  let q = supabase
    .from('notes')
    .select('id')
    .eq('user_id', userId)
    .eq('title', title)
    .eq('source_file_name', sourceFileName);
  if (cas) {
    q = q.eq('created_at_source', cas);
  } else {
    q = q.is('created_at_source', null);
  }
  if (mas) {
    q = q.eq('modified_at_source', mas);
  } else {
    q = q.is('modified_at_source', null);
  }

  const { data, error } = await q.limit(1);
  if (error) {
    logSupabaseNotesError('findNoteByImportFingerprint', error);
    throw error;
  }
  const row = data?.[0];
  return row?.id ? { id: row.id } : null;
}

/**
 * Inserts a new note or updates an existing one when the import fingerprint matches (re-import same file).
 * Composer-created notes always insert (no fingerprint dedupe).
 *
 * @param {string} userId
 * @param {{ title?: string, bodyHtml?: string, sourceFileName?: string, createdAtSource?: string, modifiedAtSource?: string, labels?: string[] }} note
 */
export async function upsertImportedNote(userId, note) {
  if (isComposerCreatedNote(note)) {
    console.log('[db] upsertImportedNote: composer note, insert');
    return insertNote(userId, note);
  }

  const existing = await findNoteByImportFingerprint(userId, note);
  if (existing) {
    console.log('[db] upsertImportedNote: fingerprint match, update', { noteId: existing.id });
    await updateNoteRemote(userId, existing.id, {
      title: note.title,
      bodyHtml: note.bodyHtml,
      sourceFileName: note.sourceFileName,
      createdAtSource: note.createdAtSource,
      modifiedAtSource: note.modifiedAtSource,
      labels: note.labels ?? [],
    });
    return fetchNoteById(userId, existing.id);
  }

  console.log('[db] upsertImportedNote: new import, insert');
  return insertNote(userId, note);
}

/**
 * @param {string} userId
 * @param {{ title?: string, bodyHtml?: string, sourceFileName?: string, createdAtSource?: string, modifiedAtSource?: string, labels?: string[] }} note
 */
export async function insertNote(userId, note) {
  console.log('[db] insertNote start', { userId, title: note.title?.slice(0, 40) });

  const { data, error } = await insertNotesRowRaw(userId, note);

  if (error) {
    logSupabaseNotesError('insertNote', error);
    throw error;
  }

  const labels = note.labels ?? [];
  await syncNoteLabels(data.id, userId, labels);

  const mapped = {
    id: data.id,
    title: data.title ?? '',
    bodyHtml: data.body_html ?? '',
    sourceFileName: data.source_file_name ?? '',
    createdAtSource: data.created_at_source ?? '',
    modifiedAtSource: data.modified_at_source ?? '',
    labels,
  };
  console.log('[db] insertNote ok', { id: mapped.id });
  return mapped;
}

/**
 * @param {string} userId
 * @param {string} noteId
 * @param {Record<string, unknown>} updates
 */
export async function updateNoteRemote(userId, noteId, updates) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  console.log('[db] updateNoteRemote start', {
    userId,
    noteId,
    fields: Object.keys(updates),
  });

  const payload = { updated_at: new Date().toISOString() };
  if ('title' in updates && updates.title !== undefined) payload.title = updates.title;
  if ('bodyHtml' in updates && updates.bodyHtml !== undefined) payload.body_html = updates.bodyHtml;
  if ('sourceFileName' in updates && updates.sourceFileName !== undefined) {
    payload.source_file_name = updates.sourceFileName;
  }
  if ('createdAtSource' in updates && updates.createdAtSource !== undefined) {
    const t = updates.createdAtSource != null ? String(updates.createdAtSource).trim() : '';
    if (t) payload.created_at_source = t;
  }
  if ('modifiedAtSource' in updates && updates.modifiedAtSource !== undefined) {
    const t = updates.modifiedAtSource != null ? String(updates.modifiedAtSource).trim() : '';
    if (t) payload.modified_at_source = t;
  }

  const { error } = await supabase.from('notes').update(payload).eq('id', noteId).eq('user_id', userId);
  if (error) {
    logSupabaseNotesError('updateNoteRemote', error);
    throw error;
  }

  if ('labels' in updates && updates.labels !== undefined) {
    await syncNoteLabels(noteId, userId, /** @type {string[]} */ (updates.labels));
  }

  console.log('[db] updateNoteRemote ok', { noteId });
}

/**
 * Deletes a note. `note_labels` rows cascade; labels on other notes are unchanged.
 * @param {string} userId
 * @param {string} noteId
 */
export async function deleteNoteRemote(userId, noteId) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  console.log('[db] deleteNote start', { userId, noteId });
  const { error } = await supabase.from('notes').delete().eq('id', noteId).eq('user_id', userId);
  if (error) {
    logSupabaseNotesError('deleteNoteRemote', error);
    throw error;
  }
  console.log('[db] deleteNote ok', { noteId });
}

/**
 * Returns label row id (find or insert `labels` for this user).
 * @param {string} userId
 * @param {string} name
 */
export async function getOrCreateLabel(userId, name) {
  return getOrCreateLabelId(userId, name);
}

/**
 * Replaces `note_labels` for a note (same as {@link syncNoteLabels}).
 * @param {string} noteId
 * @param {string[]} labelNames
 * @param {string} userId
 */
export async function attachLabelsToNote(noteId, labelNames, userId) {
  return syncNoteLabels(noteId, userId, labelNames);
}

/**
 * Insert a new note or update an existing row when `existingId` is set.
 * @param {string} userId
 * @param {Record<string, unknown>} note
 * @param {string} [existingId]
 */
export async function saveNoteToSupabase(userId, note, existingId) {
  if (existingId) {
    console.log('[db] saveNoteToSupabase update', { existingId });
    await updateNoteRemote(userId, existingId, note);
    return fetchNoteById(userId, existingId);
  }
  console.log('[db] saveNoteToSupabase insert');
  return insertNote(userId, /** @type {Parameters<typeof insertNote>[1]} */ (note));
}

export const createNoteInSupabase = insertNote;
export const updateNoteInSupabase = updateNoteRemote;
