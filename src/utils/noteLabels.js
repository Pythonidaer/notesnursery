/**
 * @param {{ labels?: string[] }[]} notes
 * @returns {string[]}
 */
export function collectAllLabels(notes) {
  const set = new Set();
  for (const n of notes) {
    for (const l of n.labels ?? []) {
      const t = normalizeLabel(l);
      if (t) set.add(t);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** @param {string} s */
export function normalizeLabel(s) {
  return typeof s === 'string' ? s.trim() : '';
}

/**
 * @param {{ labels?: string[] }[]} notes
 * @param {'all' | 'unlabeled' | string} filter
 */
export function filterNotesByLabel(notes, filter) {
  if (filter === 'all') return notes;
  if (filter === 'unlabeled') {
    return notes.filter((n) => !(n.labels && n.labels.length));
  }
  return notes.filter((n) => (n.labels ?? []).includes(filter));
}
