import { useCallback, useEffect, useId, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import { MoreVertical, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import styles from './AnalysisWaveform.module.css';

const WAVE = '#95c4a8';
const PROGRESS = '#2d6a4f';

function formatFileSize(bytes) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWaveTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * @param {{ ws: import('wavesurfer.js').default, durationSec: number | null, fileLabel: string, sizeBytes: number | null, formatLabel?: string }} p
 */
function WaveformTransport({ ws, durationSec, fileLabel, sizeBytes, formatLabel = 'MP3' }) {
  const media = ws.getMediaElement();
  const [playing, setPlaying] = useState(() => !media.paused);
  const [moreOpen, setMoreOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [vol, setVol] = useState(() => media.volume);
  const [muted, setMuted] = useState(() => media.muted);
  const moreRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const volumeRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const total =
    Number.isFinite(durationSec) && durationSec != null && durationSec > 0
      ? durationSec
      : Number.isFinite(media.duration) && media.duration > 0
        ? media.duration
        : null;
  const totalLabel = total != null ? formatWaveTime(total) : '—';

  useEffect(() => {
    const m = media;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVol = () => {
      setVol(m.volume);
      setMuted(m.muted);
    };
    m.addEventListener('play', onPlay);
    m.addEventListener('pause', onPause);
    m.addEventListener('ended', onPause);
    m.addEventListener('volumechange', onVol);
    onVol();
    return () => {
      m.removeEventListener('play', onPlay);
      m.removeEventListener('pause', onPause);
      m.removeEventListener('ended', onPause);
      m.removeEventListener('volumechange', onVol);
    };
  }, [ws, media]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e) => {
      if (moreRef.current && !moreRef.current.contains(/** @type {Node} */ (e.target))) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  useEffect(() => {
    if (!volumeOpen) return;
    const onDoc = (e) => {
      if (volumeRef.current && !volumeRef.current.contains(/** @type {Node} */ (e.target))) {
        setVolumeOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [volumeOpen]);

  useEffect(() => {
    if (!volumeOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setVolumeOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [volumeOpen]);

  const onPlayClick = useCallback(() => {
    void ws.playPause();
  }, [ws]);

  const onVolumeInput = useCallback(
    (e) => {
      const v = parseFloat(/** @type {HTMLInputElement} */ (e.target).value);
      if (Number.isFinite(v)) {
        media.volume = v;
        if (v > 0) media.muted = false;
      }
    },
    [media]
  );

  return (
    <div className={styles.transport} role="group" aria-label="Playback">
      <button
        type="button"
        className={styles.playBtn}
        onClick={onPlayClick}
        aria-label={playing ? 'Pause' : 'Play'}
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={13} strokeWidth={2} /> : <Play size={13} strokeWidth={2} className={styles.playIcon} />}
      </button>
      <div className={styles.volumeWrap} ref={volumeRef}>
        <button
          type="button"
          className={styles.volumeIconBtn}
          onClick={() => {
            setMoreOpen(false);
            setVolumeOpen((o) => !o);
          }}
          aria-expanded={volumeOpen}
          aria-label="Volume"
          title="Volume"
        >
          {muted || vol === 0 ? <VolumeX size={14} strokeWidth={1.9} /> : <Volume2 size={14} strokeWidth={1.9} />}
        </button>
        {volumeOpen ? (
          <div
            className={styles.volumePopover}
            role="group"
            aria-label="Set volume. Top is full, bottom is silent."
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className={styles.volumePopoverInner}>
              <input
                className={styles.volumeRangeVertical}
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={muted ? 0 : vol}
                onChange={onVolumeInput}
                aria-label="Volume"
                aria-orientation="vertical"
              />
            </div>
          </div>
        ) : null}
      </div>
      <div className={styles.moreWrap} ref={moreRef}>
        <button
          type="button"
          className={`${styles.iconGhostBtn} ${styles.moreMenuBtn}`}
          onClick={() => {
            setVolumeOpen(false);
            setMoreOpen((o) => !o);
          }}
          aria-expanded={moreOpen}
          aria-label="File details"
          title="File details"
        >
          <MoreVertical size={14} strokeWidth={1.9} />
        </button>
        {moreOpen ? (
          <div className={styles.morePanel} role="dialog" aria-label="File information">
            <dl className={styles.moreList}>
              <div className={styles.moreRow}>
                <dt>File</dt>
                <dd title={fileLabel}>{fileLabel || '—'}</dd>
              </div>
              <div className={styles.moreRow}>
                <dt>Duration</dt>
                <dd>{totalLabel}</dd>
              </div>
              <div className={styles.moreRow}>
                <dt>Format</dt>
                <dd>{formatLabel}</dd>
              </div>
              <div className={styles.moreRow}>
                <dt>Size</dt>
                <dd>{formatFileSize(sizeBytes)}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Full-recording waveform using WaveSurfer (read/analyze; native &lt;audio&gt; is hidden, custom transport).
 *
 * @param {{
 *   audioUrl: string | null,
 *   fileLabel?: string,
 *   sizeBytes?: number | null,
 *   onReadyInfo?: (info: { durationSec: number }) => void,
 *   resolving?: boolean,
 *   variant?: 'default' | 'wide',
 *   emptyStateContent?: import('react').ReactNode,
 *   headerFileOptions?: { path: string, label: string }[],
 *   headerFileValue?: string,
 *   onHeaderFileChange?: (path: string) => void,
 *   headerFileSelectId?: string,
 *   onHeaderDismiss?: () => void,
 *   headerDismissAriaLabel?: string,
 * }} props
 */
export default function AnalysisWaveform({
  audioUrl,
  fileLabel = 'Recording',
  sizeBytes = null,
  onReadyInfo,
  resolving = false,
  variant = 'default',
  emptyStateContent,
  headerFileOptions,
  headerFileValue,
  onHeaderFileChange,
  headerFileSelectId,
  onHeaderDismiss,
  headerDismissAriaLabel = 'Close waveform',
}) {
  const rootId = useId();
  const isWideDesktop = useMediaQuery('(min-width: 900px)');
  /** Height for WaveSurfer only; do not depend on viewport — avoids destroying/recreating the player on matchMedia/resize. */
  const chartHeight = variant === 'wide' ? 280 : 156;
  const containerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const audioHostRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const wsRef = useRef(/** @type {import('wavesurfer.js').default | null} */ (null));
  const [status, setStatus] = useState(/** @type {'idle' | 'loading' | 'ready' | 'error'} */ ('idle'));
  const [errorMessage, setErrorMessage] = useState(/** @type {string | null} */ (null));
  const [durationSec, setDurationSec] = useState(/** @type {number | null} */ (null));
  const [activeWs, setActiveWs] = useState(/** @type {import('wavesurfer.js').default | null} */ (null));

  const titleText = (fileLabel || 'Selected track').trim() || 'Selected track';
  const hasHeaderFilePicker = Boolean(
    headerFileOptions &&
      headerFileOptions.length > 0 &&
      typeof onHeaderFileChange === 'function' &&
      headerFileSelectId
  );

  const fitZoom = useCallback((/** @type {import('wavesurfer.js').default} */ ws) => {
    const el = containerRef.current;
    if (!el) return;
    // ws.zoom() throws "No audio loaded" if decode has not finished (ResizeObserver can fire first)
    if (typeof ws.getDecodedData === 'function' && !ws.getDecodedData()) return;
    const w = el.clientWidth;
    if (w < 1) return;
    let d;
    try {
      d = ws.getDuration();
    } catch {
      return;
    }
    if (!Number.isFinite(d) || d <= 0) return;
    try {
      ws.zoom(w / d);
    } catch {
      // ignore: not decoded yet
    }
  }, []);

  useEffect(() => {
    setErrorMessage(null);
    setDurationSec(null);
    setActiveWs(null);

    if (!audioUrl || !containerRef.current) {
      setStatus('idle');
      return;
    }

    setStatus('loading');
    const container = containerRef.current;
    const timeline = TimelinePlugin.create({
      height: 22,
      formatTimeCallback: formatWaveTime,
      style: {
        fontSize: '11px',
        color: 'var(--muted)',
      },
    });

    const ws = WaveSurfer.create({
      container,
      height: chartHeight,
      waveColor: WAVE,
      progressColor: PROGRESS,
      cursorColor: PROGRESS,
      cursorWidth: 2,
      barWidth: 0,
      normalize: true,
      fillParent: true,
      url: audioUrl,
      mediaControls: false,
      dragToSeek: true,
      autoScroll: true,
      autoCenter: true,
      sampleRate: 8000,
      fetchParams: { mode: 'cors' },
      plugins: [timeline],
    });

    const host = audioHostRef.current;
    if (host) {
      const media = ws.getMediaElement();
      host.appendChild(media);
    }

    wsRef.current = ws;

    const onReady = (d) => {
      setStatus('ready');
      setDurationSec(d);
      setActiveWs(ws);
      if (Number.isFinite(d) && d > 0) {
        onReadyInfo?.({ durationSec: d });
      }
      requestAnimationFrame(() => fitZoom(ws));
    };
    const onError = (err) => {
      setStatus('error');
      setErrorMessage(err?.message || 'Could not load or decode this audio file.');
    };

    ws.on('ready', onReady);
    ws.on('error', onError);

    const ro = new ResizeObserver(() => {
      const cur = wsRef.current;
      if (cur) fitZoom(cur);
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      ws.un('ready', onReady);
      ws.un('error', onError);
      setActiveWs(null);
      ws.destroy();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [audioUrl, fitZoom, onReadyInfo, variant]);

  const labelledBy = fileLabel ? `${rootId}-label` : undefined;

  if (resolving) {
    return (
      <div
        className={styles.panel}
        role="status"
        aria-live="polite"
        aria-label="Loading waveform"
        data-loading
      >
        <p className={styles.hint}>Preparing audio and waveform…</p>
      </div>
    );
  }

  if (!audioUrl) {
    return (
      <div
        className={styles.panel}
        role="region"
        aria-label="Waveform"
        data-empty
      >
        {emptyStateContent ?? <p className={styles.hint}>Select an .mp3 to load the waveform.</p>}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.panel} role="alert">
        <p className={styles.error}>{errorMessage || 'Could not load waveform.'}</p>
      </div>
    );
  }

  return (
    <div
      className={variant === 'wide' && isWideDesktop ? `${styles.wrap} ${styles.wrapWide}` : styles.wrap}
      role="region"
      aria-labelledby={labelledBy}
    >
      {fileLabel ? (
        <p id={`${rootId}-label`} className={styles.srOnly}>
          Waveform for {fileLabel}
          {durationSec != null && Number.isFinite(durationSec) ? `, duration ${formatWaveTime(durationSec)}` : ''}
        </p>
      ) : null}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={
              hasHeaderFilePicker
                ? `${styles.cardHeaderText} ${styles.cardHeaderTextCapped}`
                : styles.cardHeaderText
            }
          >
            {hasHeaderFilePicker && headerFileOptions && headerFileSelectId ? (
              <div className={styles.fileTitleSelectShell}>
                <select
                  id={headerFileSelectId}
                  className={styles.fileTitleSelect}
                  value={headerFileValue ?? ''}
                  onChange={(e) => onHeaderFileChange?.(e.target.value)}
                  aria-label="Choose which MP3 to show in the waveform"
                >
                  {headerFileOptions.map((o) => (
                    <option key={o.path} value={o.path}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <h3 className={styles.fileTitle}>{titleText}</h3>
            )}
          </div>
          <div className={styles.headerTransportSlot}>
            <div className={styles.headerRightControls}>
              <div className={styles.headerTransportBunch}>
                {activeWs && status === 'ready' ? (
                  <WaveformTransport
                    ws={activeWs}
                    durationSec={durationSec}
                    fileLabel={titleText}
                    sizeBytes={sizeBytes}
                    formatLabel="MP3"
                  />
                ) : status === 'loading' ? (
                  <div className={styles.transportPlaceholder} aria-hidden />
                ) : (
                  <div className={styles.transportPlaceholder} aria-hidden>
                    <span className={styles.transportPlaceholderText}>…</span>
                  </div>
                )}
              </div>
              {typeof onHeaderDismiss === 'function' ? (
                <button
                  type="button"
                  className={styles.headerDismissBtn}
                  onClick={() => onHeaderDismiss()}
                  aria-label={headerDismissAriaLabel}
                  title={headerDismissAriaLabel}
                >
                  <X size={14} strokeWidth={1.9} />
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div
          ref={containerRef}
          className={styles.waveMount}
          data-loading={status === 'loading' ? 'true' : undefined}
          aria-busy={status === 'loading' ? 'true' : 'false'}
        />
        <div ref={audioHostRef} className={styles.audioSink} aria-hidden="true" />
        {status === 'loading' ? (
          <p className={styles.building} aria-live="polite">
            Building waveform…
          </p>
        ) : null}
      </div>
    </div>
  );
}
