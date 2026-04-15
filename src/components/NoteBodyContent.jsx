import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchNoteAudioDisplayNamesForPaths } from '../lib/noteAudioDisplayNames.js';
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
  const { user } = useAuth();
  const remote = useSupabaseBackend();
  const audioUserId = remote && user?.id ? user.id : null;

  const [audioInfo, setAudioInfo] = useState(
    /** @type {{ fileName: string, sizeBytes: number | null, uploadedAt: string, storagePath: string } | null} */ (
      null
    )
  );
  const [displayNameByPath, setDisplayNameByPath] = useState(/** @type {Record<string, string>} */ ({}));

  const onOpenAudioInfo = useCallback(
    (attrs) => {
      setAudioInfo({
        fileName: attrs.fileName,
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

  useEffect(() => {
    if (!audioUserId || !readSegments) return;
    const paths = readSegments
      .filter((s) => s.type === 'audio')
      .map((s) => s.attrs.storagePath)
      .filter(Boolean);
    if (paths.length === 0) return;
    let cancelled = false;
    fetchNoteAudioDisplayNamesForPaths(audioUserId, paths).then((map) => {
      if (!cancelled) setDisplayNameByPath(map);
    });
    return () => {
      cancelled = true;
    };
  }, [audioUserId, readSegments]);

  const readSegmentsWithDisplayNames = useMemo(() => {
    if (!readSegments) return null;
    return readSegments.map((seg) => {
      if (seg.type !== 'audio') return seg;
      const dn = displayNameByPath[seg.attrs.storagePath];
      if (!dn) return seg;
      return { type: 'audio', attrs: { ...seg.attrs, fileName: dn } };
    });
  }, [readSegments, displayNameByPath]);

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
        {readSegmentsWithDisplayNames
          ? readSegmentsWithDisplayNames.map((seg, i) =>
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
        sizeBytes={audioInfo?.sizeBytes ?? null}
        uploadedAt={audioInfo?.uploadedAt ?? ''}
        userId={audioUserId}
        storagePath={audioInfo?.storagePath ?? ''}
        onDisplayNameSaved={(path, name) => {
          setDisplayNameByPath((prev) => ({ ...prev, [path]: name }));
        }}
      />
    </>
  );
}
