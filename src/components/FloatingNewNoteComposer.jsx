import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requiresAuthForPersistence } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotes } from '../context/NotesContext.jsx';
import { formatNoteTimestamp } from '../utils/formatNoteTimestamp.js';
import { collectAllLabels } from '../utils/noteLabels.js';
import { CONTENT_TYPE_HTML } from '../utils/noteContentModel.js';
import { prepareNoteBodyHtml } from '../utils/parsePlainTextNoteToHtml.js';
import { sanitizeNoteHtml } from '../utils/sanitizeNoteHtml.js';
import LabelPicker from './LabelPicker.jsx';
import NoteRichTextEditor from './NoteRichTextEditor.jsx';
import styles from './FloatingNewNoteComposer.module.css';

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
 * @param {{ visible: boolean, onRequestClose?: () => void }} props
 */
export default function FloatingNewNoteComposer({ visible, onRequestClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notes, addNotes } = useNotes();
  const suggestions = useMemo(() => collectAllLabels(notes), [notes]);

  const [title, setTitle] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [labels, setLabels] = useState(/** @type {string[]} */ ([]));
  const [minimized, setMinimized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(/** @type {string | null} */ (null));

  const noopEditorReady = useCallback(() => {}, []);

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setBodyHtml('');
      setEditorKey((k) => k + 1);
      setLabels([]);
      setMinimized(false);
      setSaving(false);
      setSaveError(null);
    }
  }, [visible]);

  if (!visible) return null;

  const handleCreate = async () => {
    if (requiresAuthForPersistence() && !user) {
      navigate('/login');
      return;
    }
    setSaveError(null);
    setSaving(true);
    const now = new Date();
    const ts = formatNoteTimestamp(now);
    try {
      await addNotes([
        {
          id: crypto.randomUUID(),
          sourceFileName: 'Notes Nursery',
          title: title.trim() || 'Untitled',
          bodyHtml: sanitizeNoteHtml(prepareNoteBodyHtml(bodyHtml)),
          bodyMarkdown: null,
          contentType: CONTENT_TYPE_HTML,
          createdAtSource: ts,
          modifiedAtSource: ts,
          labels: [...labels],
        },
      ]);
      setTitle('');
      setBodyHtml('');
      setEditorKey((k) => k + 1);
      setLabels([]);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not create note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className={styles.panel} aria-label="New note composer">
      <div className={styles.header}>
        <span className={styles.headerTitle}>New Note</span>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerIconBtn}
            onClick={() => setMinimized((m) => !m)}
            aria-label={minimized ? 'Expand composer' : 'Minimize composer'}
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? '▢' : '—'}
          </button>
          <button
            type="button"
            className={styles.headerIconBtn}
            onClick={() => onRequestClose?.()}
            aria-label="Close composer"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {!minimized ? (
        <div className={styles.body}>
          <label className={styles.fieldLabel} htmlFor="floating-note-title">
            Title
          </label>
          <input
            id="floating-note-title"
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />
          <label className={styles.fieldLabel} htmlFor="floating-note-body">
            Body
          </label>
          <div className={styles.richComposer}>
            <NoteRichTextEditor
              key={editorKey}
              initialHtml={bodyHtml}
              onChange={setBodyHtml}
              onEditorReady={noopEditorReady}
              placeholder="Write something…"
              aria-label="Note body"
            />
          </div>
          <p className={styles.fieldLabel}>Labels</p>
          <LabelPicker
            idPrefix="floating"
            availableLabels={suggestions}
            selectedLabels={labels}
            onChange={setLabels}
            placeholder="Add label…"
            align="stretch"
          />
          {saveError ? <p className={styles.error}>{saveError}</p> : null}
          <button
            type="button"
            className={styles.createBtn}
            onClick={() => void handleCreate()}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Create note'}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
