import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatBytes } from '../utils/formatBytes.js';
import styles from './NoteInfoModal.module.css';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   fileName: string,
 *   mimeType: string,
 *   sizeBytes: number | null,
 *   uploadedAt: string,
 *   storagePath: string,
 * }} props
 */
export default function AudioFileInfoModal({
  open,
  onClose,
  fileName,
  mimeType,
  sizeBytes,
  uploadedAt,
  storagePath,
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
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.dialog} ${styles.dialogWide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-file-info-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="audio-file-info-title" className={styles.title}>
            Audio file info
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
            <dt>File name</dt>
            <dd>{fileName?.trim() || '—'}</dd>
          </div>
          <div className={styles.row}>
            <dt>Type</dt>
            <dd>{mimeType?.trim() || '—'}</dd>
          </div>
          <div className={styles.row}>
            <dt>Size</dt>
            <dd>{formatBytes(sizeBytes)}</dd>
          </div>
          <div className={styles.row}>
            <dt>Uploaded</dt>
            <dd>
              {uploadedAt?.trim()
                ? (() => {
                    const t = Date.parse(uploadedAt);
                    return Number.isFinite(t) ? new Date(t).toLocaleString() : uploadedAt;
                  })()
                : '—'}
            </dd>
          </div>
          <div className={styles.row}>
            <dt>Storage path</dt>
            <dd>{storagePath?.trim() || '—'}</dd>
          </div>
        </dl>
      </div>
    </div>,
    document.body
  );
}
