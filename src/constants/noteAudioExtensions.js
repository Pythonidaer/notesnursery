/** File extensions listed from Supabase note-audio storage and selectable in the audio library. */
export const NOTE_AUDIO_LISTABLE_EXTENSIONS = ['wav', 'mp3', 'webm', 'm4a', 'mp4'];

/** @param {string} fileName */
export function isListableNoteAudioFileName(fileName) {
  if (typeof fileName !== 'string' || !fileName.trim()) return false;
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  if (!match) return false;
  return NOTE_AUDIO_LISTABLE_EXTENSIONS.includes(match[1].toLowerCase());
}

/** Regex for storage list filters (wav, mp3, webm, m4a, mp4). */
export const NOTE_AUDIO_LISTABLE_EXT_PATTERN = new RegExp(
  `\\.(${NOTE_AUDIO_LISTABLE_EXTENSIONS.join('|')})$`,
  'i'
);
