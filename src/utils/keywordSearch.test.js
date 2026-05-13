import { describe, expect, it } from 'vitest';
import {
  searchNotesKeyword,
  snippetFromHtml,
  stripHtml,
  tokenizeKeywordQuery,
} from './keywordSearch.js';
import { searchNotesSemantic } from '../lib/semanticSearch.js';

describe('semantic search integration (unchanged surface)', () => {
  it('searchNotesSemantic is still exported for NoteSemanticSearch', () => {
    expect(typeof searchNotesSemantic).toBe('function');
  });
});

// ─── stripHtml ──────────────────────────────────────────────────────────────

describe('stripHtml', () => {
  it('returns empty string for falsy input', () => {
    expect(stripHtml('')).toBe('');
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
  });

  it('strips basic HTML tags', () => {
    expect(stripHtml('<p>Hello world</p>')).toBe('Hello world');
  });

  it('collapses multiple whitespace', () => {
    expect(stripHtml('<p>foo</p>  <p>bar</p>')).toBe('foo bar');
  });

  it('strips script and style blocks entirely', () => {
    expect(stripHtml('<script>alert("x")</script>visible')).toBe('visible');
    expect(stripHtml('<style>.a{color:red}</style>visible')).toBe('visible');
  });
});

// ─── snippetFromHtml ────────────────────────────────────────────────────────

describe('snippetFromHtml', () => {
  it('returns full text when shorter than max', () => {
    expect(snippetFromHtml('<p>short</p>')).toBe('short');
  });

  it('truncates long text and appends ellipsis', () => {
    const html = `<p>${'a'.repeat(300)}</p>`;
    const result = snippetFromHtml(html, 220);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(221); // 220 chars + ellipsis
  });
});

// ─── tokenizeKeywordQuery ───────────────────────────────────────────────────

describe('tokenizeKeywordQuery', () => {
  it('returns [] for empty or whitespace-only', () => {
    expect(tokenizeKeywordQuery('')).toEqual([]);
    expect(tokenizeKeywordQuery('   ')).toEqual([]);
  });

  it('splits on whitespace and lowercases', () => {
    expect(tokenizeKeywordQuery('Joe Dentist')).toEqual(['joe', 'dentist']);
  });

  it('collapses extra spaces into separate tokens only (no empty tokens)', () => {
    expect(tokenizeKeywordQuery('  joe   dentist  ')).toEqual(['joe', 'dentist']);
  });

  it('returns single token for one word', () => {
    expect(tokenizeKeywordQuery('hello')).toEqual(['hello']);
  });

  it('returns [] for non-string', () => {
    expect(tokenizeKeywordQuery(/** @type {any} */ (null))).toEqual([]);
  });
});

// ─── searchNotesKeyword ─────────────────────────────────────────────────────

const makeNote = (overrides) => ({
  id: 'note-1',
  title: 'Default title',
  bodyHtml: '<p>Default body</p>',
  labels: [],
  ...overrides,
});

describe('searchNotesKeyword – empty / whitespace queries', () => {
  it('returns [] for empty string', () => {
    expect(searchNotesKeyword([makeNote()], '')).toEqual([]);
  });

  it('returns [] for whitespace-only string', () => {
    expect(searchNotesKeyword([makeNote()], '   ')).toEqual([]);
  });

  it('returns [] when notes array is empty', () => {
    expect(searchNotesKeyword([], 'anything')).toEqual([]);
  });
});

describe('searchNotesKeyword – title matching', () => {
  const notes = [
    makeNote({ id: 'a', title: 'Meeting notes from Monday' }),
    makeNote({ id: 'b', title: 'Shopping list' }),
  ];

  it('finds note by exact title word', () => {
    const results = searchNotesKeyword(notes, 'Meeting');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('a');
  });

  it('finds note by case-insensitive title word', () => {
    const results = searchNotesKeyword(notes, 'meeting');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('a');
  });

  it('finds note by partial title word', () => {
    const results = searchNotesKeyword(notes, 'shop');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('b');
  });

  it('returns [] when title does not match', () => {
    expect(searchNotesKeyword(notes, 'xyz')).toEqual([]);
  });
});

describe('searchNotesKeyword – body matching', () => {
  const notes = [
    makeNote({ id: 'x', title: 'Untitled', bodyHtml: '<p>The quick brown fox</p>' }),
    makeNote({ id: 'y', title: 'Untitled', bodyHtml: '<p>Lazy dog</p>' }),
  ];

  it('finds note by body text after stripping HTML', () => {
    const results = searchNotesKeyword(notes, 'quick brown');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('x');
  });

  it('is case-insensitive for body text', () => {
    const results = searchNotesKeyword(notes, 'LAZY DOG');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('y');
  });

  it('does not match HTML tag names as content', () => {
    // "<p>" should not match a query of "p" because the tag is stripped
    const plain = makeNote({ id: 'z', title: 'Z', bodyHtml: '<p>content</p>' });
    // "content" matches body
    expect(searchNotesKeyword([plain], 'content')).toHaveLength(1);
    // "p" should NOT match because the tag itself is stripped
    // (it would only match if the plain text actually contained the letter p)
    const noP = makeNote({ id: 'nop', title: 'No Match', bodyHtml: '<div>xyz</div>' });
    expect(searchNotesKeyword([noP], 'p')).toHaveLength(0);
  });
});

describe('searchNotesKeyword – label matching', () => {
  const notes = [
    makeNote({ id: 'l1', labels: ['work', 'urgent'] }),
    makeNote({ id: 'l2', labels: ['personal'] }),
  ];

  it('finds note by label', () => {
    const results = searchNotesKeyword(notes, 'work');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('l1');
  });

  it('finds note by label case-insensitively', () => {
    const results = searchNotesKeyword(notes, 'URGENT');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('l1');
  });

  it('finds note by partial label match', () => {
    const results = searchNotesKeyword(notes, 'person');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('l2');
  });
});

describe('searchNotesKeyword – multi-word AND (tokens)', () => {
  it('matches when all words are in the title', () => {
    const note = makeNote({ id: '1', title: 'Joe dentist appointment', bodyHtml: '<p>x</p>' });
    expect(searchNotesKeyword([note], 'joe dentist')).toHaveLength(1);
  });

  it('matches when words are split across title and body', () => {
    const note = makeNote({
      id: '2',
      title: 'Joe',
      bodyHtml: '<p>Visit the dentist tomorrow</p>',
    });
    expect(searchNotesKeyword([note], 'joe dentist')).toHaveLength(1);
  });

  it('matches when words are split across label and body', () => {
    const note = makeNote({
      id: '3',
      title: 'Reminder',
      bodyHtml: '<p>dentist at 3pm</p>',
      labels: ['joe'],
    });
    expect(searchNotesKeyword([note], 'joe dentist')).toHaveLength(1);
  });

  it('does not match when only one token is present', () => {
    const onlyJoe = makeNote({ id: 'a', title: 'Joe', bodyHtml: '<p>nothing else</p>' });
    const onlyDentist = makeNote({ id: 'b', title: 'dentist', bodyHtml: '<p>alone</p>' });
    expect(searchNotesKeyword([onlyJoe, onlyDentist], 'joe dentist')).toEqual([]);
  });

  it('single-word search still matches one token in any field', () => {
    const note = makeNote({ id: 's', title: 'Solo', bodyHtml: '<p>word</p>' });
    expect(searchNotesKeyword([note], 'word')).toHaveLength(1);
  });
});

describe('searchNotesKeyword – cross-field matching', () => {
  it('returns all notes that match across different fields', () => {
    const notes = [
      makeNote({ id: 'a', title: 'project alpha', bodyHtml: '<p>unrelated</p>', labels: [] }),
      makeNote({ id: 'b', title: 'untitled', bodyHtml: '<p>project details here</p>', labels: [] }),
      makeNote({ id: 'c', title: 'untitled', bodyHtml: '<p>nothing</p>', labels: ['project'] }),
      makeNote({ id: 'd', title: 'no match', bodyHtml: '<p>nothing</p>', labels: [] }),
    ];
    const results = searchNotesKeyword(notes, 'project');
    const ids = results.map((n) => n.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).toContain('c');
    expect(ids).not.toContain('d');
  });
});

describe('searchNotesKeyword – null/undefined field safety', () => {
  it('handles notes with null title gracefully', () => {
    const note = makeNote({ id: 'safe', title: null, bodyHtml: '<p>safe content</p>' });
    expect(() => searchNotesKeyword([note], 'safe')).not.toThrow();
    expect(searchNotesKeyword([note], 'safe')).toHaveLength(1);
  });

  it('handles notes with null bodyHtml gracefully', () => {
    const note = makeNote({ id: 'safe2', title: 'safe title', bodyHtml: null });
    expect(() => searchNotesKeyword([note], 'safe')).not.toThrow();
    expect(searchNotesKeyword([note], 'safe')).toHaveLength(1);
  });

  it('handles notes with undefined labels gracefully', () => {
    const note = makeNote({ id: 'safe3', title: 'title', bodyHtml: '<p>body</p>', labels: undefined });
    expect(() => searchNotesKeyword([note], 'title')).not.toThrow();
    expect(searchNotesKeyword([note], 'title')).toHaveLength(1);
  });
});
