import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSupabaseBackend } from '../config/appConfig.js';
import { upsertNoteAudioDisplayName } from '../lib/noteAudioDisplayNames.js';
import { getSupabase } from '../lib/supabaseClient.js';
import { formatBytes } from '../utils/formatBytes.js';
import { updateNoteAudioFileNameByStoragePath } from '../utils/noteAudioEditorUpdate.js';
import baseStyles from './NoteInfoModal.module.css';
import styles from './AudioFileInfoModal.module.css';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   fileName: string,
 *   sizeBytes: number | null,
 *   uploadedAt: string,
 *   userId: string | null,
 *   storagePath: string,
 *   editor?: import('@tiptap/core').Editor | null,
 *   onDisplayNameSaved?: (storagePath: string, newName: string) => void,
 * }} props
 */
export default function AudioFileInfoModal({
  open,
  onClose,
  fileName,
  sizeBytes,
  uploadedAt,
  userId,
  storagePath,
  editor,
  onDisplayNameSaved,
}) {
  const remote = useSupabaseBackend();
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(/** @type {string | null} */ (null));

  const canRename = Boolean(remote && userId && storagePath?.trim() && getSupabase());

  useEffect(() => {
    if (!open) return;
    setDraftName(typeof fileName === 'string' ? fileName : '');
    setSaveError(null);
  }, [open, fileName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const uploadedLabel = uploadedAt?.trim()
    ? (() => {
        const t = Date.parse(uploadedAt);
        return Number.isFinite(t) ? new Date(t).toLocaleString() : uploadedAt;
      })()
    : '—';

  const onSaveName = async () => {
    if (!canRename || !userId || !storagePath?.trim()) return;
    const trimmed = draftName.trim();
    if (!trimmed) {
      setSaveError('Enter a name.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await upsertNoteAudioDisplayName(userId, storagePath, trimmed);
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error ?? 'Could not save');
      return;
    }
    const next = result.displayName ?? trimmed;
    if (editor) updateNoteAudioFileNameByStoragePath(editor, storagePath, next);
    onDisplayNameSaved?.(storagePath, next);
  };

  return createPortal(
    <div
      className={baseStyles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${baseStyles.dialog} ${baseStyles.dialogWide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-file-info-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={baseStyles.header}>
          <h2 id="audio-file-info-title" className={baseStyles.title}>
            Audio file info
          </h2>
          <button
            type="button"
            className={baseStyles.closeBtn}
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>
        <dl className={baseStyles.list}>
          <div className={baseStyles.row}>
            <dt>File name</dt>
            {canRename ? (
              <dd className={styles.nameDd}>
                <input
                  type="text"
                  className={styles.nameInput}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  aria-label="File name"
                  autoComplete="off"
                />
                <div className={styles.nameActions}>
                  <button
                    type="button"
                    className={styles.saveBtn}
                    disabled={saving}
                    onClick={() => void onSaveName()}
                  >
                    {saving ? 'Saving…' : 'Save name'}
                  </button>
                </div>
                {saveError ? <p className={styles.saveError}>{saveError}</p> : null}
              </dd>
            ) : (
              <dd>{fileName?.trim() || '—'}</dd>
            )}
          </div>
          <div className={`${baseStyles.row} ${baseStyles.rowInline}`}>
            <div className={baseStyles.rowInlineItem}>
              <dt>Size</dt>
              <dd>{formatBytes(sizeBytes)}</dd>
            </div>
            <div className={`${baseStyles.rowInlineItem} ${baseStyles.rowInlineEnd}`}>
              <dt>Uploaded</dt>
              <dd>{uploadedLabel}</dd>
            </div>
          </div>
        </dl>
      </div>
    </div>,
    document.body
  );
}
