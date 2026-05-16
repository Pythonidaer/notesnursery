import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatAudioDuration } from '../utils/formatAudioDuration.js';
import { formatBytes } from '../utils/formatBytes.js';
import styles from './NoteInfoModal.module.css';

/**
 * @param {string | undefined | null} iso
 */
function formatUploadedAt(iso) {
  if (!iso?.trim()) return '—';
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString() : iso;
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   fileName: string,
 *   sizeBytes: number | null,
 *   uploadedAt: string,
 *   durationSec?: number | null,
 *   noteUsageLabel?: string | null,
 * }} props
 */
export default function VoiceMemoInfoModal({
  open,
  onClose,
  fileName,
  sizeBytes,
  uploadedAt,
  durationSec = null,
  noteUsageLabel = null,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      data-nn-dismiss-shield
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-memo-info-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="voice-memo-info-title" className={styles.title}>
            {fileName?.trim() || 'Audio info'}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>
        <dl className={styles.list}>
          <div className={styles.row}>
            <dt>Size</dt>
            <dd>{formatBytes(sizeBytes)}</dd>
          </div>
          <div className={styles.row}>
            <dt>Uploaded</dt>
            <dd>{formatUploadedAt(uploadedAt)}</dd>
          </div>
          <div className={styles.row}>
            <dt>Length</dt>
            <dd>{formatAudioDuration(durationSec)}</dd>
          </div>
          {noteUsageLabel ? (
            <div className={styles.row}>
              <dt>In notes</dt>
              <dd>{noteUsageLabel}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>,
    document.body
  );
}
