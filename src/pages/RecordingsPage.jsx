import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { navigateToLoginWithReturn } from '../lib/authReturnPath.js';
import RecordingControls from '../components/audio/RecordingControls.jsx';
import RecordingDraftList from '../components/audio/RecordingDraftList.jsx';
import Toast from '../components/Toast.jsx';
import PageContentWrap from '../components/PageContentWrap.jsx';
import { useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import {
  deleteRecordingDraft,
  getRecordingDraft,
  listRecordingDraftsForUser,
  putRecordingDraft,
} from '../lib/audio/recordingDraftDb.js';
import { isMediaRecorderSupported } from '../lib/audio/recordingMimeTypes.js';
import { uploadRecordingDraft } from '../lib/audio/uploadRecording.js';
import styles from './RecordingsPage.module.css';

function mapStylesForControls() {
  return {
    recordingControls: styles.recordingControls,
    recordingControlsTitle: styles.recordingControlsTitle,
    recordingMeta: styles.recordingMeta,
    recordingStats: styles.recordingStats,
    recordingDuration: styles.recordingDuration,
    recordingFormat: styles.recordingFormat,
    recordingError: styles.recordingError,
    recordingBtnRow: styles.recordingBtnRow,
    recordingBtn: styles.recordingBtn,
    recordingBtnPrimary: styles.recordingBtnPrimary,
    recordingBtnDanger: styles.recordingBtnDanger,
  };
}

export default function RecordingsPage() {
  const location = useLocation();
  const remote = useSupabaseBackend();
  const { user, authInitializing } = useAuth();
  const online = useOnlineStatus();
  const recorder = useAudioRecorder(user?.id);

  const [drafts, setDrafts] = useState(
    /** @type {import('../lib/audio/recordingDraftDb.js').RecordingDraft[]} */ ([])
  );
  const [busyId, setBusyId] = useState(/** @type {string | null} */ (null));
  const [pageError, setPageError] = useState(/** @type {string | null} */ (null));
  const [successMessage, setSuccessMessage] = useState(/** @type {string | null} */ (null));
  const dismissSuccess = useCallback(() => setSuccessMessage(null), []);

  const refreshDrafts = useCallback(async () => {
    if (!user?.id) {
      setDrafts([]);
      return;
    }
    const rows = await listRecordingDraftsForUser(user.id);
    setDrafts(rows);
  }, [user?.id]);

  useEffect(() => {
    void refreshDrafts();
  }, [refreshDrafts]);

  useEffect(() => {
    if (!online || !user?.id) return;
    const pending = drafts.filter(
      (d) => d.status === 'upload-pending' || d.status === 'failed'
    );
    if (pending.length === 0) return;
    void refreshDrafts();
  }, [online, user?.id, drafts.length, refreshDrafts]);

  const liveMessage = useMemo(() => {
    if (recorder.isRecording) return 'Recording locally';
    if (recorder.isPaused) return 'Paused — saved locally';
    if (recorder.status === 'stopped-local') return 'Saved locally — review and upload below';
    if (!isMediaRecorderSupported()) {
      return 'Recording is not supported in this browser.';
    }
    return online ? 'Ready to record' : 'Offline — you can still record; upload when online';
  }, [recorder.isRecording, recorder.isPaused, recorder.status, online]);

  const handleStop = useCallback(async () => {
    const id = await recorder.stopRecording();
    if (id) {
      const row = await getRecordingDraft(id);
      if (row) {
        await putRecordingDraft({
          ...row,
          status: online ? 'stopped-local' : 'upload-pending',
          updatedAt: new Date().toISOString(),
        });
      }
    }
    recorder.resetRecorderUi();
    await refreshDrafts();
  }, [recorder, refreshDrafts, online]);

  const handleDisplayNameChange = useCallback(
    async (draftId, name) => {
      const row = await getRecordingDraft(draftId);
      if (!row) return;
      await putRecordingDraft({ ...row, displayName: name, updatedAt: new Date().toISOString() });
      await refreshDrafts();
    },
    [refreshDrafts]
  );

  const runUpload = useCallback(
    async (draftId) => {
      if (!user?.id) return;
      const row = await getRecordingDraft(draftId);
      if (!row) return;
      if (!online) {
        await putRecordingDraft({ ...row, status: 'upload-pending' });
        await refreshDrafts();
        return;
      }
      setBusyId(draftId);
      setPageError(null);
      setSuccessMessage(null);
      await putRecordingDraft({
        ...row,
        status: 'uploading',
        uploadError: undefined,
        updatedAt: new Date().toISOString(),
      });
      await refreshDrafts();
      try {
        const uploaded = await uploadRecordingDraft(user.id, row);
        const label =
          (row.displayName && row.displayName.trim()) ||
          uploaded.fileName.replace(/\.mp3$/i, '') ||
          'Recording';
        await deleteRecordingDraft(draftId);
        await refreshDrafts();
        setSuccessMessage(`Uploaded “${label}” as MP3`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        const latest = await getRecordingDraft(draftId);
        if (latest) {
          await putRecordingDraft({
            ...latest,
            status: 'failed',
            uploadError: msg,
            updatedAt: new Date().toISOString(),
          });
        }
        setPageError(msg);
        await refreshDrafts();
      } finally {
        setBusyId(null);
      }
    },
    [user?.id, online, refreshDrafts]
  );

  const handleDiscard = useCallback(
    async (draftId) => {
      if (!window.confirm('Discard this local recording? This cannot be undone.')) return;
      await deleteRecordingDraft(draftId);
      await refreshDrafts();
    },
    [refreshDrafts]
  );

  if (!remote) {
    return (
      <PageContentWrap>
        <article className={styles.page}>
          <h1 className={styles.title}>Record</h1>
          <p className={styles.gate}>
            Recording needs cloud storage. Sign in with a synced account to save uploads.
          </p>
        </article>
      </PageContentWrap>
    );
  }

  if (authInitializing) {
    return (
      <PageContentWrap>
        <article className={styles.page}>
          <h1 className={styles.title}>Record</h1>
          <p className={styles.gate}>Loading…</p>
        </article>
      </PageContentWrap>
    );
  }

  if (!user) {
    const loginTarget = navigateToLoginWithReturn(location);
    return <Navigate to={loginTarget.pathname} replace state={loginTarget.state} />;
  }

  const controlStyles = mapStylesForControls();

  return (
    <PageContentWrap>
      <Toast message={successMessage} onDismiss={dismissSuccess} variant="success" />
      <article className={styles.page}>
        <h1 className={styles.title}>Record</h1>
        <p className={styles.lead}>
          Record audio and preview locally on your device before uploading to your profile.
        </p>

        {!online ? (
          <p className={styles.offlineBanner} role="status">
            Offline — recordings stay on this device until you are back online.
          </p>
        ) : null}

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

        <section className={styles.section} aria-labelledby="new-recording-heading">
          <RecordingControls
            durationSec={recorder.durationSec}
            formatLabel={recorder.formatLabel}
            liveMessage={liveMessage}
            isRecording={recorder.isRecording}
            isPaused={recorder.isPaused}
            pauseSupported={recorder.pauseSupported}
            busy={busyId != null}
            onStart={() => void recorder.startRecording()}
            onPause={() => void recorder.pauseRecording()}
            onResume={() => recorder.resumeRecording()}
            onStop={() => void handleStop()}
            error={recorder.error}
            styles={controlStyles}
          />
        </section>

        <section className={styles.section} aria-labelledby="local-drafts-heading">
          <h2 id="local-drafts-heading" className={styles.sectionTitle}>
            Local drafts
          </h2>
          <RecordingDraftList
            drafts={drafts}
            online={online}
            busyId={busyId}
            onDisplayNameChange={(id, name) => void handleDisplayNameChange(id, name)}
            onUpload={(id) => void runUpload(id)}
            onRetry={(id) => void runUpload(id)}
            onDiscard={(id) => void handleDiscard(id)}
            styles={styles}
          />
        </section>
      </article>
    </PageContentWrap>
  );
}
