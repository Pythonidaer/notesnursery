import { useEffect, useMemo, useRef, useState } from 'react';
import {
  normalizeRecordingMimeType,
  recordingDraftByteLength,
  recordingDraftToBlob,
} from '../../lib/audio/recordingDraftDb.js';
import { recordingDraftStatusMessage } from '../../lib/audio/recordingStatusMessages.js';
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
 *   draft: import('../../lib/audio/recordingDraftDb.js').RecordingDraft,
 *   online: boolean,
 *   busy: boolean,
 *   onDisplayNameChange: (draftId: string, name: string) => void,
 *   onUpload: (draftId: string) => void,
 *   onRetry: (draftId: string) => void,
 *   onDiscard: (draftId: string) => void,
 *   styles: Record<string, string>,
 *   rootClassName?: string,
 *   heading?: string,
 * }} props
 */
export function RecordingDraftCard({
  draft,
  online,
  busy,
  onDisplayNameChange,
  onUpload,
  onRetry,
  onDiscard,
  styles,
  rootClassName,
  heading,
}) {
  const audioRef = useRef(/** @type {HTMLAudioElement | null} */ (null));
  const [previewUrl, setPreviewUrl] = useState(/** @type {string | null} */ (null));
  const [previewFailed, setPreviewFailed] = useState(false);
  const [localDisplayName, setLocalDisplayName] = useState(() => draft.displayName ?? '');

  const byteLength = useMemo(() => recordingDraftByteLength(draft), [draft]);
  /** Stable while only displayName / status metadata changes — avoids revoking preview on rename. */
  const previewAudioKey = `${draft.draftId}:${byteLength}:${draft.mimeType}`;

  const previewMime = normalizeRecordingMimeType(draft.mimeType);

  useEffect(() => {
    setLocalDisplayName(draft.displayName ?? '');
  }, [draft.draftId]);

  useEffect(() => {
    const saved = draft.displayName ?? '';
    if (localDisplayName === saved) return;
    const timer = window.setTimeout(() => {
      onDisplayNameChange(draft.draftId, localDisplayName);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [localDisplayName, draft.draftId, draft.displayName, onDisplayNameChange]);

  useEffect(() => {
    setPreviewFailed(false);
    if (!byteLength) {
      setPreviewUrl(null);
      return;
    }
    let blob;
    try {
      blob = recordingDraftToBlob(draft);
    } catch {
      setPreviewUrl(null);
      return;
    }
    if (!blob || blob.size === 0) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
    // previewAudioKey only — displayName / status updates must not reload <audio>
  }, [previewAudioKey]);

  const statusMsg = recordingDraftStatusMessage(draft.status, {
    online,
    uploadError: draft.uploadError,
  });

  const showPreviewUi =
    draft.status === 'stopped-local' ||
    draft.status === 'upload-pending' ||
    draft.status === 'failed';

  const canUpload =
    (draft.status === 'stopped-local' || draft.status === 'upload-pending') && online;
  const showRetry = draft.status === 'failed' || (draft.status === 'upload-pending' && online);

  const cardClass = rootClassName ?? styles.draftCard;

  return (
    <div className={cardClass}>
      {heading ? <h2 className={styles.recordingControlsTitle}>{heading}</h2> : null}
      <div className={styles.draftHeader}>
        {!heading ? (
          <span className={styles.draftTitle}>
            {localDisplayName.trim() ||
              draft.displayName?.trim() ||
              `Recording ${new Date(draft.startedAt).toLocaleString()}`}
          </span>
        ) : null}
        <span className={styles.draftMeta}>
          {formatDuration(draft.duration)} · {draft.extension.toUpperCase()}
          {byteLength ? ` · ${formatBytes(byteLength)}` : ''}
        </span>
      </div>

      <p className={styles.draftStatus} aria-live="polite">
        {statusMsg}
      </p>

      {showPreviewUi && byteLength === 0 ? (
        <p className={styles.previewUnavailable}>
          No audio was saved for this draft. Discard and record again.
        </p>
      ) : null}

      {showPreviewUi && previewUrl && !previewFailed ? (
        <audio
          ref={audioRef}
          className={styles.draftPreview}
          controls
          preload="metadata"
          src={previewUrl}
          aria-label="Preview recording"
          onError={() => setPreviewFailed(true)}
        >
          <source src={previewUrl} type={previewMime} />
        </audio>
      ) : null}

      {showPreviewUi && previewFailed && byteLength > 0 ? (
        <p className={styles.previewUnavailable}>
          Preview could not load in this browser. You can still tap <strong>Upload / Save</strong> to
          convert to MP3, or discard and record again.
        </p>
      ) : null}

      <label className={styles.draftLabel}>
        Display name
        <input
          type="text"
          className={styles.draftInput}
          value={localDisplayName}
          placeholder="Optional name for your library"
          disabled={busy || draft.status === 'uploading'}
          onChange={(e) => setLocalDisplayName(e.target.value)}
          onBlur={() => {
            if ((draft.displayName ?? '') !== localDisplayName) {
              onDisplayNameChange(draft.draftId, localDisplayName);
            }
          }}
        />
      </label>

      <div className={styles.draftActions}>
        {canUpload ? (
          <button
            type="button"
            className={styles.draftBtnPrimary}
            disabled={busy || byteLength === 0}
            onClick={() => onUpload(draft.draftId)}
          >
            {busy ? 'Converting to MP3…' : 'Upload / Save'}
          </button>
        ) : null}
        {showRetry ? (
          <button
            type="button"
            className={styles.draftBtn}
            disabled={busy || !online || byteLength === 0}
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
    </div>
  );
}

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
  if (drafts.length === 0) return null;

  return (
    <ul className={styles.draftList}>
      {drafts.map((draft) => (
        <li key={draft.draftId}>
          <RecordingDraftCard
            draft={draft}
            online={online}
            busy={busyId === draft.draftId}
            onDisplayNameChange={onDisplayNameChange}
            onUpload={onUpload}
            onRetry={onRetry}
            onDiscard={onDiscard}
            styles={styles}
            rootClassName={styles.draftCard}
          />
        </li>
      ))}
    </ul>
  );
}
