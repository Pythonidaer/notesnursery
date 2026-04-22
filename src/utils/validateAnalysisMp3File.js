import { NOTE_AUDIO_MAX_UPLOAD_BYTES } from '../constants/noteAudio.js';
import { formatBytes } from './formatBytes.js';

/**
 * Analysis page accepts `.mp3` only (first pass), same max size as note audio uploads.
 * @param {File} file
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateAnalysisMp3File(file) {
  if (!file || typeof file.name !== 'string') {
    return { ok: false, message: 'No file selected.' };
  }
  if (!file.name.toLowerCase().endsWith('.mp3')) {
    return {
      ok: false,
      message: 'Only .mp3 files are supported in Analysis. Convert other formats to .mp3 and try again.',
    };
  }
  if (typeof file.size === 'number' && file.size > NOTE_AUDIO_MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      message: `This file (${formatBytes(file.size)}) exceeds the upload limit (${formatBytes(NOTE_AUDIO_MAX_UPLOAD_BYTES)}).`,
    };
  }
  return { ok: true };
}
