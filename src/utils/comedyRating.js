import { getEffectiveNoteDate, sortNotesByEffectiveDateDesc } from './groupNotesByDate.js';
import { normalizeLabel } from './noteLabels.js';

/** Email allowed to see and edit comedy performance ratings in the UI (v1: UI-only gate). */
export const COMEDY_RATING_ADMIN_EMAIL = 'codefolio.work@gmail.com';

/** Case-insensitive match for the Comedy label name. */
const COMEDY_LABEL_LOWER = 'comedy';

/** @type {readonly number[]} */
export const ALLOWED_COMEDY_RATINGS = Object.freeze([
  0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0,
]);

const allowedSet = new Set(ALLOWED_COMEDY_RATINGS);

/**
 * @param {unknown} email
 * @returns {boolean}
 */
export function isComedyRatingAdminEmail(email) {
  return typeof email === 'string' && email.trim().toLowerCase() === COMEDY_RATING_ADMIN_EMAIL.toLowerCase();
}

/**
 * @param {{ email?: string | null } | null | undefined} user — Supabase auth user
 * @returns {boolean}
 */
export function isAdminComedyRatingUser(user) {
  return user != null && isComedyRatingAdminEmail(user.email);
}

/**
 * Comedy rating UI (Cards, Library, note detail): production backend, admin user, Comedy label.
 * @param {{ useRemote: boolean, user: { email?: string | null } | null | undefined, note: { labels?: string[] } }} p
 */
export function shouldShowComedyRating({ useRemote, user, note }) {
  return Boolean(useRemote && isAdminComedyRatingUser(user) && noteHasComedyLabel(note));
}

/**
 * @param {{ labels?: string[] }} note
 * @returns {boolean}
 */
export function noteHasComedyLabel(note) {
  for (const raw of note.labels ?? []) {
    const n = normalizeLabel(raw);
    if (n && n.toLowerCase() === COMEDY_LABEL_LOWER) return true;
  }
  return false;
}

/**
 * @param {unknown} v
 * @returns {v is number | null}
 */
export function isValidComedyRatingValue(v) {
  if (v === null || v === undefined) return true;
  const n = Number(v);
  if (!Number.isFinite(n)) return false;
  return allowedSet.has(n);
}

/**
 * Coerce DB / API values to a number in the allowed set or null.
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseComedyRating(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const match = ALLOWED_COMEDY_RATINGS.find((x) => Math.abs(x - n) < 1e-9);
  return match !== undefined ? match : null;
}

/**
 * Maps a rating (0.5–5) to five star slots: empty | half | full.
 * @param {number | null | undefined} rating
 * @returns {('empty' | 'half' | 'full')[]}
 */
export function ratingToFiveStarDisplay(rating) {
  if (rating == null || rating === 0) {
    return ['empty', 'empty', 'empty', 'empty', 'empty'];
  }
  const p = Math.round(Number(rating) / 0.5);
  /** @type {('empty' | 'half' | 'full')[]} */
  const out = [];
  for (let i = 0; i < 5; i++) {
    if (p >= 2 * (i + 1)) out.push('full');
    else if (p >= 2 * i + 1) out.push('half');
    else out.push('empty');
  }
  return out;
}

/**
 * Star index 0–4, half `left` | `right`.
 * @param {number} starIndex
 * @param {'left' | 'right'} half
 * @returns {number}
 */
export function ratingValueFromStarHalf(starIndex, half) {
  if (half === 'left') return starIndex + 0.5;
  return starIndex + 1.0;
}

/** @typedef {'off' | 'high' | 'low'} ComedyRatingSortMode */

/**
 * Normalized rating for sort/display, or null if unrated.
 * Uses `parseComedyRating` so values match the DB half-step set. Reads `comedyRating` (app shape);
 * falls back to `comedy_rating` if present (e.g. raw rows) — do not use `comedy_rating` alone in
 * React; the live app uses camelCase from `notesSupabase`.
 *
 * @param {{ comedyRating?: number | null, comedy_rating?: unknown }} note
 * @returns {number | null}
 */
export function getComedyRatingValue(note) {
  const raw = note.comedyRating ?? note.comedy_rating;
  return parseComedyRating(raw);
}

/**
 * Sort key: unrated → `0`, otherwise same half-steps as {@link getComedyRatingValue} (0.5–5).
 * Keeps UI/storage on 0.5–5 while ordering uses a full 0–5 scale.
 *
 * @param {{ comedyRating?: number | null, comedy_rating?: unknown }} note
 * @returns {number}
 */
export function getComedyRatingSortKey(note) {
  return getComedyRatingValue(note) ?? 0;
}

const RATING_SORT_EPS = 1e-9;

function compareTieBreakByDateDesc(a, b) {
  const da = getEffectiveNoteDate(a);
  const db = getEffectiveNoteDate(b);
  const ta = da ? da.getTime() : -Infinity;
  const tb = db ? db.getTime() : -Infinity;
  return tb - ta;
}

/**
 * Sort by comedy rating on a 0–5 scale: unrated → `0`, saved ratings → 0.5–5.
 * Modes: `'high'` (desc), `'low'` (asc). Tie-break: effective date desc, then stable index.
 *
 * @param {{ comedyRating?: number | null, labels?: string[] }[]} notes
 * @param {'high' | 'low'} mode
 */
export function sortNotesByComedyRatingOrder(notes, mode) {
  const indexed = notes.map((note, index) => ({ note, index }));
  indexed.sort((a, b) => {
    const ra = getComedyRatingSortKey(a.note);
    const rb = getComedyRatingSortKey(b.note);

    if (mode === 'high') {
      const cmp = rb - ra;
      if (Math.abs(cmp) < RATING_SORT_EPS) {
        const tie = compareTieBreakByDateDesc(a.note, b.note);
        if (tie !== 0) return tie;
        return a.index - b.index;
      }
      return cmp;
    }

    const cmp = ra - rb;
    if (Math.abs(cmp) < RATING_SORT_EPS) {
      const tie = compareTieBreakByDateDesc(a.note, b.note);
      if (tie !== 0) return tie;
      return a.index - b.index;
    }
    return cmp;
  });
  return indexed.map(({ note }) => note);
}

/**
 * Cards/Library ordering after filters: default date desc, or comedy rating when toggled.
 * @param {{ comedyRating?: number | null }[]} filteredNotes
 * @param {ComedyRatingSortMode} mode
 */
export function sortNotesForCardsOrLibrary(filteredNotes, mode) {
  if (mode === 'off') {
    return sortNotesByEffectiveDateDesc(filteredNotes);
  }
  return sortNotesByComedyRatingOrder(filteredNotes, mode);
}

/**
 * Apply rating sort within each date group (Group by Date view).
 * @param {Array<{ key: string, label: string, notes: { comedyRating?: number | null }[] }>} groups
 * @param {ComedyRatingSortMode} mode
 */
export function applyComedyRatingSortToGroups(groups, mode) {
  if (mode === 'off') return groups;
  return groups.map((g) => ({
    ...g,
    notes: sortNotesByComedyRatingOrder(g.notes, mode),
  }));
}
