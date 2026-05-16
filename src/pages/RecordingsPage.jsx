import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { navigateToLoginWithReturn } from '../lib/authReturnPath.js';
import DeleteNoteModal from '../components/DeleteNoteModal.jsx';
import RecordingControls from '../components/audio/RecordingControls.jsx';
import RecordingDraftList, {
  RecordingDraftCard,
} from '../components/audio/RecordingDraftList.jsx';
import { isReviewDraft, pickPrimaryReviewDraft } from '../lib/audio/recordingDraftReview.js';
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
  const [discardTargetId, setDiscardTargetId] = useState(/** @type {string | null} */ (null));
  const [discarding, setDiscarding] = useState(false);
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
    if (recorder.status === 'stopped-local') return 'Saved locally — review and upload';
    if (!isMediaRecorderSupported()) {
      return 'Recording is not supported in this browser.';
    }
    return online ? 'Ready to record' : 'Offline — you can still record; upload when online';
  }, [recorder.isRecording, recorder.isPaused, recorder.status, online]);

  const recorderActive = recorder.isRecording || recorder.isPaused;
  const primaryReviewDraft = useMemo(() => pickPrimaryReviewDraft(drafts), [drafts]);
  const otherReviewDrafts = useMemo(
    () =>
      primaryReviewDraft
        ? drafts.filter((d) => d.draftId !== primaryReviewDraft.draftId && isReviewDraft(d))
        : [],
    [drafts, primaryReviewDraft]
  );
  const showNewRecording = recorderActive || !primaryReviewDraft;
  const showPrimaryReview = primaryReviewDraft != null && !recorderActive;

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

  const closeDiscardModal = useCallback(() => {
    if (discarding) return;
    setDiscardTargetId(null);
  }, [discarding]);

  const confirmDiscard = useCallback(async () => {
    if (!discardTargetId) return;
    setDiscarding(true);
    try {
      await deleteRecordingDraft(discardTargetId);
      setDiscardTargetId(null);
      await refreshDrafts();
    } finally {
      setDiscarding(false);
    }
  }, [discardTargetId, refreshDrafts]);

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

  const discardDraft = discardTargetId
    ? drafts.find((d) => d.draftId === discardTargetId)
    : null;
  const discardModalLabel = discardDraft?.displayName?.trim()
    ? discardDraft.displayName.trim()
    : discardDraft
      ? `Recording ${new Date(discardDraft.startedAt).toLocaleString()}`
      : '';

  const rowBusy = (draftId) => busyId === draftId || discarding;

  return (
    <PageContentWrap>
      <Toast message={successMessage} onDismiss={dismissSuccess} variant="success" />
      <DeleteNoteModal
        open={discardTargetId != null}
        title={discardModalLabel ? `Discard “${discardModalLabel}”?` : 'Discard recording?'}
        message="This removes the recording from this device only. This cannot be undone."
        onCancel={closeDiscardModal}
        onConfirm={() => void confirmDiscard()}
        deleting={discarding}
        confirmLabel="Discard"
        confirmingLabel="Discarding…"
      />
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

        <section className={styles.section} aria-labelledby="recording-workspace-heading">
          {showNewRecording ? (
            <RecordingControls
              durationSec={recorder.durationSec}
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
          ) : null}
          {showPrimaryReview && primaryReviewDraft ? (
            <RecordingDraftCard
              draft={primaryReviewDraft}
              online={online}
              busy={rowBusy(primaryReviewDraft.draftId)}
              onDisplayNameChange={(id, name) => void handleDisplayNameChange(id, name)}
              onUpload={(id) => void runUpload(id)}
              onRetry={(id) => void runUpload(id)}
              onDiscard={setDiscardTargetId}
              styles={styles}
              rootClassName={styles.recordingControls}
              heading="Your recording"
            />
          ) : null}
        </section>

        {otherReviewDrafts.length > 0 ? (
          <section className={styles.section} aria-labelledby="other-drafts-heading">
            <h2 id="other-drafts-heading" className={styles.sectionTitle}>
              Other local drafts
            </h2>
            <RecordingDraftList
              drafts={otherReviewDrafts}
              online={online}
              busyId={discarding ? discardTargetId : busyId}
              onDisplayNameChange={(id, name) => void handleDisplayNameChange(id, name)}
              onUpload={(id) => void runUpload(id)}
              onRetry={(id) => void runUpload(id)}
              onDiscard={setDiscardTargetId}
              styles={styles}
            />
          </section>
        ) : null}
      </article>
    </PageContentWrap>
  );
}
