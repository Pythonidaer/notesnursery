/** MIME types to try in order (see docs/recording-sessions.md). */
export const RECORDING_MIME_PREFERENCES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mp4;codecs=mp4a',
  'audio/wav',
];

/** @type {Record<string, string>} */
const MIME_TO_EXTENSION = {
  'audio/webm': 'webm',
  'audio/webm;codecs=opus': 'webm',
  'audio/mp4': 'm4a',
  'audio/mp4;codecs=mp4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

/**
 * @returns {boolean}
 */
export function isMediaRecorderSupported() {
  return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';
}

/**
 * Pick the first MIME type supported by MediaRecorder in this browser.
 * @returns {{ mimeType: string, extension: string } | null}
 */
export function detectRecordingMimeType() {
  if (!isMediaRecorderSupported()) return null;
  for (const mimeType of RECORDING_MIME_PREFERENCES) {
    try {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        const extension = MIME_TO_EXTENSION[mimeType] ?? mimeType.split('/')[1]?.split(';')[0] ?? 'webm';
        return { mimeType, extension };
      }
    } catch {
      /* isTypeSupported may throw on invalid strings in older browsers */
    }
  }
  return null;
}

/**
 * @param {Date | string | number} date
 * @param {string} extension
 * @returns {string}
 */
export function buildRecordingFileName(date, extension) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  const stamp = [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('-');
  const ext = String(extension || 'webm').replace(/^\./, '').toLowerCase();
  return `recording-${stamp}.${ext}`;
}
