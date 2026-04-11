/**
 * Parses Apple Notes exported markdown files.
 * First line: markdown heading (# Title). Body: HTML/markdown. Bottom: Created / Modified lines.
 *
 * @param {string} sourceFileName
 * @param {string} text
 * @returns {{ id: string, sourceFileName: string, title: string, bodyHtml: string, createdAtSource: string, modifiedAtSource: string, labels: string[] }}
 */
export function parseAppleNoteMarkdown(sourceFileName, text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const firstLine = lines[0] ?? '';
  const titleMatch = firstLine.match(/^#\s+(.+)$/);
  const title = titleMatch
    ? titleMatch[1].trim()
    : firstLine.replace(/^#+\s*/, '').trim() || sourceFileName;

  const rest = lines.slice(1).join('\n');

  let createdAtSource = '';
  let modifiedAtSource = '';
  let bodyHtml = rest.trimEnd();

  const trailingMeta = bodyHtml.match(
    /\nCreated:\s*(.+)\nModified:\s*(.+)\s*$/s
  );
  if (trailingMeta) {
    createdAtSource = trailingMeta[1].trim();
    modifiedAtSource = trailingMeta[2].trim();
    bodyHtml = bodyHtml.slice(0, trailingMeta.index).trim();
  } else {
    const createdLine = bodyHtml.match(/^Created:\s*(.+)$/m);
    const modifiedLine = bodyHtml.match(/^Modified:\s*(.+)$/m);
    if (createdLine) createdAtSource = createdLine[1].trim();
    if (modifiedLine) modifiedAtSource = modifiedLine[1].trim();
    if (createdLine || modifiedLine) {
      bodyHtml = bodyHtml
        .replace(/^Created:\s*.+$/m, '')
        .replace(/^Modified:\s*.+$/m, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
  }

  bodyHtml = bodyHtml.trim();

  return {
    id: crypto.randomUUID(),
    sourceFileName,
    title,
    bodyHtml,
    createdAtSource,
    modifiedAtSource,
    labels: [],
  };
}
