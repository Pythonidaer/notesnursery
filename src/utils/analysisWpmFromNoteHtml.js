import { htmlToPlain } from './noteBodyPlain.js';

/** Minimum word count before showing a WPM estimate (v1 guardrail). */
export const ANALYSIS_WPM_MIN_WORDS = 20;

/**
 * @param {string | undefined | null} bodyHtml
 * @param {string} storagePath
 * @returns {boolean}
 */
export function noteHtmlReferencesAudioStoragePath(bodyHtml, storagePath) {
  if (!bodyHtml || !storagePath || typeof DOMParser === 'undefined') return false;
  const doc = new DOMParser().parseFromString(`<div data-nn-wpm-root="1">${bodyHtml}</div>`, 'text/html');
  const root = doc.querySelector('[data-nn-wpm-root]');
  if (!root) return false;
  return Array.from(root.querySelectorAll('figure.nn-audio-embed')).some(
    (fig) => fig.getAttribute('data-nn-storage-path') === storagePath
  );
}

/**
 * Remove the note-audio figure(s) for this storage path, drop script/style, then plain text.
 * @param {string | undefined | null} bodyHtml
 * @param {string} storagePath
 * @returns {string}
 */
export function plainTranscriptTextForWpm(bodyHtml, storagePath) {
  if (!bodyHtml || !storagePath || typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(`<div data-nn-wpm-root="1">${bodyHtml}</div>`, 'text/html');
  const root = doc.querySelector('[data-nn-wpm-root]');
  if (!root) return '';
  root.querySelectorAll('figure.nn-audio-embed').forEach((fig) => {
    if (fig.getAttribute('data-nn-storage-path') === storagePath) {
      fig.remove();
    }
  });
  root.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
  const plain = htmlToPlain(root.innerHTML);
  return plain.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} plain
 * @returns {number}
 */
export function countWordsInPlainText(plain) {
  if (!plain || typeof plain !== 'string') return 0;
  const parts = plain.trim().split(/\s+/);
  return parts[0] === '' ? 0 : parts.length;
}

/**
 * @param {number} wordCount
 * @param {number} durationSec
 * @returns {number | null}
 */
export function computeWpmFromWordCountAndDuration(wordCount, durationSec) {
  if (!Number.isFinite(wordCount) || wordCount < 1) return null;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
  return Math.round(wordCount / (durationSec / 60));
}
