import { ocrPlainTextToTipTapHtml } from './ocrTextToTiptapHtml.js';

/**
 * Appends OCR plain text to the end of a TipTap document without replacing existing content.
 * If the body already has text, inserts a blank paragraph first (equivalent to "\n\n" in plain text).
 *
 * @param {import('@tiptap/core').Editor} editor
 * @param {string} plain
 */
export function appendOcrPlainTextToTipTap(editor, plain) {
  const t = typeof plain === 'string' ? plain.trim() : '';
  if (!t) {
    return;
  }
  const blockHtml = ocrPlainTextToTipTapHtml(t);
  if (!blockHtml) {
    return;
  }
  const docEmpty = !editor.getText().trim();
  const toInsert = docEmpty ? blockHtml : `<p></p>${blockHtml}`;
  editor.chain().focus('end').insertContent(toInsert).run();
}
