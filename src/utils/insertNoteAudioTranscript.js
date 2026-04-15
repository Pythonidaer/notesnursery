/**
 * Insert plain transcript paragraphs immediately after any existing transcript
 * blocks for the same audio `storagePath`, so re-runs append below prior transcripts.
 *
 * @param {import('@tiptap/core').Editor} editor
 * @param {() => number | undefined} getPos
 * @param {import('@tiptap/pm/model').Node} audioNode
 * @param {string} storagePath
 * @param {string} plainText
 * @returns {boolean}
 */
export function insertTranscriptBelowAudioChain(editor, getPos, audioNode, storagePath, plainText) {
  const audioPos = typeof getPos === 'function' ? getPos() : undefined;
  if (typeof audioPos !== 'number') return false;
  const path = typeof storagePath === 'string' ? storagePath.trim() : '';
  if (!path) return false;

  const doc = editor.state.doc;
  const chunks = splitTranscriptPlain(plainText);
  if (chunks.length === 0) return false;

  const insertPos = findInsertPosAfterTranscriptChain(doc, audioPos + audioNode.nodeSize, path);

  const nodes = chunks.map((chunk) => ({
    type: 'paragraph',
    attrs: { dataNnTranscriptFor: path },
    content: [{ type: 'text', text: chunk }],
  }));

  editor.chain().focus().insertContentAt(insertPos, nodes).run();
  return true;
}

/**
 * @param {import('@tiptap/pm/model').Node} doc
 * @param {number} startPos Position immediately after the audio node
 * @param {string} storagePath
 * @returns {number}
 */
function findInsertPosAfterTranscriptChain(doc, startPos, storagePath) {
  let pos = startPos;
  while (pos < doc.content.size) {
    const resolved = doc.resolve(pos);
    const after = resolved.nodeAfter;
    if (!after) break;
    if (after.type.name === 'paragraph' && after.attrs.dataNnTranscriptFor === storagePath) {
      pos += after.nodeSize;
      continue;
    }
    break;
  }
  return pos;
}

/**
 * @param {string} plainText
 * @returns {string[]}
 */
function splitTranscriptPlain(plainText) {
  const t = plainText.trim();
  if (!t) return [];
  const parts = t.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const blocks = parts.length ? parts : [t];
  return blocks.map((block) => block.replace(/\n/g, ' ').trim()).filter(Boolean);
}
