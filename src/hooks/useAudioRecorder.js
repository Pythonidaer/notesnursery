import { useCallback, useEffect, useRef, useState } from 'react';
import {
  appendRecordingChunk,
  getRecordingDraft,
  putRecordingDraft,
} from '../lib/audio/recordingDraftDb.js';
import {
  detectRecordingMimeType,
  isMediaRecorderSupported,
} from '../lib/audio/recordingMimeTypes.js';

/**
 * @param {string | null | undefined} userId
 */
export function useAudioRecorder(userId) {
  const [activeDraftId, setActiveDraftId] = useState(/** @type {string | null} */ (null));
  const [status, setStatus] = useState(/** @type {import('../lib/audio/recordingDraftDb.js').RecordingDraftStatus | 'idle'} */ ('idle'));
  const [durationSec, setDurationSec] = useState(0);
  const [mimeType, setMimeType] = useState('');
  const [extension, setExtension] = useState('');
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [pauseSupported, setPauseSupported] = useState(true);

  const mediaStreamRef = useRef(/** @type {MediaStream | null} */ (null));
  const recorderRef = useRef(/** @type {MediaRecorder | null} */ (null));
  const timerRef = useRef(/** @type {ReturnType<typeof setInterval> | null} */ (null));
  const startedAtRef = useRef(/** @type {number} */ (0));
  const accumulatedMsRef = useRef(0);
  const tickStartRef = useRef(/** @type {number | null} */ (null));

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const syncDurationTick = useCallback(() => {
    const base = accumulatedMsRef.current;
    const running = tickStartRef.current != null ? Date.now() - tickStartRef.current : 0;
    setDurationSec(Math.max(0, Math.floor((base + running) / 1000)));
  }, []);

  const startDurationTimer = useCallback(() => {
    clearTimer();
    tickStartRef.current = Date.now();
    timerRef.current = setInterval(syncDurationTick, 500);
    syncDurationTick();
  }, [clearTimer, syncDurationTick]);

  const pauseDurationTimer = useCallback(() => {
    if (tickStartRef.current != null) {
      accumulatedMsRef.current += Date.now() - tickStartRef.current;
      tickStartRef.current = null;
    }
    clearTimer();
    syncDurationTick();
  }, [clearTimer, syncDurationTick]);

  const stopTracks = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
    }
    mediaStreamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      stopTracks();
    };
  }, [clearTimer, stopTracks]);

  useEffect(() => {
    if (status !== 'recording') return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [status]);

  const startRecording = useCallback(async () => {
    setError(null);
    if (!userId) {
      setError('Sign in to record audio.');
      return null;
    }
    if (!isMediaRecorderSupported()) {
      setError('This browser does not support audio recording.');
      return null;
    }
    const detected = detectRecordingMimeType();
    if (!detected) {
      setError('No supported recording format was found in this browser.');
      return null;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Microphone permission was denied. Allow microphone access and try again.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('No microphone was found on this device.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not access the microphone.');
      }
      return null;
    }

    const draftId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `draft-${Date.now()}`;
    const now = new Date().toISOString();
    accumulatedMsRef.current = 0;
    tickStartRef.current = null;
    setDurationSec(0);
    setMimeType(detected.mimeType);
    setExtension(detected.extension);

    /** @type {Blob[]} */
    const memoryChunks = [];

    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: detected.mimeType });
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        stopTracks();
        setError('Could not start the recorder in this browser.');
        return null;
      }
    }

    setPauseSupported(typeof recorder.pause === 'function');

    recorder.ondataavailable = (ev) => {
      if (!ev.data || ev.data.size === 0) return;
      memoryChunks.push(ev.data);
      void appendRecordingChunk(draftId, ev.data, {
        duration: Math.max(
          0,
          Math.floor(
            (accumulatedMsRef.current +
              (tickStartRef.current != null ? Date.now() - tickStartRef.current : 0)) /
              1000
          )
        ),
        status: recorder.state === 'paused' ? 'paused' : 'recording',
      }).catch((e) => {
        console.error('[recording] chunk save', e);
      });
    };

    recorder.onerror = () => {
      setError('Recording failed unexpectedly.');
    };

    mediaStreamRef.current = stream;
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();

    await putRecordingDraft({
      draftId,
      userId,
      startedAt: now,
      updatedAt: now,
      duration: 0,
      mimeType: detected.mimeType,
      extension: detected.extension,
      status: 'recording',
      audioBuffer: new ArrayBuffer(0),
    });

    recorder.start(1000);
    setActiveDraftId(draftId);
    setStatus('recording');
    startDurationTimer();
    return draftId;
  }, [userId, startDurationTimer, stopTracks]);

  const pauseRecording = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'recording' || typeof rec.pause !== 'function') return;
    rec.pause();
    pauseDurationTimer();
    setStatus('paused');
    if (activeDraftId) {
      const existing = await getRecordingDraft(activeDraftId);
      if (existing) {
        const d = Math.max(0, Math.floor(accumulatedMsRef.current / 1000));
        await putRecordingDraft({
          ...existing,
          status: 'paused',
          duration: d,
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    }
  }, [activeDraftId, pauseDurationTimer]);

  const resumeRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'paused' || typeof rec.resume !== 'function') return;
    rec.resume();
    startDurationTimer();
    setStatus('recording');
  }, [startDurationTimer]);

  const stopRecording = useCallback(async () => {
    const rec = recorderRef.current;
    const draftId = activeDraftId;
    if (!rec || !draftId) return null;

    pauseDurationTimer();

    // iOS Safari often omits the final chunk unless we flush before stop.
    if (typeof rec.requestData === 'function' && rec.state !== 'inactive') {
      try {
        rec.requestData();
      } catch {
        /* ignore */
      }
    }

    await new Promise((resolve) => {
      const done = () => resolve(undefined);
      const prev = rec.onstop;
      rec.onstop = (/** @type {Event} */ ev) => {
        if (typeof prev === 'function') prev.call(rec, ev);
        done();
      };
      const timer = window.setTimeout(done, 500);
      const wrap = () => {
        window.clearTimeout(timer);
        done();
      };
      try {
        if (rec.state !== 'inactive') rec.stop();
        else wrap();
      } catch {
        wrap();
      }
    });

    await new Promise((r) => window.setTimeout(r, 80));

    stopTracks();
    const duration = Math.max(0, Math.floor(accumulatedMsRef.current / 1000));
    const updatedAt = new Date().toISOString();
    const existing = await getRecordingDraft(draftId);
    if (existing) {
      await putRecordingDraft({
        ...existing,
        status: 'stopped-local',
        duration,
        updatedAt,
      });
    }
    setStatus('stopped-local');
    setActiveDraftId(null);
    recorderRef.current = null;
    return draftId;
  }, [activeDraftId, pauseDurationTimer, stopTracks]);

  const resetRecorderUi = useCallback(() => {
    pauseDurationTimer();
    stopTracks();
    setActiveDraftId(null);
    setStatus('idle');
    setDurationSec(0);
    setError(null);
    accumulatedMsRef.current = 0;
    tickStartRef.current = null;
  }, [pauseDurationTimer, stopTracks]);

  return {
    activeDraftId,
    status,
    durationSec,
    mimeType,
    extension,
    error,
    pauseSupported,
    isRecording: status === 'recording',
    isPaused: status === 'paused',
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecorderUi,
    formatLabel: extension ? `${mimeType || 'audio'} (.${extension})` : '',
  };
}
