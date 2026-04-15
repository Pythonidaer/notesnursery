/**
 * Master map of POS abbreviation → short English gloss (read-only analysis UI).
 * The legend only shows entries for abbreviations actually present in the note.
 */
export const POS_ABBREV_MEANINGS = Object.freeze({
  n: 'noun (common)',
  prop: 'proper noun / name / place (when detected)',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  det: 'determiner',
  pron: 'pronoun',
  prep: 'preposition',
  conj: 'conjunction',
  intj: 'interjection / filler',
  part: 'particle',
  poss: 'possessive',
  misc: 'other / unknown',
});

/**
 * @param {string[]} abbrevs
 * @returns {Array<{ abbrev: string, meaning: string }>}
 */
export function posLegendRows(abbrevs) {
  if (!abbrevs?.length) return [];
  const seen = new Set();
  const rows = [];
  for (const raw of [...abbrevs].sort((a, b) => a.localeCompare(b))) {
    const abbrev = typeof raw === 'string' ? raw.trim() : '';
    if (!abbrev || seen.has(abbrev)) continue;
    seen.add(abbrev);
    const meaning =
      POS_ABBREV_MEANINGS[abbrev] ??
      (abbrev.length <= 8 ? `grammatical tag: ${abbrev}` : abbrev);
    rows.push({ abbrev, meaning });
  }
  return rows;
}
