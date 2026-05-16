import { NOTE_AUDIO_BUCKET, NOTE_AUDIO_SIGNED_URL_TTL_SEC } from '../constants/noteAudio.js';
import {
  isNoteAudioStorageMissing,
  NOTE_AUDIO_UNAVAILABLE_MESSAGE,
} from './noteAudioPlaybackErrors.js';
import { getSupabase } from './supabaseClient.js';

/**
 * Create a time-limited URL for private-bucket playback. Persist only `storagePath` in note HTML, not this URL.
 * @param {string} storagePath Object path within `note-audio` (no bucket prefix).
 * @param {number} [expiresInSec]
 * @returns {Promise<{ url: string | null, error: string | null, unavailable?: boolean }>}
 */
export async function createNoteAudioSignedUrl(storagePath, expiresInSec = NOTE_AUDIO_SIGNED_URL_TTL_SEC) {
  if (!storagePath || typeof storagePath !== 'string') {
    return { url: null, error: 'Missing audio path' };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return { url: null, error: 'Sign in with Supabase to play audio' };
  }
  const { data, error } = await supabase.storage
    .from(NOTE_AUDIO_BUCKET)
    .createSignedUrl(storagePath.trim(), expiresInSec);
  if (error) {
    console.error('[note-audio] createSignedUrl', error);
    if (isNoteAudioStorageMissing(error)) {
      return { url: null, error: NOTE_AUDIO_UNAVAILABLE_MESSAGE, unavailable: true };
    }
    return { url: null, error: error.message || 'Could not access audio' };
  }
  if (!data?.signedUrl) {
    return { url: null, error: 'Could not access audio' };
  }
  return { url: data.signedUrl, error: null };
}
