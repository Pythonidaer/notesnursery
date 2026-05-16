/**
 * MIME types allowed on the Supabase `note-audio` bucket (manual uploads + MP3 recordings).
 * Dashboard → Storage → note-audio should include at least audio/mpeg and audio/wav.
 */
export const NOTE_AUDIO_BUCKET_ALLOWED_CONTENT_TYPES = [
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
];

/** @type {Record<string, string>} extension (no dot) → storage Content-Type */
const EXT_TO_CONTENT_TYPE = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
};

/**
 * @param {string} extension
 * @param {string} [recordedMime]
 * @returns {string}
 */
export function resolveStorageContentType(extension, recordedMime) {
  const ext = String(extension || '').replace(/^\./, '').toLowerCase();
  if (ext && EXT_TO_CONTENT_TYPE[ext]) {
    return EXT_TO_CONTENT_TYPE[ext];
  }
  const mime = typeof recordedMime === 'string' ? recordedMime.split(';')[0].trim().toLowerCase() : '';
  if (mime && NOTE_AUDIO_BUCKET_ALLOWED_CONTENT_TYPES.includes(mime)) {
    return mime;
  }
  return 'audio/mpeg';
}

/**
 * Human-readable hint when Supabase rejects a MIME type.
 * @param {string} rawMessage
 */
export function formatStorageMimeRejectedMessage(rawMessage) {
  if (/mime type .* is not supported/i.test(rawMessage)) {
    return (
      `${rawMessage} — ensure the note-audio bucket allows audio/mpeg (.mp3) in Supabase Storage settings.`
    );
  }
  return rawMessage;
}
