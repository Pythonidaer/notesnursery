import { parseAppleNoteDateString } from './parseAppleNoteDate.js';

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** @typedef {{ id: string, sourceFileName: string, title: string, bodyHtml: string, createdAtSource: string, modifiedAtSource: string, labels?: string[] }} ParsedNote */

/**
 * Prefer modified, then created.
 * @param {ParsedNote} note
 * @returns {Date | null}
 */
export function getEffectiveNoteDate(note) {
  return (
    parseAppleNoteDateString(note.modifiedAtSource) ||
    parseAppleNoteDateString(note.createdAtSource) ||
    null
  );
}

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Most recent first; notes without a parseable date sort last.
 * @param {ParsedNote[]} notes
 */
export function sortNotesByEffectiveDateDesc(notes) {
  return [...notes].sort((a, b) => {
    const da = getEffectiveNoteDate(a);
    const db = getEffectiveNoteDate(b);
    const ta = da ? da.getTime() : -Infinity;
    const tb = db ? db.getTime() : -Infinity;
    return tb - ta;
  });
}

/**
 * @param {ParsedNote} note
 * @param {Date} now
 * @returns {{ bucketKey: string, label: string }}
 */
export function classifyNote(note, now) {
  const d = getEffectiveNoteDate(note);
  if (!d) {
    return { bucketKey: 'unknown', label: 'Unknown Date' };
  }

  const todayStart = startOfLocalDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  if (d >= todayStart && d < tomorrowStart) {
    return { bucketKey: 'today', label: 'Today' };
  }

  const prev30Lower = new Date(todayStart);
  prev30Lower.setDate(prev30Lower.getDate() - 30);

  if (d >= prev30Lower && d < todayStart) {
    return { bucketKey: 'previous30', label: 'Previous 30 Days' };
  }

  const currentYear = now.getFullYear();
  const y = d.getFullYear();

  if (y === currentYear) {
    const m = d.getMonth();
    return { bucketKey: `month-${m}`, label: MONTH_LABELS[m] };
  }

  return { bucketKey: `year-${y}`, label: String(y) };
}

/**
 * Returns ordered groups for rendering (Apple Notes–style).
 * Order: Today → Previous 30 Days → January…December (current year) → years (newest first) → Unknown Date.
 * @param {ParsedNote[]} notes
 * @param {Date} [now]
 * @returns {Array<{ key: string, label: string, notes: ParsedNote[] }>}
 */
export function groupNotesByDate(notes, now = new Date()) {
  /** @type {Map<string, { label: string, notes: ParsedNote[] }>} */
  const buckets = new Map();

  for (const note of notes) {
    const { bucketKey, label } = classifyNote(note, now);
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, { label, notes: [] });
    }
    buckets.get(bucketKey).notes.push(note);
  }

  const ordered = [];

  const addIfPresent = (bucketKey, fallbackLabel) => {
    const b = buckets.get(bucketKey);
    if (b?.notes.length) {
      ordered.push({
        key: bucketKey,
        label: b.label || fallbackLabel,
        notes: sortNotesByEffectiveDateDesc(b.notes),
      });
    }
  };

  addIfPresent('today', 'Today');
  addIfPresent('previous30', 'Previous 30 Days');

  for (let m = 0; m < 12; m++) {
    const bucketKey = `month-${m}`;
    addIfPresent(bucketKey, MONTH_LABELS[m]);
  }

  const yearKeys = [...buckets.keys()]
    .filter((k) => k.startsWith('year-'))
    .map((k) => Number(k.slice('year-'.length)))
    .filter((y) => !Number.isNaN(y))
    .sort((a, b) => b - a);

  for (const y of yearKeys) {
    const bucketKey = `year-${y}`;
    const b = buckets.get(bucketKey);
    if (b?.notes.length) {
      ordered.push({
        key: bucketKey,
        label: b.label,
        notes: sortNotesByEffectiveDateDesc(b.notes),
      });
    }
  }

  addIfPresent('unknown', 'Unknown Date');

  return ordered;
}

/**
 * @param {ParsedNote[]} notes
 * @param {string} filterKey `all` or a {@link classifyNote} bucketKey
 * @param {Date} [now]
 */
export function filterNotesByDateBucket(notes, filterKey, now = new Date()) {
  if (!filterKey || filterKey === 'all') return notes;
  return notes.filter((n) => classifyNote(n, now).bucketKey === filterKey);
}

/**
 * Build &lt;select&gt; options from buckets that appear in `notes` (plus “All dates”).
 * Order: All → Previous 30 Days → Today → Jan…Dec (current year, present only) → years desc → Unknown.
 * @param {ParsedNote[]} notes
 * @param {Date} [now]
 * @returns {{ value: string, label: string }[]}
 */
export function deriveDateFilterOptions(notes, now = new Date()) {
  const keys = new Set();
  for (const n of notes) {
    keys.add(classifyNote(n, now).bucketKey);
  }

  /** @type {{ value: string, label: string }[]} */
  const options = [{ value: 'all', label: 'All dates' }];

  if (keys.has('previous30')) {
    options.push({ value: 'previous30', label: 'Previous 30 Days' });
  }
  if (keys.has('today')) {
    options.push({ value: 'today', label: 'Today' });
  }

  for (let m = 0; m < 12; m++) {
    const bucketKey = `month-${m}`;
    if (keys.has(bucketKey)) {
      options.push({ value: bucketKey, label: MONTH_LABELS[m] });
    }
  }

  const yearNums = [...keys]
    .filter((k) => k.startsWith('year-'))
    .map((k) => Number(k.slice('year-'.length)))
    .filter((y) => !Number.isNaN(y))
    .sort((a, b) => b - a);

  for (const y of yearNums) {
    options.push({ value: `year-${y}`, label: String(y) });
  }

  if (keys.has('unknown')) {
    options.push({ value: 'unknown', label: 'Unknown Date' });
  }

  return options;
}
