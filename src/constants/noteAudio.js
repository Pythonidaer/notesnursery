/** Supabase Storage bucket for embedded note audio (private; signed URLs at playback). */
export const NOTE_AUDIO_BUCKET = 'note-audio';

/** Signed URL lifetime for playback in the editor and read view (seconds). */
export const NOTE_AUDIO_SIGNED_URL_TTL_SEC = 3600;

/**
 * Client-side guard aligned with typical Supabase Storage limits (project may differ).
 * Server still enforces the real cap; this improves UX before upload.
 */
export const NOTE_AUDIO_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
