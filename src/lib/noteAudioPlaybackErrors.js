/**
 * @param {unknown} err
 */
export function isNoteAudioStorageMissing(err) {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    /not found|object not found|does not exist|no such key|404|resource was not found/i.test(msg)
  );
}

/** Shown in note embeds when the Storage object was deleted but HTML still references it. */
export const NOTE_AUDIO_UNAVAILABLE_MESSAGE = 'Audio unavailable';

/**
 * @param {string | null | undefined} errorMessage
 * @returns {boolean}
 */
export function isNoteAudioUnavailableMessage(errorMessage) {
  return errorMessage === NOTE_AUDIO_UNAVAILABLE_MESSAGE;
}
