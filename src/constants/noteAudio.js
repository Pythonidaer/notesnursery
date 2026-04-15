/** Supabase Storage bucket for embedded note audio (private; signed URLs at playback). */
export const NOTE_AUDIO_BUCKET = 'note-audio';

/** Signed URL lifetime for playback in the editor and read view (seconds). */
export const NOTE_AUDIO_SIGNED_URL_TTL_SEC = 3600;

/** Client-side guard matching the app’s intended upload limit; Storage may also enforce a cap. */
export const NOTE_AUDIO_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
