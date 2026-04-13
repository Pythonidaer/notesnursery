import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import NoteCard from '../components/NoteCard.jsx';
import NoteFiltersToolbar from '../components/NoteFiltersToolbar.jsx';
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
import {
  deriveDateFilterOptions,
  filterNotesByDateBucket,
  groupNotesByDate,
  sortNotesByEffectiveDateDesc,
} from '../utils/groupNotesByDate.js';
import styles from '../styles/CardsPage.module.css';

export default function CardsPage() {
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

  const groups = groupNotesByDate(filteredNotes);
  const sortedFlat = sortNotesByEffectiveDateDesc(filteredNotes);

  return (
    <>
      <div className={styles.wrap}>
        <div className={styles.topBar}>
          <h1 className={styles.heading}>Cards</h1>
          <div className={styles.segment} role="group" aria-label="Cards view">
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

        <NoteFiltersToolbar
          idPrefix="cards"
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
          <div className={styles.grid}>
            {sortedFlat.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        ) : (
          <div className={styles.grouped}>
            {groups.map((group) => (
              <section key={group.key} className={styles.groupSection}>
                <h2 className={styles.groupHeading}>{group.label}</h2>
                <div className={styles.grid}>
                  {group.notes.map((note) => (
                    <NoteCard key={note.id} note={note} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      {toastEl}
    </>
  );
}
