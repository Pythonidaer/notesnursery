/** @param {number} sec */
function formatDuration(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/**
 * @param {{
 *   durationSec: number,
 *   status: string,
 *   liveMessage: string,
 *   isRecording: boolean,
 *   isPaused: boolean,
 *   pauseSupported: boolean,
 *   busy: boolean,
 *   onStart: () => void,
 *   onPause: () => void,
 *   onResume: () => void,
 *   onStop: () => void,
 *   error: string | null,
 *   styles: Record<string, string>,
 * }} props
 */
export default function RecordingControls({
  durationSec,
  liveMessage,
  isRecording,
  isPaused,
  pauseSupported,
  busy,
  onStart,
  onPause,
  onResume,
  onStop,
  error,
  styles,
}) {
  const idle = !isRecording && !isPaused;

  return (
    <section className={styles.recordingControls} aria-labelledby="recording-controls-heading">
      <h2 id="recording-controls-heading" className={styles.recordingControlsTitle}>
        New recording
      </h2>

      <p className={styles.recordingMeta} aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>

      <div className={styles.recordingStats}>
        <span className={styles.recordingDuration} aria-label="Duration">
          {formatDuration(durationSec)}
        </span>
      </div>

      {error ? (
        <p className={styles.recordingError} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.recordingBtnRow}>
        {idle ? (
          <button
            type="button"
            className={styles.recordingBtnPrimary}
            disabled={busy}
            onClick={() => void onStart()}
          >
            Start recording
          </button>
        ) : null}

        {isRecording && pauseSupported ? (
          <button type="button" className={styles.recordingBtn} disabled={busy} onClick={() => void onPause()}>
            Pause
          </button>
        ) : null}

        {isPaused ? (
          <button type="button" className={styles.recordingBtn} disabled={busy} onClick={() => void onResume()}>
            Resume
          </button>
        ) : null}

        {isRecording || isPaused ? (
          <button
            type="button"
            className={styles.recordingBtnDanger}
            disabled={busy}
            onClick={() => void onStop()}
          >
            Stop
          </button>
        ) : null}
      </div>
    </section>
  );
}
