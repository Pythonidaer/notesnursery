import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { navigateToLoginWithReturn } from '../lib/authReturnPath.js';
import DeleteNoteModal from '../components/DeleteNoteModal.jsx';
import labelChipStyles from '../components/LabelPicker.module.css';
import NoteInfoCircleIcon from '../components/NoteInfoCircleIcon.jsx';
import Toast from '../components/Toast.jsx';
import VoiceMemoInfoModal from '../components/VoiceMemoInfoModal.jsx';
import PageContentWrap from '../components/PageContentWrap.jsx';
import { useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotes } from '../context/NotesContext.jsx';
import { deleteUserNoteAudioFile } from '../lib/noteAudioDelete.js';
import { listUserNoteAudioFiles } from '../lib/noteAudioList.js';
import { prefetchNoteAudioDurations } from '../lib/prefetchNoteAudioDurations.js';
import {
  buildAudioPathNoteUsageMap,
  formatVoiceMemoNoteUsage,
} from '../utils/noteAudioEmbedUsage.js';
import styles from './VoiceMemosPage.module.css';

export default function VoiceMemosPage() {
  const location = useLocation();
  const remote = useSupabaseBackend();
  const { user, authInitializing } = useAuth();
  const { notes, noteListReady } = useNotes();
  const [files, setFiles] = useState(
    /** @type {Awaited<ReturnType<typeof listUserNoteAudioFiles>>} */ ([])
  );
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState(/** @type {string | null} */ (null));
  const [deletingPath, setDeletingPath] = useState(/** @type {string | null} */ (null));
  const [deleteTarget, setDeleteTarget] = useState(
    /** @type {Awaited<ReturnType<typeof listUserNoteAudioFiles>>[number] | null} */ (null)
  );
  const [infoTarget, setInfoTarget] = useState(
    /** @type {Awaited<ReturnType<typeof listUserNoteAudioFiles>>[number] | null} */ (null)
  );
  const [durationByPath, setDurationByPath] = useState(
    /** @type {Record<string, number | null>} */ ({})
  );
  const [pageError, setPageError] = useState(/** @type {string | null} */ (null));
  const [successMessage, setSuccessMessage] = useState(/** @type {string | null} */ (null));
  const dismissSuccess = useCallback(() => setSuccessMessage(null), []);

  const usageByPath = useMemo(() => {
    if (!noteListReady || files.length === 0) return {};
    return buildAudioPathNoteUsageMap(notes, files.map((row) => row.path));
  }, [noteListReady, notes, files]);

  const openInfoModal = useCallback(
    async (row) => {
      if (durationByPath[row.path] === undefined) {
        const map = await prefetchNoteAudioDurations([row.path]);
        setDurationByPath((prev) => ({ ...prev, ...map }));
      }
      setInfoTarget(row);
    },
    [durationByPath]
  );

  const refresh = useCallback(async (/** @type {{ background?: boolean }} */ options = {}) => {
    const background = options.background === true;
    if (!user?.id) {
      setFiles([]);
      return;
    }
    if (!background) setLoading(true);
    setListError(null);
    try {
      const rows = await listUserNoteAudioFiles(user.id);
      setFiles(rows);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Could not load audio library');
    } finally {
      if (!background) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (files.length === 0) {
      setDurationByPath({});
      return;
    }
    let cancelled = false;
    const paths = files.map((row) => row.path);
    void prefetchNoteAudioDurations(paths).then((map) => {
      if (!cancelled) setDurationByPath(map);
    });
    return () => {
      cancelled = true;
    };
  }, [files]);

  const closeDeleteModal = useCallback(() => {
    if (deletingPath) return;
    setDeleteTarget(null);
  }, [deletingPath]);

  const confirmDelete = useCallback(async () => {
    if (!user?.id || !deleteTarget) return;
    const row = deleteTarget;
    const label = row.displayName ?? row.fileName;

    setDeletingPath(row.path);
    setPageError(null);
    setSuccessMessage(null);
    try {
      await deleteUserNoteAudioFile(user.id, row.path);
      setDeleteTarget(null);
      setFiles((prev) => prev.filter((f) => f.path !== row.path));
      setDurationByPath((prev) => {
        if (!(row.path in prev)) return prev;
        const next = { ...prev };
        delete next[row.path];
        return next;
      });
      void refresh({ background: true });
      setSuccessMessage(`Deleted “${label}”`);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : 'Could not delete file');
    } finally {
      setDeletingPath(null);
    }
  }, [user?.id, deleteTarget, refresh]);

  const deleteModalLabel = deleteTarget
    ? deleteTarget.displayName ?? deleteTarget.fileName
    : '';

  const deleteTargetUsageCount = deleteTarget ? (usageByPath[deleteTarget.path]?.count ?? 0) : 0;

  const deleteModalMessage =
    'This removes the file from cloud storage permanently. Notes that already embed this clip will show “Audio unavailable” until you remove the embed from the note.' +
    (deleteTargetUsageCount > 0
      ? ` Used in ${deleteTargetUsageCount} note${deleteTargetUsageCount === 1 ? '' : 's'}.`
      : '');

  const infoModalLabel = infoTarget ? infoTarget.displayName ?? infoTarget.fileName : '';

  const infoModalNoteUsage =
    infoTarget && noteListReady ? formatVoiceMemoNoteUsage(usageByPath[infoTarget.path]?.count ?? 0) : null;

  if (!remote) {
    return (
      <PageContentWrap>
        <article className={styles.page}>
          <h1 className={styles.title}>Voice Memos</h1>
          <p className={styles.gate}>
            Voice Memos need cloud storage. Run the app in production mode with Supabase configured.
          </p>
        </article>
      </PageContentWrap>
    );
  }

  if (authInitializing) {
    return (
      <PageContentWrap>
        <article className={styles.page}>
          <h1 className={styles.title}>Voice Memos</h1>
          <p className={styles.gate}>Loading…</p>
        </article>
      </PageContentWrap>
    );
  }

  if (!user) {
    const loginTarget = navigateToLoginWithReturn(location);
    return <Navigate to={loginTarget.pathname} replace state={loginTarget.state} />;
  }

  return (
    <PageContentWrap>
      <Toast message={successMessage} onDismiss={dismissSuccess} variant="success" />
      <DeleteNoteModal
        open={deleteTarget != null}
        title={deleteModalLabel ? `Delete “${deleteModalLabel}”?` : 'Delete audio?'}
        message={deleteModalMessage}
        onCancel={closeDeleteModal}
        onConfirm={() => void confirmDelete()}
        deleting={deletingPath != null}
      />
      <VoiceMemoInfoModal
        open={infoTarget != null}
        onClose={() => setInfoTarget(null)}
        fileName={infoModalLabel}
        sizeBytes={infoTarget?.sizeBytes ?? null}
        uploadedAt={infoTarget?.updatedAt ?? ''}
        durationSec={infoTarget ? (durationByPath[infoTarget.path] ?? null) : null}
        noteUsageLabel={infoModalNoteUsage}
      />
      <article className={styles.page}>
        <h1 className={styles.title}>
          Voice Memos{' '}
          {!loading || files.length > 0 ? (
            <span className={styles.titleCount}>— {files.length} total</span>
          ) : null}
        </h1>
        <p className={styles.lead}>
          All audio in your private library (uploads from notes, <Link to="/recordings">Record</Link>, and
          Analysis). Deleting here removes the file from storage and clears its display name. It does not
          remove embeds from notes — those clips show as unavailable instead.
        </p>

        {successMessage ? (
          <p className={styles.successBanner} role="status" aria-live="polite">
            {successMessage}
          </p>
        ) : null}

        {pageError ? (
          <p className={styles.error} role="alert">
            {pageError}
          </p>
        ) : null}

        {loading && files.length === 0 ? (
          <p className={styles.muted}>Loading your audio…</p>
        ) : null}
        {listError ? <p className={styles.error}>{listError}</p> : null}

        {!loading && !listError && files.length === 0 ? (
          <p className={styles.muted}>
            No audio files yet. Use <Link to="/recordings">Record</Link> or insert audio from a note.
          </p>
        ) : null}

        {files.length > 0 ? (
          <ul className={styles.list} aria-label="Your audio files">
            {files.map((row) => {
              const busy = deletingPath === row.path;
              const label = row.displayName ?? row.fileName;
              const noteUsageLabel = noteListReady
                ? formatVoiceMemoNoteUsage(usageByPath[row.path]?.count ?? 0)
                : null;
              return (
                <li key={row.path}>
                  <div className={styles.row}>
                    <span className={styles.rowLeft}>
                      <span className={styles.titleCluster}>
                        <span className={styles.rowTitle}>{label}</span>
                        <button
                          type="button"
                          className={styles.infoBtn}
                          aria-label={`Info for ${label}`}
                          title="File details"
                          onClick={() => void openInfoModal(row)}
                        >
                          <NoteInfoCircleIcon />
                        </button>
                      </span>
                    </span>
                    <span className={styles.rowRight}>
                      {noteUsageLabel ? (
                        <span className={labelChipStyles.chip}>
                          <span className={labelChipStyles.chipText}>{noteUsageLabel}</span>
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        disabled={busy || deletingPath != null}
                        onClick={() => setDeleteTarget(row)}
                        aria-label={busy ? `Deleting ${label}` : `Delete ${label}`}
                        title={busy ? 'Deleting…' : `Delete ${label}`}
                      >
                        <Trash2 className={styles.deleteIcon} strokeWidth={2} aria-hidden />
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </article>
    </PageContentWrap>
  );
}
