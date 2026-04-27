import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Mic, Trash2 } from 'lucide-react';
import { useSupabaseBackend } from '../config/appConfig.js';
import { upsertNoteAudioDisplayName } from '../lib/noteAudioDisplayNames.js';
import { getSupabase } from '../lib/supabaseClient.js';
import { formatBytes } from '../utils/formatBytes.js';
import { updateNoteAudioFileNameByStoragePath } from '../utils/noteAudioEditorUpdate.js';
import NoteInfoCircleIcon from './NoteInfoCircleIcon.jsx';
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
 *   allowEditorActions?: boolean,
 *   onRequestTranscribe?: () => void,
 *   onRequestRemoveFromNote?: () => void,
 *   canTranscribe?: boolean,
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
  allowEditorActions = false,
  onRequestTranscribe,
  onRequestRemoveFromNote,
  canTranscribe = false,
}) {
  const remote = useSupabaseBackend();
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(/** @type {string | null} */ (null));
  const [detailsOpen, setDetailsOpen] = useState(false);

  const canRename = Boolean(remote && userId && storagePath?.trim() && getSupabase());

  useEffect(() => {
    if (!open) return;
    setDraftName(typeof fileName === 'string' ? fileName : '');
    setSaveError(null);
    setDetailsOpen(false);
  }, [open, fileName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (detailsOpen) {
        setDetailsOpen(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, detailsOpen]);

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

  const transcribeDisabled = !allowEditorActions || !canTranscribe;
  const transcribeTitle = !allowEditorActions
    ? 'Switch to edit mode to transcribe'
    : !canTranscribe
      ? 'Sign in and wait for audio to load to transcribe'
      : 'Transcribe speech in this clip (runs in your browser)';

  const removeDisabled = !allowEditorActions;
  const removeTitle = !allowEditorActions
    ? 'Switch to edit mode to remove this clip from the note'
    : 'Remove this audio block from the note';

  const titleId = detailsOpen ? 'audio-details-title' : 'audio-settings-title';

  return createPortal(
    <div
      className={baseStyles.backdrop}
      data-nn-dismiss-shield
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${baseStyles.dialog} ${baseStyles.dialogWide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${baseStyles.header} ${styles.audioHeader}`}>
          {detailsOpen ? (
            <div className={styles.headerLeading}>
              <button
                type="button"
                className={styles.headerIconBtn}
                onClick={() => setDetailsOpen(false)}
                aria-label="Back to audio settings"
                title="Back"
              >
                <ChevronLeft className={styles.headerGlyph} strokeWidth={2} aria-hidden />
              </button>
              <h2 id="audio-details-title" className={baseStyles.title}>
                Audio details
              </h2>
            </div>
          ) : (
            <div className={styles.headerLeading}>
              <h2 id="audio-settings-title" className={baseStyles.title}>
                Audio settings
              </h2>
              <button
                type="button"
                className={styles.headerIconBtn}
                onClick={() => setDetailsOpen(true)}
                aria-label="Size and upload date"
                title="Size and upload date"
              >
                <span className={styles.headerInfoGlyph} aria-hidden>
                  <NoteInfoCircleIcon />
                </span>
              </button>
            </div>
          )}
          <button
            type="button"
            className={`${baseStyles.closeBtn} ${styles.headerCircleBtn}`}
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>
        {detailsOpen ? (
          <dl className={baseStyles.list}>
            <div className={baseStyles.row}>
              <dt>Size</dt>
              <dd>{formatBytes(sizeBytes)}</dd>
            </div>
            <div className={baseStyles.row}>
              <dt>Uploaded</dt>
              <dd>{uploadedLabel}</dd>
            </div>
          </dl>
        ) : (
          <div className={styles.body}>
            <div className={styles.fieldBlock}>
              <span className={styles.fieldLabel}>File name</span>
              {canRename ? (
                <>
                  <div className={styles.nameRow}>
                    <input
                      type="text"
                      className={styles.nameInput}
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      aria-label="File name"
                      autoComplete="off"
                    />
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
                </>
              ) : (
                <p className={styles.readOnlyName}>{fileName?.trim() || '—'}</p>
              )}
            </div>

            <div className={styles.divider} role="presentation" />

            <div className={styles.menuList}>
              <button
                type="button"
                className={styles.menuRow}
                disabled={transcribeDisabled}
                title={transcribeTitle}
                onClick={() => {
                  if (transcribeDisabled) return;
                  onRequestTranscribe?.();
                }}
              >
                <Mic className={styles.menuIcon} strokeWidth={2} aria-hidden />
                <span className={styles.menuLabel}>Transcribe</span>
              </button>
              <button
                type="button"
                className={`${styles.menuRow} ${styles.menuRowDanger}`}
                disabled={removeDisabled}
                title={removeTitle}
                onClick={() => {
                  if (removeDisabled) return;
                  onRequestRemoveFromNote?.();
                }}
              >
                <Trash2 className={styles.menuIcon} strokeWidth={2} aria-hidden />
                <span className={styles.menuLabel}>Remove from note</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
