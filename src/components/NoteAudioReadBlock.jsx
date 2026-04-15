import { useEffect, useState } from 'react';
import { createNoteAudioSignedUrl } from '../lib/noteAudioSignedUrl.js';
import NoteInfoCircleIcon from './NoteInfoCircleIcon.jsx';
import '../styles/noteAudio.css';

/**
 * Read-only audio embed: React-controlled player + info (survives parent re-renders).
 *
 * @param {{
 *   attrs: { storagePath: string, fileName: string, mimeType: string, sizeBytes: number | null, uploadedAt: string },
 *   onOpenInfo: (attrs: { storagePath: string, fileName: string, mimeType: string, sizeBytes: number | null, uploadedAt: string }) => void,
 * }} props
 */
export default function NoteAudioReadBlock({ attrs, onOpenInfo }) {
  const { storagePath, fileName } = attrs;
  const [src, setSrc] = useState(/** @type {string | null} */ (null));
  const [error, setError] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    if (!storagePath) {
      setError('Missing storage path');
      return;
    }
    let cancelled = false;
    setSrc(null);
    setError(null);
    createNoteAudioSignedUrl(storagePath).then((r) => {
      if (cancelled) return;
      if (r.url) setSrc(r.url);
      else setError(r.error ?? 'Could not load audio');
    });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  const label = typeof fileName === 'string' && fileName.trim() ? fileName.trim() : 'Audio clip';

  return (
    <figure className="nn-audio-embed nn-audio-read-block" aria-label={label}>
      <div className="nn-audio-row">
        <div className="nn-audio-player-wrap">
          {error ? <p className="nn-audio-read-error">{error}</p> : null}
          {!error && !src ? <span className="nn-audio-read-loading">Loading…</span> : null}
          {src ? (
            <audio
              className="nn-audio-element"
              controls
              preload="metadata"
              src={src}
              aria-label={label}
            />
          ) : null}
        </div>
        <div className="nn-audio-tools">
          <button
            type="button"
            className="nn-app-info-btn"
            onClick={() => onOpenInfo(attrs)}
            aria-label="Audio file info"
            title="Info"
          >
            <NoteInfoCircleIcon />
          </button>
        </div>
      </div>
      <figcaption className="nn-audio-caption nn-audio-sr-only">{label}</figcaption>
    </figure>
  );
}
