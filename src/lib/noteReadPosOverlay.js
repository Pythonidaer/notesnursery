import nlp from 'compromise';

/** Do not POS-tag or walk into existing overlay nodes / monospace / media. */
const POS_TEXT_ANCESTOR =
  'code, pre, script, style, svg, canvas, noscript, [data-nn-pos], figure.nn-audio-embed';

/** Punctuation that attaches to the following word (opening). */
const openerChars = /[\(\[\{‘“«‹「『〈《〝〟‚„]/u;
/** Punctuation that attaches to the previous word (closing / sentence). */
const closerChars = /[,.;:!?…\)\]\}’”»›」』〉》。、··•‣※†‡°%‰‱']/u;

/**
 * @param {string} s
 */
function isOpenerOnly(s) {
  if (!s || typeof s !== 'string') return false;
  for (const c of Array.from(s)) {
    if (!openerChars.test(c)) return false;
  }
  return true;
}

/**
 * @param {string} s
 */
function isTrailingOnly(s) {
  if (!s || typeof s !== 'string') return false;
  for (const c of Array.from(s)) {
    if (!closerChars.test(c)) return false;
  }
  return true;
}

/**
 * Tokenize visible text into words, punctuation chunks, and whitespace (preserves layout).
 * @param {string} text
 * @returns {Array<{ type: 'ws' | 'punct' | 'word', value: string }>}
 */
export function tokenizeTextForPos(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const tokens = [];
  const re =
    /(\s+)|([^ \t\n\r\f\p{L}\p{N}]+)|([\p{L}\p{N}]+(?:['\u2019][\p{L}\p{N}]+)*)/gu;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) tokens.push({ type: 'ws', value: m[1] });
    else if (m[2]) tokens.push({ type: 'punct', value: m[2] });
    else if (m[3]) tokens.push({ type: 'word', value: m[3] });
  }
  return tokens;
}

/**
 * Group raw tokens into whitespace, plain punct runs, and word units with attached punct.
 * @param {Array<{ type: 'ws' | 'punct' | 'word', value: string }>} tokens
 * @returns {Array<
 *   | { type: 'ws', value: string }
 *   | { type: 'plain', value: string }
 *   | { type: 'unit', leading: string, word: string, trailing: string }
 * >}
 */
export function groupTokensForPos(tokens) {
  /** @type {Array<
   *   | { type: 'ws', value: string }
   *   | { type: 'plain', value: string }
   *   | { type: 'unit', leading: string, word: string, trailing: string }
   * >} */
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === 'ws') {
      out.push({ type: 'ws', value: t.value });
      i++;
      continue;
    }

    /** @type {string[]} */
    const leadingParts = [];
    while (
      i < tokens.length &&
      tokens[i].type === 'punct' &&
      isOpenerOnly(tokens[i].value)
    ) {
      leadingParts.push(tokens[i].value);
      i++;
    }
    const leading = leadingParts.join('');

    if (i >= tokens.length) {
      if (leading) out.push({ type: 'plain', value: leading });
      break;
    }

    if (tokens[i].type === 'word') {
      const word = tokens[i].value;
      i++;
      /** @type {string[]} */
      const trailingParts = [];
      while (
        i < tokens.length &&
        tokens[i].type === 'punct' &&
        isTrailingOnly(tokens[i].value)
      ) {
        trailingParts.push(tokens[i].value);
        i++;
      }
      const trailing = trailingParts.join('');
      out.push({ type: 'unit', leading, word, trailing });
      continue;
    }

    if (leading) out.push({ type: 'plain', value: leading });
    if (tokens[i].type === 'punct') {
      out.push({ type: 'plain', value: tokens[i].value });
      i++;
    }
  }
  return out;
}

/**
 * Names / brands often tagged only as Noun; compromise sometimes omits `ProperNoun`.
 * Conservative: Title Case, length ≥ 4, to avoid sentence-initial "Guy" → prop.
 * @param {string} rawWord
 */
function looksLikeUncountedProperName(rawWord) {
  const w = typeof rawWord === 'string' ? rawWord.trim() : '';
  if (w.length < 4) return false;
  if (!/^[A-Z][a-z]+$/u.test(w)) return false;
  const stop = new Set([
    'that',
    'this',
    'with',
    'from',
    'have',
    'were',
    'been',
    'what',
    'when',
    'will',
    'your',
    'into',
    'than',
    'then',
    'them',
    'very',
    'also',
    'just',
    'only',
    'some',
    'such',
    'more',
    'most',
    'much',
    'many',
    'make',
    'like',
    'each',
    'every',
    'both',
  ]);
  if (stop.has(w.toLowerCase())) return false;
  return true;
}

/**
 * @param {string[]} tags
 * @param {string} rawWord
 */
function abbrevFromCompromiseTags(tags, rawWord) {
  if (!tags?.length) return 'misc';
  const tset = new Set(tags);
  const pick = (name) => tset.has(name);
  if (pick('Determiner')) return 'det';
  if (pick('Adjective')) return 'adj';
  if (pick('Adverb')) return 'adv';
  if (pick('Verb') || pick('Infinitive') || pick('Gerund') || pick('PastTense')) return 'v';
  if (pick('Pronoun')) return 'pron';
  if (pick('Preposition')) return 'prep';
  if (pick('Conjunction')) return 'conj';
  if (pick('Interjection') || pick('Expression')) return 'intj';
  if (pick('Particle')) return 'part';
  if (pick('Possessive')) return 'poss';
  if (pick('ProperNoun')) return 'prop';
  if (pick('Acronym')) return 'prop';
  if (pick('Noun') || pick('Plural')) {
    if (looksLikeUncountedProperName(rawWord)) return 'prop';
    return 'n';
  }
  const first = tags[0];
  if (typeof first === 'string' && first.length <= 5) return first.toLowerCase();
  return 'misc';
}

/**
 * @param {string} rawWord
 * @returns {string}
 */
export function abbreviatedPosForWord(rawWord) {
  const trimmed = rawWord.trim();
  if (!trimmed) return 'misc';
  const lower = trimmed.toLowerCase();
  if (lower === 'uh' || lower === 'um') return 'intj';

  const doc = nlp(trimmed);
  /** Entity-style lookups (compromise plugins) — names/places/orgs not always in `tags`. */
  if (
    doc.has('#Person') ||
    doc.has('#Place') ||
    doc.has('#Country') ||
    doc.has('#City') ||
    doc.has('#Organization')
  ) {
    return 'prop';
  }
  if (doc.has('#Acronym')) {
    return 'prop';
  }

  const json = doc.json();
  const term = json[0]?.terms?.[0];
  if (!term) return 'misc';
  const tags = term.tags ?? [];
  return abbrevFromCompromiseTags(tags, trimmed);
}

/**
 * @param {string} leading
 * @param {string} word
 * @param {string} trailing
 * @param {string} abbr
 */
function buildPosUnit(leading, word, trailing, abbr) {
  const unit = document.createElement('span');
  unit.className = 'nn-pos-unit';
  unit.setAttribute('data-nn-pos', '1');

  const line = document.createElement('span');
  line.className = 'nn-pos-line';

  if (leading) {
    const el = document.createElement('span');
    el.className = 'nn-pos-punct nn-pos-punct--lead';
    el.textContent = leading;
    line.appendChild(el);
  }

  const col = document.createElement('span');
  col.className = 'nn-pos-token';
  const wordEl = document.createElement('span');
  wordEl.className = 'nn-pos-word';
  wordEl.textContent = word;
  const tagEl = document.createElement('span');
  tagEl.className = 'nn-pos-tag';
  tagEl.textContent = abbr;
  col.appendChild(wordEl);
  col.appendChild(tagEl);
  line.appendChild(col);

  if (trailing) {
    const el = document.createElement('span');
    el.className = 'nn-pos-punct nn-pos-punct--trail';
    el.textContent = trailing;
    line.appendChild(el);
  }

  unit.appendChild(line);
  return unit;
}

/**
 * @param {Text} textNode
 */
function replaceTextNodeWithPosTokens(textNode) {
  const text = textNode.nodeValue ?? '';
  const raw = tokenizeTextForPos(text);
  const grouped = groupTokensForPos(raw);
  const hasWord = grouped.some((g) => g.type === 'unit');
  if (!hasWord) return;

  const frag = document.createDocumentFragment();
  for (const g of grouped) {
    if (g.type === 'ws' || g.type === 'plain') {
      frag.appendChild(document.createTextNode(g.value));
      continue;
    }
    const abbr = abbreviatedPosForWord(g.word);
    frag.appendChild(buildPosUnit(g.leading, g.word, g.trailing, abbr));
  }

  const parent = textNode.parentNode;
  if (parent) parent.replaceChild(frag, textNode);
}

/**
 * @param {Element} root
 */
function walkAndTransform(root) {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(/** @type {Node} */ node) {
      if (node.nodeType !== Node.TEXT_NODE) return NodeFilter.FILTER_SKIP;
      const tn = /** @type {Text} */ (node);
      const el = tn.parentElement;
      if (!el) return NodeFilter.FILTER_REJECT;
      if (el.closest(POS_TEXT_ANCESTOR)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const batch = [];
  let n = walker.nextNode();
  while (n) {
    batch.push(/** @type {Text} */ (n));
    n = walker.nextNode();
  }
  for (const textNode of batch) {
    const p = textNode.parentElement;
    if (p && p.closest(POS_TEXT_ANCESTOR)) continue;
    replaceTextNodeWithPosTokens(textNode);
  }
}

/**
 * Read-only display overlay: wraps word tokens in structured spans; leaves punctuation plain.
 * Idempotent for nodes already under `[data-nn-pos]`.
 *
 * @param {Element} readBodyRoot
 * @param {{ contentTypeHtml: boolean }} opts
 */
export function applyPosOverlayToReadBody(readBodyRoot, opts) {
  if (!readBodyRoot || typeof readBodyRoot.querySelector !== 'function') return;

  const roots = opts.contentTypeHtml
    ? Array.from(readBodyRoot.querySelectorAll('.nn-body-html'))
    : [readBodyRoot];

  for (const el of roots) {
    if (!(el instanceof Element)) continue;
    walkAndTransform(el);
  }
}
