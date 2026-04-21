import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, Maximize2, Minimize2, Minus } from 'lucide-react';
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
 * Persistent side composer (not modal): no backdrop, no scroll lock, no focus trap.
 * Expanded state is a wider right-anchored sheet; main page stays fully interactive.
 *
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(/** @type {string | null} */ (null));
  const [presentation, setPresentation] = useState(
    /** @type {'docked' | 'expanded'} */ ('docked')
  );
  const [minimized, setMinimized] = useState(false);

  const titleInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const expandButtonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const previousFocusRef = useRef(/** @type {HTMLElement | null} */ (null));
  const lastPresentationRef = useRef(/** @type {'docked' | 'expanded' | null} */ (null));

  const noopEditorReady = useCallback(() => {}, []);

  const isExpanded = presentation === 'expanded';

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setBodyHtml('');
      setEditorKey((k) => k + 1);
      setLabels([]);
      setSaving(false);
      setSaveError(null);
      setPresentation('docked');
      setMinimized(false);
    }
  }, [visible]);

  useLayoutEffect(() => {
    if (!visible) return;
    const el = document.activeElement;
    previousFocusRef.current = el instanceof HTMLElement ? el : null;
    requestAnimationFrame(() => {
      titleInputRef.current?.focus();
    });
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    return () => {
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === 'function') {
        prev.focus();
      }
    };
  }, [visible]);

  useLayoutEffect(() => {
    if (!visible) {
      lastPresentationRef.current = null;
      return;
    }
    const prev = lastPresentationRef.current;
    lastPresentationRef.current = presentation;
    if (presentation === 'docked' && prev === 'expanded') {
      requestAnimationFrame(() => {
        expandButtonRef.current?.focus();
      });
    }
  }, [presentation, visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e) => {
      if (e.key !== 'Escape' || saving) return;
      if (presentation === 'expanded') return;
      e.stopPropagation();
      onRequestClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onRequestClose, saving, presentation]);

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
      setPresentation('docked');
      setMinimized(false);
      onRequestClose?.();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not create note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside
      className={`${styles.panel} ${isExpanded ? styles.panelExpanded : ''}`}
      role="region"
      aria-labelledby="floating-new-note-heading"
    >
      <div className={styles.header}>
        {isExpanded ? (
          <h2 id="floating-new-note-heading" className={styles.headerTitleLarge}>
            New Note
          </h2>
        ) : (
          <span id="floating-new-note-heading" className={styles.headerTitle}>
            New Note
          </span>
        )}
        <div className={styles.headerActions}>
          {!minimized && !isExpanded ? (
            <button
              type="button"
              ref={expandButtonRef}
              className={styles.headerIconBtn}
              onClick={() => setPresentation('expanded')}
              aria-label="Expand composer workspace"
              title="Expand"
            >
              <Maximize2 width={16} height={16} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
          {isExpanded ? (
            <button
              type="button"
              className={styles.headerIconBtn}
              onClick={() => setPresentation('docked')}
              disabled={saving}
              aria-label="Collapse composer to docked panel"
              title="Dock"
            >
              <Minimize2 width={16} height={16} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
          {!isExpanded ? (
            <button
              type="button"
              className={styles.headerIconBtn}
              onClick={() => setMinimized((m) => !m)}
              aria-label={minimized ? 'Restore composer panel' : 'Minimize composer'}
              title={minimized ? 'Restore' : 'Minimize'}
            >
              {minimized ? (
                <ChevronUp width={16} height={16} strokeWidth={2} aria-hidden />
              ) : (
                <Minus width={16} height={16} strokeWidth={2} aria-hidden />
              )}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.headerIconBtn}
            onClick={() => onRequestClose?.()}
            disabled={saving}
            aria-label="Close composer"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {!minimized ? (
        <div className={`${styles.body} ${isExpanded ? styles.bodyExpanded : ''}`}>
          <label className={styles.fieldLabel} htmlFor="floating-note-title">
            Title
          </label>
          <input
            ref={titleInputRef}
            id="floating-note-title"
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            autoComplete="off"
          />
          <p className={styles.fieldLabel} id="floating-note-body-label">
            Body
          </p>
          <div className={`${styles.richComposer} ${isExpanded ? styles.richComposerExpanded : ''}`}>
            <NoteRichTextEditor
              key={editorKey}
              initialHtml={bodyHtml}
              onChange={setBodyHtml}
              onEditorReady={noopEditorReady}
              placeholder="Write something…"
              aria-labelledby="floating-note-body-label"
              className={isExpanded ? styles.composerEditorRoot : styles.dockedEditorRoot}
              surfaceClassName={isExpanded ? styles.composerEditorSurface : styles.dockedEditorSurface}
              audioStorageScopeId={`composer-${editorKey}`}
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
          <div className={isExpanded ? styles.actionsRow : undefined}>
            <button
              type="button"
              className={styles.createBtn}
              onClick={() => void handleCreate()}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Create note'}
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
