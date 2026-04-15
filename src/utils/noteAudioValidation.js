/**
 * @param {File} file
 * @returns {{ ok: boolean, message?: string }}
 */
export function validateNoteAudioFile(file) {
  if (!file || typeof file.name !== 'string') {
    return { ok: false, message: 'No file selected.' };
  }
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.wav') && !lower.endsWith('.mp3')) {
    return { ok: false, message: 'Only .wav and .mp3 files are supported.' };
  }
  return { ok: true };
}
