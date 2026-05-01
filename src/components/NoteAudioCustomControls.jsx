import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';

/** @param {number} sec */
function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/**
 * Cross-browser audio chrome (Safari native controls ignore most styling).
 *
 * @param {{ src: string, label: string }} props
 */
const NoteAudioCustomControls = forwardRef(function NoteAudioCustomControls(
  { src, label },
  forwardedRef
) {
  const audioRef = useRef(/** @type {HTMLAudioElement | null} */ (null));
  const seekingRef = useRef(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const setRefs = useCallback(
    (el) => {
      audioRef.current = el;
      if (typeof forwardedRef === 'function') forwardedRef(el);
      else if (forwardedRef && typeof forwardedRef === 'object') forwardedRef.current = el;
    },
    [forwardedRef]
  );

  useEffect(() => {
    setDuration(0);
    setCurrent(0);
    setPlaying(false);
  }, [src]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onMeta = () => {
      const d = a.duration;
      setDuration(Number.isFinite(d) && d > 0 ? d : 0);
    };
    const onTime = () => {
      if (!seekingRef.current) setCurrent(a.currentTime);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(a.duration || 0);
    };
    const onVolume = () => setMuted(a.muted);

    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('durationchange', onMeta);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    a.addEventListener('volumechange', onVolume);

    onMeta();
    setMuted(a.muted);
    setPlaying(!a.paused);
    setCurrent(a.currentTime);

    return () => {
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('durationchange', onMeta);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('volumechange', onVolume);
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    setMuted(a.muted);
  }, []);

  const dur = duration > 0 ? duration : 0;
  const max = dur > 0 ? dur : 1;
  const value = Math.min(Math.max(0, current), max);

  return (
    <div className="nn-audio-pill nn-audio-pill--custom">
      <audio ref={setRefs} className="nn-audio-element nn-audio-element--hidden" src={src} preload="metadata" aria-label={label} />
      <div className="nn-audio-custom-bar">
        <button
          type="button"
          className="nn-audio-custom-play"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <Pause className="nn-audio-custom-icon" strokeWidth={2} aria-hidden />
          ) : (
            <Play className="nn-audio-custom-icon" strokeWidth={2} aria-hidden />
          )}
        </button>
        <span className="nn-audio-timePair" aria-hidden>
          {formatTime(current)} / {formatTime(dur > 0 ? dur : 0)}
        </span>
        <input
          type="range"
          className="nn-audio-scrub"
          min={0}
          max={max}
          step="any"
          value={value}
          disabled={dur <= 0}
          aria-label={`Seek: ${label}`}
          onPointerDown={() => {
            seekingRef.current = true;
          }}
          onPointerUp={() => {
            seekingRef.current = false;
          }}
          onPointerCancel={() => {
            seekingRef.current = false;
          }}
          onChange={(e) => {
            const a = audioRef.current;
            if (!a) return;
            const t = Number(e.target.value);
            a.currentTime = t;
            setCurrent(t);
          }}
        />
        <button
          type="button"
          className="nn-audio-custom-mute"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <VolumeX className="nn-audio-custom-iconSm" strokeWidth={2} aria-hidden />
          ) : (
            <Volume2 className="nn-audio-custom-iconSm" strokeWidth={2} aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
});

NoteAudioCustomControls.displayName = 'NoteAudioCustomControls';

export default NoteAudioCustomControls;
