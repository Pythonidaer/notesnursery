import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatBytes } from '../utils/formatBytes.js';
import styles from './NoteInfoModal.module.css';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   fileName: string,
 *   fileSizeBytes: number,
 *   maxUploadBytes: number,
 *   reason: string,
 *   isLikelySizeLimit: boolean,
 * }} props
 */
export default function AudioUploadErrorModal({
  open,
  onClose,
  fileName,
  fileSizeBytes,
  maxUploadBytes,
  reason,
  isLikelySizeLimit,
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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="audio-upload-err-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="audio-upload-err-title" className={styles.title}>
            Audio upload failed
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
            <dt>File</dt>
            <dd>{fileName || '—'}</dd>
          </div>
          <div className={`${styles.row} ${styles.rowInline}`}>
            <div className={styles.rowInlineItem}>
              <dt>File size</dt>
              <dd>{formatBytes(fileSizeBytes)}</dd>
            </div>
            <div className={`${styles.rowInlineItem} ${styles.rowInlineEnd}`}>
              <dt>Upload limit</dt>
              <dd>{formatBytes(maxUploadBytes)}</dd>
            </div>
          </div>
          <div className={styles.row}>
            <dt>What went wrong</dt>
            <dd>{reason}</dd>
          </div>
          {isLikelySizeLimit ? (
            <div className={styles.row}>
              <dt>What you can try</dt>
              <dd>
                <ul className={styles.helpList}>
                  <li>
                    Large <code className={styles.codeInline}>.wav</code> files are often much smaller as{' '}
                    <code className={styles.codeInline}>.mp3</code>. Try converting first (for example:{' '}
                    <a
                      href="https://cloudconvert.com/wav-to-mp3"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.helpLink}
                    >
                      CloudConvert WAV to MP3
                    </a>
                    ), then upload again.
                  </li>
                  <li>Re-export from your editor or recorder at a lower bitrate or as a smaller file.</li>
                  <li>If the recording is very long, split it into shorter clips and upload each part.</li>
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>,
    document.body
  );
}
