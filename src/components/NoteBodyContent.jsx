import { useCallback, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { splitNoteHtmlForAudioRead } from '../utils/splitNoteHtmlForAudioRead.js';
import { CONTENT_TYPE_HTML, CONTENT_TYPE_MARKDOWN, normalizeContentType } from '../utils/noteContentModel.js';
import { prepareNoteBodyHtml } from '../utils/parsePlainTextNoteToHtml.js';
import { sanitizeNoteHtml } from '../utils/sanitizeNoteHtml.js';
import AudioFileInfoModal from './AudioFileInfoModal.jsx';
import NoteAudioReadBlock from './NoteAudioReadBlock.jsx';
import '../styles/noteAudio.css';

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
    a: [...new Set([...(defaultSchema.attributes?.a ?? []), 'href', 'title', 'target', 'rel'])],
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
  const [audioInfo, setAudioInfo] = useState(
    /** @type {{ fileName: string, mimeType: string, sizeBytes: number | null, uploadedAt: string, storagePath: string } | null} */ (
      null
    )
  );

  const onOpenAudioInfo = useCallback(
    (attrs) => {
      setAudioInfo({
        fileName: attrs.fileName,
        mimeType: attrs.mimeType,
        sizeBytes: attrs.sizeBytes,
        uploadedAt: attrs.uploadedAt,
        storagePath: attrs.storagePath,
      });
    },
    []
  );

  const safeHtml = useMemo(() => {
    if (mode !== CONTENT_TYPE_HTML) return '';
    const raw = bodyHtml ?? '';
    if (!raw.trim()) return '';
    return sanitizeNoteHtml(prepareNoteBodyHtml(raw));
  }, [mode, bodyHtml]);

  const readSegments = useMemo(() => {
    if (mode !== CONTENT_TYPE_HTML || !safeHtml.trim()) return null;
    return splitNoteHtmlForAudioRead(safeHtml);
  }, [mode, safeHtml]);

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
          components={{
            a: ({ href, children, ...rest }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
                {children}
              </a>
            ),
          }}
        >
          {md}
        </ReactMarkdown>
      </div>
    );
  }

  if (!safeHtml) {
    return <div className={className} />;
  }

  return (
    <>
      <div className={className}>
        {readSegments
          ? readSegments.map((seg, i) =>
              seg.type === 'html' ? (
                <div
                  key={`read-html-${i}`}
                  className="nn-body-html"
                  dangerouslySetInnerHTML={{ __html: seg.html }}
                />
              ) : (
                <NoteAudioReadBlock
                  key={`read-audio-${i}-${seg.attrs.storagePath}`}
                  attrs={seg.attrs}
                  onOpenInfo={onOpenAudioInfo}
                />
              )
            )
          : null}
      </div>
      <AudioFileInfoModal
        open={audioInfo != null}
        onClose={() => setAudioInfo(null)}
        fileName={audioInfo?.fileName ?? ''}
        mimeType={audioInfo?.mimeType ?? ''}
        sizeBytes={audioInfo?.sizeBytes ?? null}
        uploadedAt={audioInfo?.uploadedAt ?? ''}
        storagePath={audioInfo?.storagePath ?? ''}
      />
    </>
  );
}
