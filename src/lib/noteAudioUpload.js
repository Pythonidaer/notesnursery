import { NOTE_AUDIO_BUCKET } from '../constants/noteAudio.js';
import { buildNoteAudioObjectPath } from '../utils/noteAudioPaths.js';
import { getSupabase } from './supabaseClient.js';

/**
 * Upload a local audio file to private storage. Returns the object path to store in note HTML.
 * @param {string} userId
 * @param {string} scopeId
 * @param {File} file
 * @returns {Promise<{ path: string, fileName: string, mimeType: string, sizeBytes: number }>}
 */
export async function uploadNoteAudioFile(userId, scopeId, file) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }
  const path = buildNoteAudioObjectPath(userId, scopeId, file.name);
  const contentType = file.type && file.type.trim() ? file.type : undefined;
  const { data, error } = await supabase.storage.from(NOTE_AUDIO_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType,
  });
  if (error) {
    console.error('[note-audio] upload', error);
    throw new Error(error.message || 'Upload failed');
  }
  const objectPath = data?.path ?? path;
  return {
    path: objectPath,
    fileName: file.name,
    mimeType: file.type || '',
    sizeBytes: typeof file.size === 'number' ? file.size : 0,
  };
}
