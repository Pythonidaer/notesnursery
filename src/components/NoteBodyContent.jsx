import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { CONTENT_TYPE_HTML, CONTENT_TYPE_MARKDOWN, normalizeContentType } from '../utils/noteContentModel.js';
import { sanitizeNoteHtml } from '../utils/sanitizeNoteHtml.js';

/**
 * GFM markdown with limited inline HTML (sanitized). `rehype-raw` runs before
 * `rehype-sanitize` so tags like `<u>` / `<span style="color:…">` work when
 * authors include them intentionally; the sanitizer schema still strips scripts
 * and dangerous attributes.
 */
const markdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'u'],
  attributes: {
    ...defaultSchema.attributes,
    span: ['style'],
  },
};

/**
 * @param {{
 *   contentType?: string,
 *   bodyHtml?: string,
 *   bodyMarkdown?: string,
 *   className?: string,
 * }} props
 */
export default function NoteBodyContent({ contentType, bodyHtml, bodyMarkdown, className }) {
  const mode = normalizeContentType(contentType);

  const safeHtml = useMemo(() => {
    if (mode !== CONTENT_TYPE_HTML) return '';
    const raw = bodyHtml ?? '';
    if (!raw.trim()) return '';
    return sanitizeNoteHtml(raw);
  }, [mode, bodyHtml]);

  if (mode === CONTENT_TYPE_MARKDOWN) {
    const md = bodyMarkdown ?? '';
    if (!md.trim()) {
      return <div className={className} />;
    }
    return (
      <div className={className}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
        >
          {md}
        </ReactMarkdown>
      </div>
    );
  }

  if (!safeHtml) {
    return <div className={className} />;
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
