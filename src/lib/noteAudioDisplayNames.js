import { getSupabase } from './supabaseClient.js';

/**
 * @param {string} name
 * @returns {string}
 */
export function sanitizeAudioDisplayName(name) {
  if (typeof name !== 'string' || !name.trim()) return 'Audio';
  const base = name.replace(/[/\\]/g, '-').replace(/\s+/g, ' ').trim();
  const limited = base.length > 200 ? base.slice(0, 200) : base;
  return limited || 'Audio';
}

/**
 * @param {string} userId
 * @param {string[]} paths
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchNoteAudioDisplayNamesForPaths(userId, paths) {
  const supabase = getSupabase();
  if (!supabase || !userId || paths.length === 0) return {};

  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};

  const { data, error } = await supabase
    .from('note_audio_display_names')
    .select('storage_path, display_name')
    .eq('user_id', userId)
    .in('storage_path', unique);

  if (error) {
    console.error('[note-audio] fetch display names', error);
    return {};
  }

  /** @type {Record<string, string>} */
  const map = {};
  for (const row of data ?? []) {
    if (row.storage_path && typeof row.display_name === 'string' && row.display_name.trim()) {
      map[row.storage_path] = row.display_name.trim();
    }
  }
  return map;
}

/**
 * @param {string} userId
 * @param {string} storagePath
 * @param {string} displayName
 * @returns {Promise<{ ok: boolean, error?: string, displayName?: string }>}
 */
export async function upsertNoteAudioDisplayName(userId, storagePath, displayName) {
  const supabase = getSupabase();
  if (!supabase || !userId || !storagePath?.trim()) {
    return { ok: false, error: 'Not available' };
  }
  const safe = sanitizeAudioDisplayName(displayName);
  const { error } = await supabase.from('note_audio_display_names').upsert(
    {
      user_id: userId,
      storage_path: storagePath.trim(),
      display_name: safe,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,storage_path' }
  );
  if (error) {
    console.error('[note-audio] upsert display name', error);
    const raw = error.message || '';
    const friendly =
      /note_audio_display_names|schema cache|does not exist|relation/i.test(raw)
        ? 'Display names need the note_audio_display_names table. In the Supabase dashboard, open SQL Editor and run the SQL in supabase/migrations/005_note_audio_display_names.sql, then try again.'
        : raw || 'Could not save name';
    return { ok: false, error: friendly };
  }
  return { ok: true, displayName: safe };
}
