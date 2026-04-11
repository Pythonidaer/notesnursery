import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotes } from '../context/NotesContext.jsx';
import { collectAllLabels, filterNotesByLabel } from '../utils/noteLabels.js';
import { groupNotesByDate, sortNotesByEffectiveDateDesc } from '../utils/groupNotesByDate.js';
import styles from './LibraryPage.module.css';

export default function LibraryPage() {
  const { notes, loading, error } = useNotes();
  const [groupByDate, setGroupByDate] = useState(false);
  const [labelFilter, setLabelFilter] = useState(/** @type {'all' | 'unlabeled' | string} */ ('all'));

  const allLabels = useMemo(() => collectAllLabels(notes), [notes]);

  const filteredNotes = useMemo(
    () => filterNotesByLabel(notes, labelFilter),
    [notes, labelFilter]
  );

  if (loading && notes.length === 0) {
    return (
      <div className={styles.wrap}>
        <p className={styles.loading}>Loading notes…</p>
      </div>
    );
  }

  if (error && notes.length === 0) {
    return (
      <div className={styles.wrap}>
        <p className={styles.errorBanner}>{error}</p>
        <Link to="/" className={styles.primaryLink}>
          Back to import
        </Link>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
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
    );
  }

  const groups = groupNotesByDate(filteredNotes);
  const sortedFlat = sortNotesByEffectiveDateDesc(filteredNotes);

  return (
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

      <div className={styles.filterRow}>
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

      {filteredNotes.length === 0 ? (
        <p className={styles.noMatches}>No notes match this label filter.</p>
      ) : !groupByDate ? (
        <ul className={styles.list}>
          {sortedFlat.map((note) => (
            <li key={note.id}>
              <Link to={`/notes/${note.id}`} className={styles.row}>
                <span className={styles.titleOnly}>{note.title}</span>
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
                      <span className={styles.titleOnly}>{note.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
