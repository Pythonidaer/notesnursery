/** Extensions listed from Supabase note-audio storage and selectable in Insert audio. */
export const NOTE_AUDIO_LISTABLE_EXTENSIONS = ['wav', 'mp3'];

/** @param {string} fileName */
export function isListableNoteAudioFileName(fileName) {
  if (typeof fileName !== 'string' || !fileName.trim()) return false;
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  if (!match) return false;
  return NOTE_AUDIO_LISTABLE_EXTENSIONS.includes(match[1].toLowerCase());
}

/** Regex for storage list filters. */
export const NOTE_AUDIO_LISTABLE_EXT_PATTERN = new RegExp(
  `\\.(${NOTE_AUDIO_LISTABLE_EXTENSIONS.join('|')})$`,
  'i'
);
