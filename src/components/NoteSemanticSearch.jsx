import { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { getSupabase } from '../lib/supabaseClient.js';
import { searchNotesSemantic } from '../lib/semanticSearch.js';
import styles from './NoteSemanticSearch.module.css';

/**
 * Semantic search UI phase (Library, Cards, and anywhere else this panel is used).
 * - idle: no semantic results / errors shown; normal library list is the focus
 * - loading: request in flight
 * - success: results list visible
 * - no_results: search finished with zero matches
 * - error: search failed
 *
 * @typedef {'idle' | 'loading' | 'success' | 'no_results' | 'error'} SearchPhase
 */

/**
 * @param {{ noteDetailLinkState: { from?: string } }} props
 */
export default function NoteSemanticSearch({ noteDetailLinkState }) {
  const location = useLocation();
  const [queryInput, setQueryInput] = useState('');
  /** Phase of the semantic search UI (not the whole page). */
  const [searchPhase, setSearchPhase] = useState(/** @type {SearchPhase} */ ('idle'));
  const [results, setResults] = useState(
    /** @type {{ noteId: string, title: string, snippet: string, similarity: number }[]} */ ([]),
  );
  const [error, setError] = useState(/** @type {string | null} */ (null));
  /** Trimmed query last submitted successfully (success, no_results, or error). Used to drop stale results when the user edits the input. */
  const [lockedQuery, setLockedQuery] = useState(/** @type {string | null} */ (null));

  const exitSemanticSearch = useCallback(() => {
    setQueryInput('');
    setResults([]);
    setError(null);
    setSearchPhase('idle');
    setLockedQuery(null);
  }, []);

  const handleQueryChange = useCallback(
    (value) => {
      setQueryInput(value);
      const t = value.trim();
      if (t === '') {
        exitSemanticSearch();
        return;
      }
      if (lockedQuery !== null && t !== lockedQuery) {
        setResults([]);
        setError(null);
        setSearchPhase('idle');
        setLockedQuery(null);
      }
    },
    [lockedQuery, exitSemanticSearch],
  );

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const query = queryInput.trim();
      if (!query) {
        exitSemanticSearch();
        return;
      }
      setError(null);
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
    [queryInput, exitSemanticSearch],
  );

  const onInputKeyDown = useCallback(
    (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (searchPhase === 'loading') return;
      exitSemanticSearch();
    },
    [searchPhase, exitSemanticSearch],
  );

  const linkState = noteDetailLinkState ?? { from: `${location.pathname}${location.search}` };

  const showSemanticPanel =
    searchPhase === 'success' || searchPhase === 'no_results' || searchPhase === 'error';
  const showExitSearch =
    showSemanticPanel && searchPhase !== 'loading';
  const showInputClear = queryInput.length > 0 && searchPhase !== 'loading';

  return (
    <section className={styles.panel} aria-label="Semantic search">
      <div className={styles.header}>
        <Sparkles className={styles.headerIcon} strokeWidth={2} aria-hidden />
        <h2 className={styles.title}>Semantic Search</h2>
        <p className={styles.hint} id="semantic-search-hint">
          Finds notes by meaning.
        </p>
        {showExitSearch ? (
          <button
            type="button"
            className={styles.exitSearch}
            onClick={exitSemanticSearch}
            aria-label="Exit semantic search"
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
            placeholder="Ask in plain language..."
            value={queryInput}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={onInputKeyDown}
            autoComplete="off"
            disabled={searchPhase === 'loading'}
            aria-label="Semantic search query"
            aria-describedby="semantic-search-hint"
          />
          {showInputClear ? (
            <button
              type="button"
              className={styles.inputClear}
              onClick={exitSemanticSearch}
              aria-label="Clear semantic search"
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
          aria-label={searchPhase === 'loading' ? 'Searching' : 'Run semantic search'}
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
          No notes matched your search. Try different words, or add notes that cover this topic.
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
              <div className={styles.score}>
                Match{' '}
                {Math.floor(
                  Math.min(1, Math.max(0, typeof r.similarity === 'number' ? r.similarity : Number(r.similarity) || 0)) *
                    100,
                )}
                %
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
