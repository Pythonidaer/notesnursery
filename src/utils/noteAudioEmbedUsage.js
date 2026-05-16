import { noteHtmlReferencesAudioStoragePath } from './analysisWpmFromNoteHtml.js';

/**
 * @typedef {{ id: string, bodyHtml?: string }} NoteWithHtml
 */

/**
 * @param {NoteWithHtml[] | null | undefined} notes
 * @param {string} storagePath
 * @returns {number}
 */
export function countNotesReferencingAudioPath(notes, storagePath) {
  if (!storagePath || !notes?.length) return 0;
  return notes.filter((n) => noteHtmlReferencesAudioStoragePath(n.bodyHtml, storagePath)).length;
}

/**
 * @param {NoteWithHtml[] | null | undefined} notes
 * @param {string[]} storagePaths
 * @returns {Record<string, { count: number, noteIds: string[] }>}
 */
export function buildAudioPathNoteUsageMap(notes, storagePaths) {
  /** @type {Record<string, { count: number, noteIds: string[] }>} */
  const map = {};
  if (!storagePaths.length) return map;

  for (const path of storagePaths) {
    map[path] = { count: 0, noteIds: [] };
  }
  if (!notes?.length) return map;

  for (const note of notes) {
    for (const path of storagePaths) {
      if (noteHtmlReferencesAudioStoragePath(note.bodyHtml, path)) {
        map[path].count += 1;
        map[path].noteIds.push(note.id);
      }
    }
  }
  return map;
}

/**
 * @param {number} count
 * @returns {string}
 */
export function formatVoiceMemoNoteUsage(count) {
  if (!Number.isFinite(count) || count < 1) return 'Not in any notes';
  return count === 1 ? 'In 1 note' : `In ${count} notes`;
}
