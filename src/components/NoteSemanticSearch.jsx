import { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Sparkles, X } from 'lucide-react';
import { getSupabase } from '../lib/supabaseClient.js';
import { searchNotesSemantic } from '../lib/semanticSearch.js';
import { useNotes } from '../context/NotesContext.jsx';
import { searchNotesKeyword, snippetFromHtml } from '../utils/keywordSearch.js';
import styles from './NoteSemanticSearch.module.css';

/**
 * Which retrieval strategy is active.
 *
 * - `semantic`  Uses the `search-notes-semantic` edge function (PGVector/gte-small).
 *               Good for concept/meaning-based discovery.
 * - `keyword`   Client-side substring match on title, body plain text, and labels.
 *               Good for exact phrases, titles, names, and specific terms.
 *
 * Future: a `hybrid` mode will merge both signals into one ranked result set.
 *
 * @typedef {'semantic' | 'keyword'} SearchMode
 */

/**
 * UI phase for the current active search.
 *
 * - `idle`       No results or errors shown; the main library list is the focus.
 * - `loading`    Request in flight (semantic only; keyword is synchronous).
 * - `success`    Results list is visible.
 * - `no_results` Search finished with zero matches.
 * - `error`      Search failed (semantic only).
 *
 * @typedef {'idle' | 'loading' | 'success' | 'no_results' | 'error'} SearchPhase
 */

/**
 * @param {{ noteDetailLinkState?: { from?: string } }} props
 */
export default function NoteSemanticSearch({ noteDetailLinkState }) {
  const location = useLocation();
  const { notes } = useNotes();

  const [searchMode, setSearchMode] = useState(/** @type {SearchMode} */ ('semantic'));
  const [queryInput, setQueryInput] = useState('');
  const [searchPhase, setSearchPhase] = useState(/** @type {SearchPhase} */ ('idle'));
  const [results, setResults] = useState(
    /** @type {{ noteId: string, title: string, snippet: string, similarity?: number }[]} */ ([]),
  );
  const [error, setError] = useState(/** @type {string | null} */ (null));
  /** Trimmed query last submitted (success, no_results, or error). Used to drop stale results on edit. */
  const [lockedQuery, setLockedQuery] = useState(/** @type {string | null} */ (null));

  const resetSearch = useCallback(() => {
    setQueryInput('');
    setResults([]);
    setError(null);
    setSearchPhase('idle');
    setLockedQuery(null);
  }, []);

  const switchMode = useCallback(
    (/** @type {SearchMode} */ mode) => {
      setSearchMode(mode);
      resetSearch();
    },
    [resetSearch],
  );

  const handleQueryChange = useCallback(
    (value) => {
      setQueryInput(value);
      const t = value.trim();
      if (t === '') {
        resetSearch();
        return;
      }
      if (lockedQuery !== null && t !== lockedQuery) {
        setResults([]);
        setError(null);
        setSearchPhase('idle');
        setLockedQuery(null);
      }
    },
    [lockedQuery, resetSearch],
  );

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const query = queryInput.trim();
      if (!query) {
        resetSearch();
        return;
      }
      setError(null);

      if (searchMode === 'keyword') {
        const matched = searchNotesKeyword(notes, query);
        const rows = matched.map((note) => ({
          noteId: note.id,
          title: note.title ?? '',
          snippet: snippetFromHtml(note.bodyHtml ?? ''),
        }));
        setLockedQuery(query);
        setResults(rows);
        setSearchPhase(rows.length > 0 ? 'success' : 'no_results');
        return;
      }

      // Semantic mode — requires Supabase edge function
      const supabase = getSupabase();
      if (!supabase) {
        setError('Supabase is not configured.');
        setSearchPhase('error');
        setLockedQuery(query);
        setResults([]);
        return;
      }
      setSearchPhase('loading');
      try {
        const { results: rows } = await searchNotesSemantic(supabase, query, 8);
        setLockedQuery(query);
        setResults(rows);
        setSearchPhase(rows.length > 0 ? 'success' : 'no_results');
      } catch (err) {
        setResults([]);
        setLockedQuery(query);
        setError(err instanceof Error ? err.message : 'Search failed');
        setSearchPhase('error');
      }
    },
    [queryInput, resetSearch, searchMode, notes],
  );

  const onInputKeyDown = useCallback(
    (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (searchPhase === 'loading') return;
      resetSearch();
    },
    [searchPhase, resetSearch],
  );

  const linkState = noteDetailLinkState ?? { from: `${location.pathname}${location.search}` };

  const showResultsPanel =
    searchPhase === 'success' || searchPhase === 'no_results' || searchPhase === 'error';
  const showExitSearch = showResultsPanel && searchPhase !== 'loading';
  const showInputClear = queryInput.length > 0 && searchPhase !== 'loading';

  const headingText = searchMode === 'keyword' ? 'Keyword Search' : 'Semantic Search';
  const placeholder =
    searchMode === 'keyword'
      ? 'Search exact words, titles, labels…'
      : 'Ask in plain language…';
  const sectionAriaLabel = searchMode === 'keyword' ? 'Keyword search' : 'Semantic search';
  const inputAriaLabel =
    searchMode === 'keyword'
      ? 'Keyword search: search exact words, titles, labels'
      : 'Semantic search: ask in plain language';
  const HeaderIcon = searchMode === 'keyword' ? Search : Sparkles;

  return (
    <section className={styles.panel} aria-label={sectionAriaLabel}>
      <div className={styles.header}>
        <HeaderIcon className={styles.headerIcon} strokeWidth={2} aria-hidden />
        <h2 className={styles.title}>{headingText}</h2>
        <div className={styles.modeToggle} role="group" aria-label="Search mode">
          <button
            type="button"
            className={`${styles.modeBtn} ${searchMode === 'semantic' ? styles.modeBtnActive : ''}`}
            aria-pressed={searchMode === 'semantic'}
            onClick={() => switchMode('semantic')}
          >
            Semantic
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${searchMode === 'keyword' ? styles.modeBtnActive : ''}`}
            aria-pressed={searchMode === 'keyword'}
            onClick={() => switchMode('keyword')}
          >
            Keyword
          </button>
        </div>
        {showExitSearch ? (
          <button
            type="button"
            className={styles.exitSearch}
            onClick={resetSearch}
            aria-label={`Exit ${searchMode} search`}
          >
            Exit search
          </button>
        ) : null}
      </div>
      <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
        <div className={styles.inputWrap}>
          <input
            type="text"
            className={styles.input}
            enterKeyHint="search"
            placeholder={placeholder}
            value={queryInput}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={onInputKeyDown}
            autoComplete="off"
            disabled={searchPhase === 'loading'}
            aria-label={inputAriaLabel}
          />
          {showInputClear ? (
            <button
              type="button"
              className={styles.inputClear}
              onClick={resetSearch}
              aria-label={`Clear ${searchMode} search`}
            >
              <X className={styles.inputClearIcon} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>
        <button
          type="submit"
          className={styles.submit}
          disabled={searchPhase === 'loading'}
          aria-busy={searchPhase === 'loading'}
          aria-label={searchPhase === 'loading' ? 'Searching' : `Run ${searchMode} search`}
        >
          {searchPhase === 'loading' ? 'Searching…' : 'Search'}
        </button>
      </form>
      {searchPhase === 'error' && error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {searchPhase === 'no_results' ? (
        <p className={styles.noMatches} role="status">
          {searchMode === 'keyword'
            ? 'No notes matched your search. Try different words, a title, or a label.'
            : 'No notes matched your search. Try different words, or add notes that cover this topic.'}
        </p>
      ) : null}
      {searchPhase === 'success' && results.length > 0 ? (
        <ul className={styles.results}>
          {results.map((r) => (
            <li key={r.noteId} className={styles.resultRow}>
              <Link to={`/notes/${r.noteId}`} state={linkState} className={styles.resultLink}>
                {r.title?.trim() || 'Untitled'}
              </Link>
              {r.snippet ? <p className={styles.snippet}>{r.snippet}</p> : null}
              {typeof r.similarity === 'number' ? (
                <div className={styles.score}>
                  Match{' '}
                  {Math.floor(
                    Math.min(1, Math.max(0, r.similarity)) * 100,
                  )}
                  %
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
