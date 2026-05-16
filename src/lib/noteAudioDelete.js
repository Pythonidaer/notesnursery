import { NOTE_AUDIO_BUCKET } from '../constants/noteAudio.js';
import { getSupabase } from './supabaseClient.js';

/**
 * @param {string} userId
 * @param {string} storagePath
 * @returns {string}
 */
export function assertUserOwnsStoragePath(userId, storagePath) {
  const uid = String(userId || '').trim();
  const path = String(storagePath || '').trim().replace(/^\/+/, '');
  if (!uid || !path) {
    throw new Error('Invalid audio path');
  }
  if (!path.startsWith(`${uid}/`)) {
    throw new Error('You can only delete your own audio files');
  }
  return path;
}

/**
 * Remove one object from Storage and its display-name row (if any).
 * Does not edit note HTML — embeds will fail to load until removed from the note.
 *
 * @param {string} userId
 * @param {string} storagePath
 */
export async function deleteUserNoteAudioFile(userId, storagePath) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Sign in to delete audio');
  }
  const path = assertUserOwnsStoragePath(userId, storagePath);

  const { data: removed, error: storageError } = await supabase.storage
    .from(NOTE_AUDIO_BUCKET)
    .remove([path]);

  if (storageError) {
    console.error('[note-audio] delete storage', storageError);
    throw new Error(storageError.message || 'Could not delete file from storage');
  }

  // Without a Storage DELETE policy, Supabase often returns [] with no error — file stays in the bucket.
  if (!removed?.length) {
    throw new Error(
      'This file was not removed from storage. In Supabase SQL Editor, run supabase/migrations/009_note_audio_storage_policies.sql (see docs/voice-memos.md), then try again.'
    );
  }

  const { error: nameError } = await supabase
    .from('note_audio_display_names')
    .delete()
    .eq('user_id', userId)
    .eq('storage_path', path);

  if (nameError) {
    console.error('[note-audio] delete display name', nameError);
    throw new Error(nameError.message || 'File removed from storage but display name could not be cleared');
  }

  return { ok: true, path };
}
