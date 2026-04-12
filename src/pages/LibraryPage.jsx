import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Toast from '../components/Toast.jsx';
import { useNotes } from '../context/NotesContext.jsx';
import { collectAllLabels, filterNotesByLabel } from '../utils/noteLabels.js';
import {
  deriveDateFilterOptions,
  filterNotesByDateBucket,
  groupNotesByDate,
  sortNotesByEffectiveDateDesc,
} from '../utils/groupNotesByDate.js';
import NoteRowLabelChips from '../components/NoteRowLabelChips.jsx';
import styles from './LibraryPage.module.css';

export default function LibraryPage() {
  const { notes, loading, error } = useNotes();
  const navigate = useNavigate();
  const location = useLocation();
  const [toastMessage, setToastMessage] = useState(/** @type {string | null} */ (null));
  const dismissToast = useCallback(() => setToastMessage(null), []);
  const [groupByDate, setGroupByDate] = useState(false);
  const [labelFilter, setLabelFilter] = useState(/** @type {'all' | 'unlabeled' | string} */ ('all'));
  const [dateFilter, setDateFilter] = useState(/** @type {string} */ ('all'));

  useEffect(() => {
    const msg = location.state?.flashToast;
    if (typeof msg === 'string') {
      setToastMessage(msg);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  const allLabels = useMemo(() => collectAllLabels(notes), [notes]);
  const dateOptions = useMemo(() => deriveDateFilterOptions(notes), [notes]);

  useEffect(() => {
    const valid = new Set(dateOptions.map((o) => o.value));
    if (!valid.has(dateFilter)) setDateFilter('all');
  }, [dateOptions, dateFilter]);

  const filteredNotes = useMemo(() => {
    const byLabel = filterNotesByLabel(notes, labelFilter);
    return filterNotesByDateBucket(byLabel, dateFilter);
  }, [notes, labelFilter, dateFilter]);

  const toastEl = <Toast message={toastMessage} onDismiss={dismissToast} />;

  if (loading && notes.length === 0) {
    return (
      <>
        <div className={styles.wrap}>
          <p className={styles.loading}>Loading notes…</p>
        </div>
        {toastEl}
      </>
    );
  }

  if (error && notes.length === 0) {
    return (
      <>
        <div className={styles.wrap}>
          <p className={styles.errorBanner}>{error}</p>
          <Link to="/" className={styles.primaryLink}>
            Back to import
          </Link>
        </div>
        {toastEl}
      </>
    );
  }

  if (notes.length === 0) {
    return (
      <>
        <div className={styles.empty}>
          <h1 className={styles.heading}>Your library is empty</h1>
          <p className={styles.emptyLead}>
            Import some exported notes to see them here. In local mode nothing is persisted; in
            production notes load from your account after sign-in.
          </p>
          <Link to="/" className={styles.primaryLink}>
            Go to import
          </Link>
        </div>
        {toastEl}
      </>
    );
  }

  const groups = groupNotesByDate(filteredNotes);
  const sortedFlat = sortNotesByEffectiveDateDesc(filteredNotes);

  return (
    <>
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <h1 className={styles.heading}>Library</h1>
        <div className={styles.segment} role="group" aria-label="Library view">
          <button
            type="button"
            className={`${styles.segmentBtn} ${!groupByDate ? styles.segmentBtnActive : ''}`}
            aria-pressed={!groupByDate}
            onClick={() => setGroupByDate(false)}
          >
            All Notes
          </button>
          <button
            type="button"
            className={`${styles.segmentBtn} ${groupByDate ? styles.segmentBtnActive : ''}`}
            aria-pressed={groupByDate}
            onClick={() => setGroupByDate(true)}
          >
            Group by Date
          </button>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="library-label-filter">
            Labels
          </label>
          <select
            id="library-label-filter"
            className={styles.filterSelect}
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
          >
            <option value="all">All notes</option>
            <option value="unlabeled">Unlabeled</option>
            {allLabels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="library-date-filter">
            Date
          </label>
          <select
            id="library-date-filter"
            className={styles.filterSelect}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            {dateOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredNotes.length === 0 ? (
        <p className={styles.noMatches}>No notes match your filters.</p>
      ) : !groupByDate ? (
        <ul className={styles.list}>
          {sortedFlat.map((note) => (
            <li key={note.id}>
              <Link to={`/notes/${note.id}`} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.titleOnly}>{note.title}</span>
                </span>
                <NoteRowLabelChips labels={note.labels} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.grouped}>
          {groups.map((group) => (
            <section key={group.key} className={styles.groupSection}>
              <h2 className={styles.groupHeading}>{group.label}</h2>
              <ul className={styles.list}>
                {group.notes.map((note) => (
                  <li key={note.id}>
                    <Link to={`/notes/${note.id}`} className={styles.row}>
                      <span className={styles.rowMain}>
                        <span className={styles.titleOnly}>{note.title}</span>
                      </span>
                      <NoteRowLabelChips labels={note.labels} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
    {toastEl}
    </>
  );
}
