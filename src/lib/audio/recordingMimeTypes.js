/** MIME types for desktop / Chrome (WebM last — storage and Safari playback need care). */
export const RECORDING_MIME_PREFERENCES_DESKTOP = [
  'audio/mp4;codecs=mp4a',
  'audio/mp4',
  'audio/wav',
  'audio/webm;codecs=opus',
  'audio/webm',
];

/** iOS / Safari: never prefer WebM (often cannot preview or upload on older bucket configs). */
export const RECORDING_MIME_PREFERENCES_APPLE = [
  'audio/mp4;codecs=mp4a',
  'audio/mp4',
  'audio/wav',
];

/** @deprecated Use getRecordingMimePreferences() */
export const RECORDING_MIME_PREFERENCES = RECORDING_MIME_PREFERENCES_DESKTOP;

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
 * iPhone, iPad, and Safari (incl. iOS Chrome WebKit).
 * @returns {boolean}
 */
export function isAppleMobileOrSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|EdgiOS|FxiOS/i.test(ua);
  return isIos || isSafari;
}

/**
 * @returns {string[]}
 */
export function getRecordingMimePreferences() {
  return isAppleMobileOrSafari()
    ? RECORDING_MIME_PREFERENCES_APPLE
    : RECORDING_MIME_PREFERENCES_DESKTOP;
}

/**
 * Pick the first MIME type supported by MediaRecorder in this browser.
 * @returns {{ mimeType: string, extension: string } | null}
 */
export function detectRecordingMimeType() {
  if (!isMediaRecorderSupported()) return null;
  for (const mimeType of getRecordingMimePreferences()) {
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
 * Whether `<audio>` can likely play this MIME in the current browser.
 * @param {string} mimeType
 */
export function canPreviewAudioMime(mimeType) {
  if (typeof document === 'undefined') return true;
  const base = String(mimeType || '').split(';')[0].trim();
  if (!base) return false;
  const audio = document.createElement('audio');
  const score = audio.canPlayType(base);
  return score === 'probably' || score === 'maybe';
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
