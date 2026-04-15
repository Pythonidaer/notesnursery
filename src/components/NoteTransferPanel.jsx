import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronUp, Maximize2, Minimize2, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { requiresAuthForPersistence } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotes } from '../context/NotesContext.jsx';
import { formatNoteTimestamp } from '../utils/formatNoteTimestamp.js';
import { CONTENT_TYPE_MARKDOWN, normalizeContentType } from '../utils/noteContentModel.js';
import { getNoteHtmlForRichEditor, plainTextSnippetToAppendHtml } from '../utils/noteEditorHtml.js';
import { prepareNoteBodyHtml } from '../utils/parsePlainTextNoteToHtml.js';
import { sanitizeNoteHtml } from '../utils/sanitizeNoteHtml.js';
import NotePicker from './NotePicker.jsx';
import NoteRichTextEditor from './NoteRichTextEditor.jsx';
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
  const [destBodyHtml, setDestBodyHtml] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [destStartedAsMarkdown, setDestStartedAsMarkdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(/** @type {string | null} */ (null));
  const [presentation, setPresentation] = useState(
    /** @type {'docked' | 'expanded'} */ ('docked')
  );
  const [minimized, setMinimized] = useState(false);

  const destEditorRef = useRef(/** @type {import('@tiptap/core').Editor | null} */ (null));
  const expandButtonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const previousFocusRef = useRef(/** @type {HTMLElement | null} */ (null));
  const lastPresentationRef = useRef(/** @type {'docked' | 'expanded' | null} */ (null));

  const handleEditorReady = useCallback((ed) => {
    destEditorRef.current = ed;
  }, []);

  const isExpanded = presentation === 'expanded';

  useEffect(() => {
    if (!visible) {
      setDestId(null);
      setDestBodyHtml('');
      setEditorKey((k) => k + 1);
      setDestStartedAsMarkdown(false);
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
      onRequestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onRequestClose, saving, presentation]);

  const destNote = destId ? notes.find((n) => n.id === destId) : null;

  const handlePickDestination = (/** @type {string | null} */ id) => {
    setDestId(id);
    setSaveError(null);
    if (!id) {
      setDestBodyHtml('');
      setEditorKey((k) => k + 1);
      setDestStartedAsMarkdown(false);
      return;
    }
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    setDestBodyHtml(getNoteHtmlForRichEditor(n));
    setEditorKey((k) => k + 1);
    setDestStartedAsMarkdown(normalizeContentType(n.contentType) === CONTENT_TYPE_MARKDOWN);
  };

  const appendSnippet = () => {
    const s = snippetPlain.trim();
    if (!s) return;
    const fragment = plainTextSnippetToAppendHtml(s);
    if (!fragment) return;
    const ed = destEditorRef.current;
    if (!ed) return;
    const spacer = '<p><br /></p>';
    ed.chain().focus('end').insertContent(`${spacer}${fragment}`).run();
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
      const bodySaved = sanitizeNoteHtml(prepareNoteBodyHtml(destBodyHtml));
      await updateNote(destId, {
        bodyHtml: bodySaved,
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
    <aside
      className={`${composerStyles.panel} ${isExpanded ? composerStyles.panelExpanded : ''} ${styles.transferPanel}`}
      style={
        !isExpanded
          ? { maxHeight: minimized ? undefined : 'min(82vh, 44rem)' }
          : undefined
      }
      role="region"
      aria-labelledby="transfer-panel-heading"
    >
      <div className={composerStyles.header}>
        {isExpanded ? (
          <h2 id="transfer-panel-heading" className={composerStyles.headerTitleLarge}>
            Add to note
          </h2>
        ) : (
          <span id="transfer-panel-heading" className={composerStyles.headerTitle}>
            Add to note
          </span>
        )}
        <div className={composerStyles.headerActions}>
          {!minimized && !isExpanded ? (
            <button
              type="button"
              ref={expandButtonRef}
              className={composerStyles.headerIconBtn}
              onClick={() => setPresentation('expanded')}
              aria-label="Expand add-to-note workspace"
              title="Expand"
            >
              <Maximize2 width={16} height={16} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
          {isExpanded ? (
            <button
              type="button"
              className={composerStyles.headerIconBtn}
              onClick={() => setPresentation('docked')}
              disabled={saving}
              aria-label="Collapse add-to-note panel to docked size"
              title="Dock"
            >
              <Minimize2 width={16} height={16} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
          {!isExpanded ? (
            <button
              type="button"
              className={composerStyles.headerIconBtn}
              onClick={() => setMinimized((m) => !m)}
              aria-label={minimized ? 'Restore add-to-note panel' : 'Minimize add-to-note panel'}
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
            className={composerStyles.headerIconBtn}
            onClick={() => onRequestClose()}
            disabled={saving}
            aria-label="Close add-to-note panel"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {!minimized ? (
        <div
          className={`${composerStyles.body} ${isExpanded ? composerStyles.bodyExpanded : ''}`}
        >
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
              <p className={composerStyles.fieldLabel} id="transfer-dest-body-label">
                Destination body
              </p>
              <div
                className={`${composerStyles.richComposer} ${isExpanded ? composerStyles.richComposerExpanded : ''}`}
              >
                <NoteRichTextEditor
                  key={`${destId}-${editorKey}`}
                  initialHtml={destBodyHtml}
                  onChange={setDestBodyHtml}
                  onEditorReady={handleEditorReady}
                  placeholder="Note body…"
                  aria-labelledby="transfer-dest-body-label"
                  className={
                    isExpanded ? composerStyles.composerEditorRoot : composerStyles.dockedEditorRoot
                  }
                  surfaceClassName={
                    isExpanded
                      ? composerStyles.composerEditorSurface
                      : composerStyles.dockedEditorSurface
                  }
                />
              </div>
              {destStartedAsMarkdown ? (
                <p className={styles.mdHint}>
                  This note was stored as Markdown. Saving stores HTML as the source from here on.
                </p>
              ) : null}
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
      ) : null}
    </aside>
  );
}
