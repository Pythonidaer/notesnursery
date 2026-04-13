import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Toast from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotes } from '../context/NotesContext.jsx';
import { useSupabaseBackend } from '../config/appConfig.js';
import {
  fetchLabelIdByUserAndName,
  updateDefaultLabelId,
} from '../data/profileSupabase.js';
import { useInitialLabelFilter } from '../hooks/useInitialLabelFilter.js';
import { collectAllLabels, filterNotesByLabel } from '../utils/noteLabels.js';
import FloatingNewNoteComposer from '../components/FloatingNewNoteComposer.jsx';
import PlusIcon from '../components/PlusIcon.jsx';
import ComedyRatingSortToggle from '../components/ComedyRatingSortToggle.jsx';
import ComedyRatingTrigger from '../components/ComedyRatingTrigger.jsx';
import {
  applyComedyRatingSortToGroups,
  isAdminComedyRatingUser,
  sortNotesForCardsOrLibrary,
} from '../utils/comedyRating.js';
import {
  deriveDateFilterOptions,
  filterNotesByDateBucket,
  groupNotesByDate,
} from '../utils/groupNotesByDate.js';
import NoteFiltersToolbar from '../components/NoteFiltersToolbar.jsx';
import NoteRowLabelChips from '../components/NoteRowLabelChips.jsx';
import styles from './LibraryPage.module.css';

export default function LibraryPage() {
  const { notes, loading, error } = useNotes();
  const {
    user,
    defaultLabelId,
    defaultLabelName,
    profilePreferencesLoaded,
    applyDefaultLabelPreference,
  } = useAuth();
  const useRemote = useSupabaseBackend();
  const navigate = useNavigate();
  const location = useLocation();
  const noteDetailLinkState = useMemo(
    () => ({ from: `${location.pathname}${location.search}` }),
    [location.pathname, location.search]
  );
  const [toastMessage, setToastMessage] = useState(/** @type {string | null} */ (null));
  const dismissToast = useCallback(() => setToastMessage(null), []);
  const [groupByDate, setGroupByDate] = useState(false);
  const [labelFilter, setLabelFilter] = useInitialLabelFilter({
    defaultLabelName,
    profilePreferencesLoaded,
    useRemote,
    userId: user?.id,
  });
  const [dateFilter, setDateFilter] = useState(/** @type {string} */ ('all'));
  const [defaultLabelSaving, setDefaultLabelSaving] = useState(false);
  const [ratingSortMode, setRatingSortMode] = useState(/** @type {'off' | 'high' | 'low'} */ ('off'));
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    const msg = location.state?.flashToast;
    if (typeof msg === 'string') {
      setToastMessage(msg);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  const allLabels = useMemo(() => collectAllLabels(notes), [notes]);
  const labelSelectOptions = useMemo(() => {
    const merged = new Set(allLabels);
    if (defaultLabelName) merged.add(defaultLabelName);
    return [...merged].sort((a, b) => a.localeCompare(b));
  }, [allLabels, defaultLabelName]);
  const dateOptions = useMemo(() => deriveDateFilterOptions(notes), [notes]);

  useEffect(() => {
    const valid = new Set(dateOptions.map((o) => o.value));
    if (!valid.has(dateFilter)) setDateFilter('all');
  }, [dateOptions, dateFilter]);

  const filteredNotes = useMemo(() => {
    const byLabel = filterNotesByLabel(notes, labelFilter);
    return filterNotesByDateBucket(byLabel, dateFilter);
  }, [notes, labelFilter, dateFilter]);

  const handleSetDefaultLabel = useCallback(async () => {
    if (!user?.id || !useRemote) return;
    if (labelFilter === 'all' || labelFilter === 'unlabeled') return;
    setDefaultLabelSaving(true);
    try {
      const labelId = await fetchLabelIdByUserAndName(user.id, labelFilter);
      if (!labelId) {
        setToastMessage('Could not find that label.');
        return;
      }
      await updateDefaultLabelId(user.id, labelId);
      applyDefaultLabelPreference(labelId, labelFilter);
      setToastMessage('Default label set');
    } catch (e) {
      setToastMessage(e instanceof Error ? e.message : 'Could not save default label');
    } finally {
      setDefaultLabelSaving(false);
    }
  }, [user?.id, useRemote, labelFilter, applyDefaultLabelPreference]);

  const handleClearDefaultLabel = useCallback(async () => {
    if (!user?.id || !useRemote) return;
    setDefaultLabelSaving(true);
    try {
      await updateDefaultLabelId(user.id, null);
      applyDefaultLabelPreference(null, null);
      setToastMessage('Default label cleared');
    } catch (e) {
      setToastMessage(e instanceof Error ? e.message : 'Could not clear default label');
    } finally {
      setDefaultLabelSaving(false);
    }
  }, [user?.id, useRemote, applyDefaultLabelPreference]);

  const handleResetFilters = useCallback(() => {
    setLabelFilter('all');
    setDateFilter('all');
  }, [setLabelFilter, setDateFilter]);

  const cycleRatingSort = useCallback(() => {
    setRatingSortMode((m) => (m === 'off' ? 'high' : m === 'high' ? 'low' : 'off'));
  }, []);

  const sortedFlat = useMemo(
    () => sortNotesForCardsOrLibrary(filteredNotes, ratingSortMode),
    [filteredNotes, ratingSortMode]
  );
  const groups = useMemo(
    () => applyComedyRatingSortToGroups(groupNotesByDate(filteredNotes), ratingSortMode),
    [filteredNotes, ratingSortMode]
  );

  const filtersActive = labelFilter !== 'all' || dateFilter !== 'all';

  const toastEl = <Toast message={toastMessage} onDismiss={dismissToast} />;
  const waitingForPrefs = useRemote && user && !profilePreferencesLoaded && notes.length > 0;

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

  if (waitingForPrefs) {
    return (
      <>
        <div className={styles.wrap}>
          <p className={styles.loading}>Loading preferences…</p>
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

  return (
    <>
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <h1 className={styles.heading}>Library</h1>
        <div className={styles.topBarEnd}>
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
            {isAdminComedyRatingUser(user) ? (
              <ComedyRatingSortToggle
                mode={ratingSortMode}
                onCycle={cycleRatingSort}
                className={`${styles.segmentBtn} ${ratingSortMode !== 'off' ? styles.segmentBtnActive : ''}`}
              />
            ) : null}
          </div>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setComposerOpen(true)}
            aria-label="Add new note"
            title="Add note"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <NoteFiltersToolbar
        idPrefix="library"
        labelFilter={labelFilter}
        setLabelFilter={setLabelFilter}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        dateOptions={dateOptions}
        labelSelectOptions={labelSelectOptions}
        defaultLabelName={defaultLabelName}
        defaultLabelId={defaultLabelId}
        defaultLabelSaving={defaultLabelSaving}
        useRemote={useRemote}
        user={user}
        filtersActive={filtersActive}
        onSetDefault={handleSetDefaultLabel}
        onClearDefault={handleClearDefaultLabel}
        onResetFilters={handleResetFilters}
      />

      {filteredNotes.length === 0 ? (
        <p className={styles.noMatches}>No notes match your filters.</p>
      ) : !groupByDate ? (
        <ul className={styles.list}>
          {sortedFlat.map((note) => (
            <li key={note.id}>
              <div className={styles.row}>
                <span className={styles.rowLeft}>
                  <Link to={`/notes/${note.id}`} state={noteDetailLinkState} className={styles.titleLink}>
                    <span className={styles.titleOnly}>{note.title}</span>
                  </Link>
                  <ComedyRatingTrigger note={note} variant="library" />
                </span>
                <NoteRowLabelChips labels={note.labels} />
              </div>
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
                    <div className={styles.row}>
                      <span className={styles.rowLeft}>
                        <Link to={`/notes/${note.id}`} state={noteDetailLinkState} className={styles.titleLink}>
                          <span className={styles.titleOnly}>{note.title}</span>
                        </Link>
                        <ComedyRatingTrigger note={note} variant="library" />
                      </span>
                      <NoteRowLabelChips labels={note.labels} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
    <FloatingNewNoteComposer visible={composerOpen} onRequestClose={() => setComposerOpen(false)} />
    {toastEl}
    </>
  );
}
