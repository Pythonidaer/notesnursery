import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchNoteAudioDisplayNamesForPaths } from '../lib/noteAudioDisplayNames.js';
import { applyPosOverlayToReadBody } from '../lib/noteReadPosOverlay.js';
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
 *   posAnalysisEnabled?: boolean,
 *   onPosUsedAbbreviationsChange?: (abbrs: string[]) => void,
 *   posLegendOpen?: boolean,
 * }} props
 */
export default function NoteBodyContent({
  contentType,
  bodyHtml,
  bodyMarkdown,
  className,
  posAnalysisEnabled = false,
  posLegendOpen = false,
  onPosUsedAbbreviationsChange,
}) {
  const mode = normalizeContentType(contentType);
  const readBodyRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  /** Bumps only when POS turns off so HTML/Markdown body remounts clean without remounting audio blocks. */
  const [readBodyEpoch, setReadBodyEpoch] = useState(0);
  const prevPosEnabledRef = useRef(posAnalysisEnabled);
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

  useLayoutEffect(() => {
    const prev = prevPosEnabledRef.current;
    prevPosEnabledRef.current = posAnalysisEnabled;
    if (prev === true && posAnalysisEnabled === false) {
      setReadBodyEpoch((e) => e + 1);
    }
  }, [posAnalysisEnabled]);

  useLayoutEffect(() => {
    if (!posAnalysisEnabled || !readBodyRef.current) {
      onPosUsedAbbreviationsChange?.([]);
      return;
    }
    applyPosOverlayToReadBody(readBodyRef.current, {
      contentTypeHtml: mode === CONTENT_TYPE_HTML,
    });
    const found = new Set();
    readBodyRef.current.querySelectorAll('.nn-pos-tag').forEach((el) => {
      const t = el.textContent?.trim();
      if (t) found.add(t);
    });
    onPosUsedAbbreviationsChange?.(Array.from(found).sort((a, b) => a.localeCompare(b)));
  }, [
    posAnalysisEnabled,
    posLegendOpen,
    mode,
    safeHtml,
    bodyMarkdown,
    readSegmentsWithDisplayNames,
    readBodyEpoch,
    onPosUsedAbbreviationsChange,
  ]);

  if (mode === CONTENT_TYPE_MARKDOWN) {
    const md = bodyMarkdown ?? '';
    if (!md.trim()) {
      return <div ref={readBodyRef} className={className} data-nn-read-body-root />;
    }
    return (
      <div ref={readBodyRef} className={className} data-nn-read-body-root>
        <div
          className={posAnalysisEnabled ? 'nn-read-md-body nn-pos-text-body' : 'nn-read-md-body'}
        >
          <ReactMarkdown
            key={readBodyEpoch}
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
      </div>
    );
  }

  if (!safeHtml) {
    return <div ref={readBodyRef} className={className} data-nn-read-body-root />;
  }

  return (
    <>
      <div ref={readBodyRef} className={className} data-nn-read-body-root>
        {readSegmentsWithDisplayNames
          ? readSegmentsWithDisplayNames.map((seg, i) =>
              seg.type === 'html' ? (
                <div
                  key={`read-html-${i}-${readBodyEpoch}`}
                  className={
                    posAnalysisEnabled ? 'nn-body-html nn-pos-text-body' : 'nn-body-html'
                  }
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
