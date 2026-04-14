import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requiresAuthForPersistence } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotes } from '../context/NotesContext.jsx';
import { formatNoteTimestamp } from '../utils/formatNoteTimestamp.js';
import { CONTENT_TYPE_HTML, getNoteBodyPlain } from '../utils/noteContentModel.js';
import { plainTextToHtmlBody } from '../utils/noteBodyPlain.js';
import NotePicker from './NotePicker.jsx';
import composerStyles from './FloatingNewNoteComposer.module.css';
import styles from './NoteTransferPanel.module.css';

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * @param {{
 *   visible: boolean,
 *   onRequestClose: () => void,
 *   currentNoteId: string,
 *   snippetPlain: string,
 *   onSaved: () => void,
 * }} props
 */
export default function NoteTransferPanel({
  visible,
  onRequestClose,
  currentNoteId,
  snippetPlain,
  onSaved,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notes, updateNote } = useNotes();

  const [destId, setDestId] = useState(/** @type {string | null} */ (null));
  const [destPlain, setDestPlain] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    if (!visible) {
      setDestId(null);
      setDestPlain('');
      setSaving(false);
      setSaveError(null);
    }
  }, [visible]);

  const destNote = destId ? notes.find((n) => n.id === destId) : null;

  const handlePickDestination = (/** @type {string | null} */ id) => {
    setDestId(id);
    setSaveError(null);
    if (!id) {
      setDestPlain('');
      return;
    }
    const n = notes.find((x) => x.id === id);
    if (n) setDestPlain(getNoteBodyPlain(n));
  };

  const appendSnippet = () => {
    const s = snippetPlain.trim();
    if (!s) return;
    setDestPlain((prev) => {
      const p = prev.trimEnd();
      if (!p) return s;
      return `${p}\n\n${s}`;
    });
  };

  const handleSave = async () => {
    if (!destId) return;
    if (requiresAuthForPersistence() && !user) {
      navigate('/login');
      return;
    }
    setSaveError(null);
    setSaving(true);
    const ts = formatNoteTimestamp(new Date());
    const dest = notes.find((n) => n.id === destId);
    if (!dest) {
      setSaveError('Destination note not found');
      setSaving(false);
      return;
    }
    try {
      await updateNote(destId, {
        bodyHtml: plainTextToHtmlBody(destPlain),
        bodyMarkdown: null,
        contentType: CONTENT_TYPE_HTML,
        modifiedAtSource: ts,
      });
      onSaved();
      onRequestClose();
    } catch (e) {
      console.error('[notes] transfer save failed', e);
      setSaveError(e instanceof Error ? e.message : 'Could not save note');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <aside className={`${composerStyles.panel} ${styles.transferPanel}`} aria-label="Add to existing note">
      <div className={composerStyles.header}>
        <span className={composerStyles.headerTitle}>Add to note</span>
        <div className={composerStyles.headerActions}>
          <button
            type="button"
            className={composerStyles.headerIconBtn}
            onClick={() => onRequestClose()}
            aria-label="Close panel"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className={composerStyles.body}>
        <label className={composerStyles.fieldLabel} htmlFor="transfer-input">
          Destination note
        </label>
        <NotePicker
          idPrefix="transfer"
          notes={notes}
          excludeId={currentNoteId}
          selectedId={destId}
          onSelect={handlePickDestination}
          placeholder="Search by title…"
        />

        <p className={composerStyles.fieldLabel}>Selected text</p>
        <textarea
          className={styles.snippetPreview}
          readOnly
          rows={3}
          value={snippetPlain}
          aria-label="Selected text to add"
        />

        {destNote ? (
          <>
            <p className={styles.destTitle} title={destNote.title}>
              {destNote.title || 'Untitled'}
            </p>
            <label className={composerStyles.fieldLabel} htmlFor="transfer-dest-body">
              Destination body
            </label>
            <textarea
              id="transfer-dest-body"
              className={composerStyles.textarea}
              value={destPlain}
              onChange={(e) => setDestPlain(e.target.value)}
              rows={10}
              spellCheck
            />
            <div className={styles.actions}>
              <button type="button" className={styles.appendBtn} onClick={appendSnippet}>
                Append selected text
              </button>
              <button
                type="button"
                className={composerStyles.createBtn}
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        ) : (
          <p className={styles.hint}>Choose a note to load its body and append your selection.</p>
        )}

        {saveError ? <p className={composerStyles.error}>{saveError}</p> : null}
      </div>
    </aside>
  );
}
