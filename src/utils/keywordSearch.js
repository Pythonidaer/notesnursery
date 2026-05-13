/**
 * Client-side keyword search utilities.
 *
 * These are pure functions with no React or Supabase dependencies, making
 * them straightforward to unit-test and easy to extend toward hybrid ranking
 * in the future.
 */

/**
 * Strips HTML tags (including script/style blocks) and collapses whitespace,
 * returning plain text suitable for keyword matching or snippet display.
 *
 * The same stripping logic used by the `search-notes-semantic` edge function
 * is replicated here so client-side and server-side results are consistent.
 *
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns a short plain-text excerpt from an HTML string.
 *
 * @param {string} html
 * @param {number} [max=220]
 * @returns {string}
 */
export function snippetFromHtml(html, max = 220) {
  const t = stripHtml(html);
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * Normalizes a user query into lowercase tokens split on whitespace.
 * Empty or whitespace-only input yields an empty array.
 *
 * @param {string} query
 * @returns {string[]}
 */
export function tokenizeKeywordQuery(query) {
  if (typeof query !== 'string') return [];
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * One lowercase string combining title, stripped body, and label names.
 * Used so each token can match anywhere across those fields (AND across tokens).
 *
 * @param {{ title?: string | null, bodyHtml?: string | null, labels?: (string | null)[] }} note
 * @returns {string}
 */
function noteSearchableText(note) {
  const title = (note.title ?? '').toLowerCase();
  const body = stripHtml(note.bodyHtml ?? '').toLowerCase();
  const labelPart = (note.labels ?? [])
    .map((l) => String(l ?? '').toLowerCase())
    .join(' ');
  return [title, body, labelPart].filter((s) => s.length > 0).join(' ');
}

/**
 * Filters notes by case-insensitive substring match on one or more keywords.
 *
 * The query is trimmed, lowercased, and split on whitespace into tokens.
 * A note matches only if **every** token appears somewhere in the combined
 * searchable text (title + stripped body + label names). A token may match
 * in any field; tokens are not required to stay in order.
 *
 * Returns an empty array when the query is empty or whitespace-only so that
 * blank searches never replace the full library list.
 *
 * @param {Array<{
 *   id: string,
 *   title?: string | null,
 *   bodyHtml?: string | null,
 *   labels?: string[],
 * }>} notes
 * @param {string} query
 * @returns {typeof notes}
 */
export function searchNotesKeyword(notes, query) {
  const tokens = tokenizeKeywordQuery(query);
  if (tokens.length === 0) return [];

  return notes.filter((note) => {
    const searchable = noteSearchableText(note);
    return tokens.every((token) => searchable.includes(token));
  });
}
