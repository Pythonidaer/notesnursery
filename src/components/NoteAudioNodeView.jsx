import { useCallback, useEffect, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { Grip, Info, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSupabaseBackend } from '../config/appConfig.js';
import { createNoteAudioSignedUrl } from '../lib/noteAudioSignedUrl.js';
import { transcribeAudioFromUrl } from '../lib/transcribeNoteAudioLocal.js';
import { insertTranscriptBelowAudioChain } from '../utils/insertNoteAudioTranscript.js';
import { logTranscribeError, transcribeErrorForModal } from '../utils/transcribeUserError.js';
import AudioFileInfoModal from './AudioFileInfoModal.jsx';
import TranscribeAudioModal from './TranscribeAudioModal.jsx';
import { useNoteEditFloatingAudio } from './NoteEditFloatingAudioContext.jsx';
import '../styles/noteAudio.css';
import styles from './NoteAudioNodeView.module.css';

/**
 * @param {import('@tiptap/react').NodeViewProps} props
 */
export default function NoteAudioNodeView({ node, deleteNode, editor, getPos }) {
  const floatingCtx = useNoteEditFloatingAudio();
  const setActivePlayback = floatingCtx?.setActivePlayback;
  const clearActivePlayback = floatingCtx?.clearActivePlayback;
  const dockUiVisible = floatingCtx?.dockUiVisible ?? false;
  const audioRef = useRef(/** @type {HTMLAudioElement | null} */ (null));
  const anchorRef = useRef(/** @type {HTMLElement | null} */ (null));
  const { user } = useAuth();
  const remote = useSupabaseBackend();
  const { storagePath, fileName, sizeBytes, uploadedAt } = node.attrs;
  const [src, setSrc] = useState(/** @type {string | null} */ (null));
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [infoOpen, setInfoOpen] = useState(false);
  const [transcribeOpen, setTranscribeOpen] = useState(false);
  const [transcribeBusy, setTranscribeBusy] = useState(false);
  const [transcribeTitle, setTranscribeTitle] = useState('Transcribe audio');
  const [transcribeMessage, setTranscribeMessage] = useState('');
  const [transcribeDetail, setTranscribeDetail] = useState(/** @type {string | null} */ (null));
  const [dragOffset, setDragOffset] = useState(/** @type {{ x: number; y: number }} */ ({ x: 0, y: 0 }));
  const dragStartRef = useRef(/** @type {{ clientX: number; clientY: number; ox: number; oy: number } | null} */ (null));

  useEffect(() => {
    if (!dockUiVisible) setDragOffset({ x: 0, y: 0 });
  }, [dockUiVisible]);

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

  useEffect(() => {
    if (!setActivePlayback || !clearActivePlayback || !src) return;

    const onPlay = () => {
      const audio = audioRef.current;
      const anchor = anchorRef.current;
      if (!audio || !anchor) return;
      if (import.meta.env.DEV) {
        console.debug('[floating-audio] register playback', {
          label,
          anchorConnected: anchor.isConnected,
        });
      }
      setActivePlayback({ audioEl: audio, anchorEl: anchor, label });
    };
    const onEnded = () => {
      const audio = audioRef.current;
      if (audio) clearActivePlayback(audio);
    };

    const audio = audioRef.current;
    if (!audio) return;

    audio.addEventListener('play', onPlay);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('ended', onEnded);
      const a = audioRef.current;
      if (a) clearActivePlayback(a);
    };
  }, [setActivePlayback, clearActivePlayback, src, label]);

  const pathStr = typeof storagePath === 'string' ? storagePath.trim() : '';
  const canTranscribe = Boolean(remote && user?.id && pathStr && src && !error);

  const onGripPointerDown = useCallback(
    (e) => {
      if (!dockUiVisible) return;
      if (e.button !== 0) return;
      e.preventDefault();
      const start = {
        clientX: e.clientX,
        clientY: e.clientY,
        ox: dragOffset.x,
        oy: dragOffset.y,
      };
      dragStartRef.current = start;

      const onMove = (ev) => {
        const s = dragStartRef.current;
        if (!s) return;
        setDragOffset({
          x: s.ox + (ev.clientX - s.clientX),
          y: s.oy + (ev.clientY - s.clientY),
        });
      };
      const onUp = () => {
        dragStartRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [dockUiVisible, dragOffset.x, dragOffset.y]
  );

  const runTranscribe = async () => {
    if (!canTranscribe || !src || !editor || !pathStr) return;
    setTranscribeTitle('Transcribe audio');
    setTranscribeMessage('Loading the transcription model (first run may take a minute)…');
    setTranscribeDetail(null);
    setTranscribeBusy(true);
    setTranscribeOpen(true);
    try {
      const { text } = await transcribeAudioFromUrl(src, {
        onProgress: (p) => {
          const status = typeof p.status === 'string' ? p.status : '';
          if (status === 'progress' && typeof p.progress === 'number') {
            setTranscribeDetail(`${Math.round(p.progress * 100)}%`);
          } else if (typeof p.file === 'string' && p.file) {
            setTranscribeDetail(p.file);
          } else if (status) {
            setTranscribeDetail(status);
          }
        },
      });
      const trimmed = text.trim();
      if (!trimmed) {
        setTranscribeTitle('Transcribe audio');
        setTranscribeMessage('No speech was detected in this clip.');
        setTranscribeDetail('Try a clearer recording, or check that the clip contains spoken audio.');
        setTranscribeBusy(false);
        return;
      }
      const ok = insertTranscriptBelowAudioChain(editor, getPos, node, pathStr, trimmed);
      if (!ok) {
        setTranscribeMessage('Could not insert the transcript.');
        setTranscribeDetail('Try placing the audio in normal paragraph context (not inside a list).');
        setTranscribeBusy(false);
        return;
      }
      setTranscribeOpen(false);
      setTranscribeBusy(false);
    } catch (e) {
      logTranscribeError(e, 'note-audio');
      const { title, message, detail } = transcribeErrorForModal();
      setTranscribeTitle(title);
      setTranscribeMessage(message);
      setTranscribeDetail(detail);
      setTranscribeBusy(false);
    }
  };

  return (
    <NodeViewWrapper className={styles.wrap} data-drag-handle>
      <figure ref={anchorRef} className="nn-audio-embed" aria-label={label}>
        <div className={styles.row}>
          <div className={styles.playerSlot}>
            {error ? <p className={styles.inlineError}>{error}</p> : null}
            {!error && !src ? <span className={styles.loading}>Loading…</span> : null}
            {src ? (
              <div
                className={dockUiVisible ? styles.floatingDock : styles.inlineDockRoot}
                style={
                  dockUiVisible
                    ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }
                    : undefined
                }
                role={dockUiVisible ? 'region' : undefined}
                aria-label={dockUiVisible ? 'Now playing' : undefined}
              >
                {dockUiVisible ? (
                  <div className={styles.fileLine} title={label}>
                    {label}
                  </div>
                ) : null}
                <div className={styles.chromeRow}>
                  {dockUiVisible ? (
                    <button
                      type="button"
                      className={styles.dockGrip}
                      aria-label="Move player"
                      title="Move"
                      onPointerDown={onGripPointerDown}
                    >
                      <Grip className={styles.gripIcon} strokeWidth={2} aria-hidden />
                    </button>
                  ) : null}
                  <div className={dockUiVisible ? styles.playerPill : styles.inlinePlayerOnly}>
                    <audio
                      ref={audioRef}
                      className={styles.audio}
                      controls
                      preload="metadata"
                      src={src}
                      aria-label={label}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.textActionBtn} ${!canTranscribe ? styles.iconBtnDisabled : ''}`}
              onClick={() => void runTranscribe()}
              disabled={!canTranscribe || transcribeBusy}
              aria-label="Transcribe audio"
              title={
                canTranscribe
                  ? 'Transcribe (runs in your browser; first run downloads a small model)'
                  : 'Sign in and load audio to transcribe'
              }
            >
              TRANSCRIBE
            </button>
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
      <TranscribeAudioModal
        open={transcribeOpen}
        onClose={() => {
          if (transcribeBusy) return;
          setTranscribeOpen(false);
        }}
        title={transcribeTitle}
        message={transcribeMessage}
        detail={transcribeDetail}
        busy={transcribeBusy}
      />
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
