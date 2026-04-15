import { useEffect, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { Info, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { createNoteAudioSignedUrl } from '../lib/noteAudioSignedUrl.js';
import AudioFileInfoModal from './AudioFileInfoModal.jsx';
import '../styles/noteAudio.css';
import styles from './NoteAudioNodeView.module.css';

/**
 * @param {import('@tiptap/react').NodeViewProps} props
 */
export default function NoteAudioNodeView({ node, deleteNode, editor }) {
  const { user } = useAuth();
  const { storagePath, fileName, sizeBytes, uploadedAt } = node.attrs;
  const [src, setSrc] = useState(/** @type {string | null} */ (null));
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [infoOpen, setInfoOpen] = useState(false);

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
    <NodeViewWrapper className={styles.wrap} data-drag-handle>
      <figure className="nn-audio-embed" aria-label={label}>
        <div className={styles.row}>
          <div className={styles.playerSlot}>
            {error ? <p className={styles.inlineError}>{error}</p> : null}
            {!error && !src ? <span className={styles.loading}>Loading…</span> : null}
            {src ? (
              <audio
                className={styles.audio}
                controls
                preload="metadata"
                src={src}
                aria-label={label}
              />
            ) : null}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setInfoOpen(true)}
              aria-label="Audio file info"
              title="Info"
            >
              <Info className={styles.actionIcon} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => deleteNode()}
              aria-label="Remove audio from note"
              title="Remove from note"
            >
              <Trash2 className={styles.actionIcon} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
        <figcaption className="nn-audio-caption nn-audio-sr-only">{label}</figcaption>
      </figure>
      <AudioFileInfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        fileName={typeof fileName === 'string' ? fileName : ''}
        sizeBytes={sizeBytes != null ? Number(sizeBytes) : null}
        uploadedAt={typeof uploadedAt === 'string' ? uploadedAt : ''}
        userId={user?.id ?? null}
        storagePath={typeof storagePath === 'string' ? storagePath : ''}
        editor={editor}
      />
    </NodeViewWrapper>
  );
}
