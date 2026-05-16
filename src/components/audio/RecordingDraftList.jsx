import { useEffect, useMemo, useRef, useState } from 'react';
import { canPreviewAudioMime } from '../../lib/audio/recordingMimeTypes.js';
import { recordingDraftStatusMessage } from '../../lib/audio/recordingStatusMessages.js';
import { recordingDraftToBlob } from '../../lib/audio/recordingDraftDb.js';
import { formatBytes } from '../../utils/formatBytes.js';

/** @param {number} sec */
function formatDuration(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/**
 * @param {{
 *   drafts: import('../../lib/audio/recordingDraftDb.js').RecordingDraft[],
 *   online: boolean,
 *   busyId: string | null,
 *   onDisplayNameChange: (draftId: string, name: string) => void,
 *   onUpload: (draftId: string) => void,
 *   onRetry: (draftId: string) => void,
 *   onDiscard: (draftId: string) => void,
 *   styles: Record<string, string>,
 * }} props
 */
export default function RecordingDraftList({
  drafts,
  online,
  busyId,
  onDisplayNameChange,
  onUpload,
  onRetry,
  onDiscard,
  styles,
}) {
  if (drafts.length === 0) {
    return (
      <p className={styles.muted}>No local drafts. Stopped recordings appear here until uploaded.</p>
    );
  }

  return (
    <ul className={styles.draftList}>
      {drafts.map((draft) => (
        <RecordingDraftCard
          key={draft.draftId}
          draft={draft}
          online={online}
          busy={busyId === draft.draftId}
          onDisplayNameChange={onDisplayNameChange}
          onUpload={onUpload}
          onRetry={onRetry}
          onDiscard={onDiscard}
          styles={styles}
        />
      ))}
    </ul>
  );
}

/**
 * @param {{
 *   draft: import('../../lib/audio/recordingDraftDb.js').RecordingDraft,
 *   online: boolean,
 *   busy: boolean,
 *   onDisplayNameChange: (draftId: string, name: string) => void,
 *   onUpload: (draftId: string) => void,
 *   onRetry: (draftId: string) => void,
 *   onDiscard: (draftId: string) => void,
 *   styles: Record<string, string>,
 * }} props
 */
function RecordingDraftCard({
  draft,
  online,
  busy,
  onDisplayNameChange,
  onUpload,
  onRetry,
  onDiscard,
  styles,
}) {
  const audioRef = useRef(/** @type {HTMLAudioElement | null} */ (null));
  const [previewUrl, setPreviewUrl] = useState(/** @type {string | null} */ (null));
  const blob = useMemo(() => {
    if (!draft.chunks?.length) return null;
    try {
      return recordingDraftToBlob(draft);
    } catch {
      return null;
    }
  }, [draft]);

  useEffect(() => {
    if (!blob || blob.size === 0) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const statusMsg = recordingDraftStatusMessage(draft.status, {
    online,
    uploadError: draft.uploadError,
  });
  const previewSupported = canPreviewAudioMime(draft.mimeType);
  const canPreview =
    previewSupported &&
    (draft.status === 'stopped-local' ||
      draft.status === 'upload-pending' ||
      draft.status === 'failed');
  const showPreviewUnavailable =
    !previewSupported &&
    (draft.status === 'stopped-local' ||
      draft.status === 'upload-pending' ||
      draft.status === 'failed') &&
    Boolean(blob?.size);
  const canUpload =
    (draft.status === 'stopped-local' || draft.status === 'upload-pending') && online;
  const showRetry = draft.status === 'failed' || (draft.status === 'upload-pending' && online);

  return (
    <li className={styles.draftCard}>
      <div className={styles.draftHeader}>
        <span className={styles.draftTitle}>
          {draft.displayName?.trim() || `Recording ${new Date(draft.startedAt).toLocaleString()}`}
        </span>
        <span className={styles.draftMeta}>
          {formatDuration(draft.duration)} · {draft.extension.toUpperCase()}
          {blob ? ` · ${formatBytes(blob.size)}` : ''}
        </span>
      </div>

      <p className={styles.draftStatus} aria-live="polite">
        {statusMsg}
      </p>

      {canPreview && previewUrl ? (
        <audio
          ref={audioRef}
          className={styles.draftPreview}
          controls
          preload="metadata"
          src={previewUrl}
          aria-label="Preview recording"
        />
      ) : null}
      {showPreviewUnavailable ? (
        <p className={styles.previewUnavailable}>
          Preview is not supported for {draft.extension.toUpperCase()} in this browser. You can still
          upload if your Supabase bucket allows this format (see docs/recording-sessions.md).
        </p>
      ) : null}

      <label className={styles.draftLabel}>
        Display name
        <input
          type="text"
          className={styles.draftInput}
          value={draft.displayName ?? ''}
          placeholder="Optional name for your library"
          disabled={busy || draft.status === 'uploading'}
          onChange={(e) => onDisplayNameChange(draft.draftId, e.target.value)}
        />
      </label>

      <div className={styles.draftActions}>
        {canUpload ? (
          <button
            type="button"
            className={styles.draftBtnPrimary}
            disabled={busy}
            onClick={() => onUpload(draft.draftId)}
          >
            {busy ? 'Converting to MP3…' : 'Upload / Save'}
          </button>
        ) : null}
        {showRetry ? (
          <button
            type="button"
            className={styles.draftBtn}
            disabled={busy || !online}
            onClick={() => onRetry(draft.draftId)}
          >
            {busy ? 'Converting…' : 'Retry upload'}
          </button>
        ) : null}
        {!online && draft.status !== 'uploading' && draft.status !== 'uploaded' ? (
          <span className={styles.offlineHint}>Offline — upload when connected</span>
        ) : null}
        <button
          type="button"
          className={styles.draftBtnDanger}
          disabled={busy || draft.status === 'recording'}
          onClick={() => onDiscard(draft.draftId)}
        >
          Discard
        </button>
      </div>
    </li>
  );
}
