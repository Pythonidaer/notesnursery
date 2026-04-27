import { useEffect, useReducer, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Italic, List, ListOrdered, Palette, Strikethrough, Underline } from 'lucide-react';
import TextColorModal from './TextColorModal.jsx';
import { isDefaultStoredTextColor } from '../utils/tiptapTextColorInk.js';
import styles from './NoteFormatBottomSheet.module.css';

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
  const [colorModalOpen, setColorModalOpen] = useState(false);

  useToolbarRerender(editor);

  useEffect(() => {
    if (!open) setColorModalOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !editor) return null;

  const focused = Boolean(editor.isFocused);
  const active = (/** @type {string} */ name, /** @type {Record<string, unknown>} */ attrs) =>
    focused && (attrs ? editor.isActive(name, attrs) : editor.isActive(name));

  const textStyleAttrs = editor.getAttributes('textStyle');
  const currentColor = typeof textStyleAttrs.color === 'string' ? textStyleAttrs.color : null;
  const colorChipActive =
    colorModalOpen ||
    (currentColor != null && currentColor !== '' && !isDefaultStoredTextColor(currentColor));

  const bodySelected = !editor.isActive('heading', { level: 1 }) &&
    !editor.isActive('heading', { level: 2 }) &&
    !editor.isActive('heading', { level: 3 });

  const applyColor = (/** @type {string | null} */ value) => {
    if (value == null) {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(value).run();
    }
  };

  return createPortal(
    <>
      <div
        className={styles.backdrop}
        data-nn-dismiss-shield
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className={styles.card}
          role="dialog"
          aria-modal="true"
          aria-labelledby="nn-format-sheet-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.header}>
            <h2 id="nn-format-sheet-title" className={styles.headerTitle}>
              Format
            </h2>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close format">
              ×
            </button>
          </div>
          <div className={styles.body}>
            <div className={styles.paraRow}>
              <button
                type="button"
                className={`${styles.paraPill} ${styles.paraTitle} ${active('heading', { level: 1 }) ? styles.paraPillOn : ''}`}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              >
                Title
              </button>
              <button
                type="button"
                className={`${styles.paraPill} ${styles.paraHeading} ${active('heading', { level: 2 }) ? styles.paraPillOn : ''}`}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                Heading
              </button>
              <button
                type="button"
                className={`${styles.paraPill} ${styles.paraSub} ${active('heading', { level: 3 }) ? styles.paraPillOn : ''}`}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              >
                Subheading
              </button>
              <button
                type="button"
                className={`${styles.paraPill} ${styles.paraBody} ${bodySelected ? styles.paraPillOn : ''}`}
                onClick={() => editor.chain().focus().setParagraph().run()}
              >
                Body
              </button>
            </div>

            <div className={styles.toolRow}>
              <div className={styles.pill}>
                <button
                  type="button"
                  className={`${styles.pillBtn} ${active('bold') ? styles.pillBtnOn : ''}`}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  aria-pressed={active('bold')}
                  aria-label="Bold"
                >
                  <Bold className={styles.pillIcon} strokeWidth={2.25} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${styles.pillBtn} ${active('italic') ? styles.pillBtnOn : ''}`}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  aria-pressed={active('italic')}
                  aria-label="Italic"
                >
                  <Italic className={styles.pillIcon} strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${styles.pillBtn} ${active('underline') ? styles.pillBtnOn : ''}`}
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  aria-pressed={active('underline')}
                  aria-label="Underline"
                >
                  <Underline className={styles.pillIcon} strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${styles.pillBtn} ${active('strike') ? styles.pillBtnOn : ''}`}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  aria-pressed={active('strike')}
                  aria-label="Strikethrough"
                >
                  <Strikethrough className={styles.pillIcon} strokeWidth={2} aria-hidden />
                </button>
              </div>
              <div className={styles.pill}>
                <button
                  type="button"
                  className={`${styles.pillBtn} ${active('bulletList') ? styles.pillBtnOn : ''}`}
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  aria-label="Bulleted list"
                >
                  <List className={styles.pillIcon} strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${styles.pillBtn} ${active('orderedList') ? styles.pillBtnOn : ''}`}
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  aria-label="Numbered list"
                >
                  <ListOrdered className={styles.pillIcon} strokeWidth={2} aria-hidden />
                </button>
              </div>
              <button
                type="button"
                className={`${styles.colorChip} ${colorChipActive ? styles.colorChipOn : ''}`}
                onClick={() => setColorModalOpen(true)}
                aria-label="Text color"
              >
                <Palette className={styles.pillIcon} strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
      <TextColorModal
        open={colorModalOpen}
        onClose={() => setColorModalOpen(false)}
        initialColor={currentColor}
        onApply={(hexOrNull) => applyColor(hexOrNull)}
      />
    </>,
    document.body
  );
}
