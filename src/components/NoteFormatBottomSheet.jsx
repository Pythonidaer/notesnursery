import { useEffect, useReducer, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bold,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Outdent,
  Palette,
  Strikethrough,
  TextQuote,
  Underline,
} from 'lucide-react';
import styles from './NoteFormatBottomSheet.module.css';

const TEXT_COLOR_SWATCHES = [
  { label: 'Default', value: null },
  { label: 'Gray', value: '#6b7280' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Pink', value: '#db2777' },
];

function useToolbarRerender(editor) {
  const [, bump] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    if (!editor) return;
    const refresh = () => bump();
    editor.on('focus', refresh);
    editor.on('blur', refresh);
    editor.on('transaction', refresh);
    return () => {
      editor.off('focus', refresh);
      editor.off('blur', refresh);
      editor.off('transaction', refresh);
    };
  }, [editor]);
}

/**
 * @param {{
 *   editor: import('@tiptap/core').Editor | null,
 *   open: boolean,
 *   onClose: () => void,
 * }} props
 */
export default function NoteFormatBottomSheet({ editor, open, onClose }) {
  const [colorOpen, setColorOpen] = useState(false);

  useToolbarRerender(editor);

  useEffect(() => {
    if (!open) setColorOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !colorOpen) return;
    const onDown = (e) => {
      if (e.target instanceof Node && !e.target.closest('[data-nn-format-color]')) {
        setColorOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, colorOpen]);

  if (!open || !editor) return null;

  const focused = Boolean(editor.isFocused);
  const active = (/** @type {string} */ name, /** @type {Record<string, unknown>} */ attrs) =>
    focused && (attrs ? editor.isActive(name, attrs) : editor.isActive(name));

  const textStyleAttrs = editor.getAttributes('textStyle');
  const currentColor = typeof textStyleAttrs.color === 'string' ? textStyleAttrs.color : null;
  const colorControlActive = focused && currentColor != null && currentColor !== '';

  const bodySelected = !editor.isActive('heading', { level: 1 }) &&
    !editor.isActive('heading', { level: 2 }) &&
    !editor.isActive('heading', { level: 3 });

  const applyColor = (/** @type {string | null} */ value) => {
    if (value == null) {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(value).run();
    }
    setColorOpen(false);
  };

  const sink = () => {
    editor.chain().focus().sinkListItem('listItem').run();
  };

  const lift = () => {
    editor.chain().focus().liftListItem('listItem').run();
  };

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nn-format-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="nn-format-sheet-title" className={styles.title}>
            Format
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close format">
            ×
          </button>
        </div>
        <div className={styles.body}>
          <p className={styles.sectionLabel}>Paragraph styles</p>
          <div className={styles.paraStyles}>
            <button
              type="button"
              className={`${styles.paraStyleBtn} ${active('heading', { level: 1 }) ? styles.paraStyleBtnSelected : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              Title
            </button>
            <button
              type="button"
              className={`${styles.paraStyleBtn} ${active('heading', { level: 2 }) ? styles.paraStyleBtnSelected : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              Heading
            </button>
            <button
              type="button"
              className={`${styles.paraStyleBtn} ${active('heading', { level: 3 }) ? styles.paraStyleBtnSelected : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              Subheading
            </button>
            <button
              type="button"
              className={`${styles.paraStyleBtn} ${bodySelected ? styles.paraStyleBtnSelected : ''}`}
              onClick={() => editor.chain().focus().setParagraph().run()}
            >
              Body
            </button>
          </div>

          <p className={styles.sectionLabel}>Style</p>
          <div className={styles.iconRow}>
            <button
              type="button"
              className={`${styles.markBtn} ${active('bold') ? styles.markBtnActive : ''}`}
              onClick={() => editor.chain().focus().toggleBold().run()}
              aria-pressed={active('bold')}
              aria-label="Bold"
            >
              <Bold className={styles.markIcon} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.markBtn} ${active('italic') ? styles.markBtnActive : ''}`}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              aria-pressed={active('italic')}
              aria-label="Italic"
            >
              <Italic className={styles.markIcon} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.markBtn} ${active('underline') ? styles.markBtnActive : ''}`}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              aria-pressed={active('underline')}
              aria-label="Underline"
            >
              <Underline className={styles.markIcon} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.markBtn} ${active('strike') ? styles.markBtnActive : ''}`}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              aria-pressed={active('strike')}
              aria-label="Strikethrough"
            >
              <Strikethrough className={styles.markIcon} strokeWidth={2} aria-hidden />
            </button>
            <div className={styles.colorWrap} data-nn-format-color="">
              <button
                type="button"
                className={`${styles.markBtn} ${colorControlActive ? styles.markBtnActive : ''}`}
                onClick={() => setColorOpen((o) => !o)}
                aria-expanded={colorOpen}
                aria-label="Text color"
              >
                <Palette className={styles.markIcon} strokeWidth={2} aria-hidden />
              </button>
              {colorOpen ? (
                <div className={styles.colorPopover} role="listbox" aria-label="Text color">
                  {TEXT_COLOR_SWATCHES.map((sw) => (
                    <button
                      key={sw.label}
                      type="button"
                      role="option"
                      className={styles.colorSwatchBtn}
                      title={sw.label}
                      aria-label={sw.label}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyColor(sw.value)}
                    >
                      {sw.value == null ? (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>A</span>
                      ) : (
                        <span className={styles.colorSwatch} style={{ backgroundColor: sw.value }} />
                      )}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <p className={styles.sectionLabel}>Lists</p>
          <div className={styles.listRow}>
            <button
              type="button"
              className={`${styles.markBtn} ${active('bulletList') ? styles.markBtnActive : ''}`}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              aria-label="Bulleted list"
            >
              <List className={styles.markIcon} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.markBtn} ${active('orderedList') ? styles.markBtnActive : ''}`}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              aria-label="Numbered list"
            >
              <ListOrdered className={styles.markIcon} strokeWidth={2} aria-hidden />
            </button>
          </div>

          <p className={styles.sectionLabel}>Indent</p>
          <div className={styles.indentRow}>
            <button type="button" className={styles.markBtn} onClick={lift} aria-label="Outdent">
              <Outdent className={styles.markIcon} strokeWidth={2} aria-hidden />
            </button>
            <button type="button" className={styles.markBtn} onClick={sink} aria-label="Indent">
              <IndentIncrease className={styles.markIcon} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.markBtn} ${active('blockquote') ? styles.markBtnActive : ''}`}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              aria-label="Quote"
            >
              <TextQuote className={styles.markIcon} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
