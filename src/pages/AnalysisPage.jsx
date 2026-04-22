import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AnalysisWaveform from '../components/AnalysisWaveform.jsx';
import PageContentWrap from '../components/PageContentWrap.jsx';
import { useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { listUserNoteAudioFiles } from '../lib/noteAudioList.js';
import { upsertNoteAudioDisplayName } from '../lib/noteAudioDisplayNames.js';
import { createNoteAudioSignedUrl } from '../lib/noteAudioSignedUrl.js';
import { uploadNoteAudioFile } from '../lib/noteAudioUpload.js';
import { NOTE_AUDIO_MAX_UPLOAD_BYTES } from '../constants/noteAudio.js';
import { describeNoteAudioUploadFailure } from '../utils/noteAudioUploadErrors.js';
import { validateAnalysisMp3File } from '../utils/validateAnalysisMp3File.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import styles from './AnalysisPage.module.css';

/** Storage scope for uploads from this page (see `buildNoteAudioObjectPath`). */
const ANALYSIS_AUDIO_SCOPE = 'analysis';

/**
 * @param {Awaited<ReturnType<typeof listUserNoteAudioFiles>>} rows
 * @returns {typeof rows}
 */
function filterMp3Rows(rows) {
  return rows.filter((r) => r.fileName.toLowerCase().endsWith('.mp3'));
}

/**
 * @param {{ path: string, fileName: string, displayName?: string | null }} row
 * @returns {{ path: string, label: string }}
 */
function toPickerOption(row) {
  return {
    path: row.path,
    label: (row.displayName || row.fileName).trim() || row.fileName,
  };
}

/**
 * Shared primary “audio source” block: library status, optional file input, select + Upload, optional compare row.
 * When `includeFileInput` is false, Upload uses the page-level hidden input at the same `fileInputRef`.
 */
function PrimarySourceCardInner({
  listLoading,
  listError,
  mp3List,
  selectedPath,
  setSelectedPath,
  fileInputRef,
  uploadId,
  onUploadFile,
  uploading,
  uploadError,
  selectId,
  selectIdB,
  compareOptions,
  selectedPathB,
  setSelectedPathB,
  emptyOptionLabel,
  includeFileInput,
  includeCompare,
}) {
  return (
    <>
      {listLoading ? <p className={styles.mutedInline}>Loading your library…</p> : null}
      {listError ? <p className={styles.errorInline}>{listError}</p> : null}
      {includeFileInput ? (
        <input
          id={uploadId}
          ref={fileInputRef}
          type="file"
          accept=".mp3,audio/mpeg"
          className={styles.hiddenFileInput}
          aria-label="Upload a new MP3 from your device"
          tabIndex={-1}
          onChange={(ev) => void onUploadFile(ev)}
        />
      ) : null}
      {!listLoading && !listError && mp3List.length > 0 ? (
        <div className={styles.sourceStack}>
          <div className={styles.sourceStackRow}>
            <select
              id={selectId}
              className={styles.sourceSelect}
              value={selectedPath}
              onChange={(e) => setSelectedPath(e.target.value)}
              disabled={mp3List.length === 0}
              aria-label="Choose an MP3 from your previously uploaded note audio"
            >
              <option value="">{emptyOptionLabel}</option>
              {mp3List.map((row) => (
                <option key={row.path} value={row.path}>
                  {row.displayName || row.fileName}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.fileBtn}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              title="MP3 from this device (25 MB max per file)"
              aria-label={uploading ? 'Uploading' : 'Upload an MP3 from your device'}
            >
              {uploading ? '…' : 'Upload'}
            </button>
          </div>
          {includeCompare && selectedPath ? (
            <div className={styles.sourceCompareCol} role="group" aria-label="Optional compare track">
              <label className={styles.sourceCompareFieldLabel} htmlFor={selectIdB}>
                Compare
              </label>
              {compareOptions.length > 0 ? (
                <select
                  id={selectIdB}
                  className={styles.sourceSelectStacked}
                  value={selectedPathB}
                  onChange={(e) => setSelectedPathB(e.target.value)}
                  aria-label="Optional second MP3 to compare with the first"
                >
                  <option value="">— None —</option>
                  {compareOptions.map((row) => (
                    <option key={row.path} value={row.path}>
                      {row.displayName || row.fileName}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className={styles.mutedCompareInline}
                  role="status"
                  title="Add another .mp3 to your library to compare two tracks"
                >
                  No other track
                </span>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      {!listLoading && !listError && mp3List.length === 0 ? (
        <div className={styles.sourceEmptyState}>
          <p className={styles.emptyInline}>
            No .mp3 in your library yet—upload to add, or add audio to a note.
          </p>
          <button
            type="button"
            className={styles.fileBtn}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            title="MP3 from this device (25 MB max per file)"
            aria-label={uploading ? 'Uploading' : 'Upload an MP3 from your device'}
          >
            {uploading ? '…' : 'Upload'}
          </button>
        </div>
      ) : null}
      {listError ? (
        <div className={styles.sourceRowEnd}>
          <button
            type="button"
            className={styles.fileBtn}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            title="MP3 from this device (25 MB max per file)"
            aria-label={uploading ? 'Uploading' : 'Upload an MP3 from your device'}
          >
            {uploading ? '…' : 'Upload'}
          </button>
        </div>
      ) : null}
      {uploadError ? <p className={styles.errorInline}>{uploadError}</p> : null}
    </>
  );
}

/** Matches Analysis / waveform “desktop” layout; below this, show a desktop-only notice instead. */
const ANALYSIS_DESKTOP_MIN = '(min-width: 900px)';

export default function AnalysisPage() {
  const { user, authInitializing } = useAuth();
  const remote = useSupabaseBackend();
  const isAnalysisDesktop = useMediaQuery(ANALYSIS_DESKTOP_MIN);
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const selectIdB = useId();
  const selectIdEmpty = useId();
  const waveformHeaderSelectId = useId();
  const waveformCompareSelectId = useId();
  const compareWaveformHeaderSelectId = useId();
  const uploadId = useId();

  const [mp3List, setMp3List] = useState(/** @type {Awaited<ReturnType<typeof listUserNoteAudioFiles>>} */ ([]));
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(/** @type {string | null} */ (null));
  const [selectedPath, setSelectedPath] = useState(/** @type {string} */ (''));
  const [selectedPathB, setSelectedPathB] = useState(/** @type {string} */ (''));
  const [signedUrl, setSignedUrl] = useState(/** @type {string | null} */ (null));
  const [signedUrlB, setSignedUrlB] = useState(/** @type {string | null} */ (null));
  const [urlError, setUrlError] = useState(/** @type {string | null} */ (null));
  const [urlErrorB, setUrlErrorB] = useState(/** @type {string | null} */ (null));
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlLoadingB, setUrlLoadingB] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(/** @type {string | null} */ (null));
  const [compareMenuOpen, setCompareMenuOpen] = useState(false);
  const compareBelowRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  /** Last path we successfully requested a signed URL for (avoids clearing URL on spurious effect re-runs, e.g. tab focus). */
  const signedUrlPathRef = useRef(/** @type {string} */ (''));
  const signedUrlRef = useRef(/** @type {string | null} */ (null));
  const signedUrlPathBRef = useRef(/** @type {string} */ (''));
  const signedUrlBRef = useRef(/** @type {string | null} */ (null));

  const ready = remote && !authInitializing && user;
  const userId = user?.id ?? null;

  signedUrlRef.current = signedUrl;
  signedUrlBRef.current = signedUrlB;

  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    setListError(null);
    setListLoading(true);
    listUserNoteAudioFiles(user.id)
      .then((rows) => {
        if (cancelled) return;
        setMp3List(filterMp3Rows(rows));
      })
      .catch((e) => {
        if (cancelled) return;
        setListError(e instanceof Error ? e.message : 'Could not load your audio files.');
        setMp3List([]);
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, user]);

  useEffect(() => {
    if (!remote || !userId || !selectedPath) {
      signedUrlPathRef.current = '';
      setSignedUrl(null);
      setUrlError(null);
      setUrlLoading(false);
      return;
    }
    const pathChanged = signedUrlPathRef.current !== selectedPath;
    if (pathChanged) {
      signedUrlPathRef.current = selectedPath;
      setSignedUrl(null);
      setUrlError(null);
    } else if (signedUrlRef.current) {
      setUrlLoading(false);
      return;
    }

    let cancelled = false;
    setUrlLoading(true);
    void createNoteAudioSignedUrl(selectedPath).then((r) => {
      if (cancelled) return;
      setUrlLoading(false);
      if (r.url) {
        setSignedUrl(r.url);
        return;
      }
      setSignedUrl(null);
      setUrlError(r.error ?? 'Could not open this file. Try again or pick another track.');
    });
    return () => {
      cancelled = true;
    };
  }, [remote, userId, selectedPath]);

  useEffect(() => {
    if (!selectedPath) {
      setSelectedPathB('');
    }
  }, [selectedPath]);

  useEffect(() => {
    if (selectedPathB && selectedPathB === selectedPath) {
      setSelectedPathB('');
    }
  }, [selectedPath, selectedPathB]);

  useEffect(() => {
    if (!remote || !userId || !selectedPathB) {
      signedUrlPathBRef.current = '';
      setSignedUrlB(null);
      setUrlErrorB(null);
      setUrlLoadingB(false);
      return;
    }
    const pathChanged = signedUrlPathBRef.current !== selectedPathB;
    if (pathChanged) {
      signedUrlPathBRef.current = selectedPathB;
      setSignedUrlB(null);
      setUrlErrorB(null);
    } else if (signedUrlBRef.current) {
      setUrlLoadingB(false);
      return;
    }

    let cancelled = false;
    setUrlLoadingB(true);
    void createNoteAudioSignedUrl(selectedPathB).then((r) => {
      if (cancelled) return;
      setUrlLoadingB(false);
      if (r.url) {
        setSignedUrlB(r.url);
        return;
      }
      setSignedUrlB(null);
      setUrlErrorB(r.error ?? 'Could not open this file. Try again or pick another track.');
    });
    return () => {
      cancelled = true;
    };
  }, [remote, userId, selectedPathB]);

  useEffect(() => {
    if (!compareMenuOpen) return;
    const onDoc = (e) => {
      if (compareBelowRef.current && !compareBelowRef.current.contains(/** @type {Node} */ (e.target))) {
        setCompareMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setCompareMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [compareMenuOpen]);

  useEffect(() => {
    setCompareMenuOpen(false);
  }, [selectedPath]);

  const selectedRow = mp3List.find((r) => r.path === selectedPath) ?? null;
  const selectedRowB = mp3List.find((r) => r.path === selectedPathB) ?? null;
  const displayLabel = selectedRow?.displayName?.trim() || selectedRow?.fileName || '';
  const displayLabelB = selectedRowB?.displayName?.trim() || selectedRowB?.fileName || '';
  const compareOptions = selectedPath
    ? mp3List.filter((r) => r.path !== selectedPath)
    : mp3List;

  const onDismissPrimaryWaveform = useCallback(() => {
    setCompareMenuOpen(false);
    if (selectedPathB) {
      setSelectedPath(selectedPathB);
      setSelectedPathB('');
      return;
    }
    setSelectedPath('');
  }, [selectedPathB]);

  const onDismissCompareWaveform = useCallback(() => {
    setCompareMenuOpen(false);
    setSelectedPathB('');
  }, []);

  const onUploadFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !user) return;
      setUploadError(null);
      const check = validateAnalysisMp3File(file);
      if (!check.ok) {
        setUploadError(check.message ?? 'Invalid file.');
        return;
      }
      setUploading(true);
      try {
        const uploaded = await uploadNoteAudioFile(user.id, ANALYSIS_AUDIO_SCOPE, file);
        const rec = await upsertNoteAudioDisplayName(user.id, uploaded.path, uploaded.fileName);
        if (!rec.ok) console.error('[analysis-audio] display name', rec.error);
        setMp3List((prev) => {
          const row = {
            path: uploaded.path,
            fileName: uploaded.fileName,
            sizeBytes: uploaded.sizeBytes,
            mimeType: uploaded.mimeType,
            updatedAt: new Date().toISOString(),
            displayName: uploaded.fileName,
          };
          return [row, ...prev.filter((p) => p.path !== uploaded.path)];
        });
        setSelectedPath(uploaded.path);
      } catch (err) {
        const { reason } = describeNoteAudioUploadFailure(err, {
          fileName: file.name,
          fileSizeBytes: file.size,
          maxBytes: NOTE_AUDIO_MAX_UPLOAD_BYTES,
        });
        setUploadError(reason);
      } finally {
        setUploading(false);
      }
    },
    [user]
  );

  const gate = !remote ? (
    <p className={styles.gate}>
      Analysis needs cloud storage. Run the app in production mode with Supabase configured, or use audio tools from a note
      in the editor.
    </p>
  ) : authInitializing ? (
    <p className={styles.gate}>Loading…</p>
  ) : !user ? (
    <p className={styles.gate}>
      <Link to="/login">Log in</Link> to list and upload .mp3 files from your private audio library.
    </p>
  ) : null;

  if (gate) {
    return (
      <PageContentWrap>
        <article className={styles.page}>
          <div className={styles.headerRow}>
            <h1 className={styles.title}>Analysis</h1>
            <span className={styles.badge} title="This area may change">
              Beta
            </span>
          </div>
          <p className={styles.subtitle}>Waveform view for your uploaded recordings.</p>
          {gate}
        </article>
      </PageContentWrap>
    );
  }

  if (ready && !isAnalysisDesktop) {
    return (
      <PageContentWrap>
        <article className={styles.page}>
          <div className={styles.mobileOnly}>
            <p className={styles.mobileOnlyMessage}>
              This feature is designed for desktop only. Please move to a larger device to use.
            </p>
          </div>
        </article>
      </PageContentWrap>
    );
  }

  return (
    <>
      <PageContentWrap>
        <article className={styles.page}>
          <input
            id={uploadId}
            ref={fileInputRef}
            type="file"
            accept=".mp3,audio/mpeg"
            className={styles.hiddenFileInput}
            aria-label="Upload a new MP3 from your device"
            tabIndex={-1}
            onChange={(ev) => void onUploadFile(ev)}
          />
          <div className={styles.heroBlock}>
            <div className={styles.headerRow}>
              <h1 className={styles.title}>Analysis</h1>
              <span className={styles.badge} title="This area may change">
                Beta
              </span>
            </div>
            <p className={styles.lead}>
              Experimental: inspect the full waveform of an .mp3 from your note audio library
            </p>
          </div>
        </article>
      </PageContentWrap>
      <section className={styles.waveformSection} aria-label="Playback and waveform">
        <div className={styles.playbackColumn}>
          {urlError ? <p className={styles.errorPlay}>{urlError}</p> : null}
          {!urlError ? (
            <>
              <div className={styles.waveformFrame} aria-label="Primary audio: waveform and player">
                <div className={styles.waveformBleed}>
                  <AnalysisWaveform
                    key={selectedPath ? `wave-${selectedPath}` : 'none'}
                    audioUrl={signedUrl}
                    storagePath={selectedPath || null}
                    fileLabel={displayLabel || 'Selected track'}
                    sizeBytes={selectedRow?.sizeBytes ?? null}
                    resolving={Boolean(selectedPath) && urlLoading && !signedUrl}
                    variant="wide"
                    headerFileOptions={mp3List.length > 0 ? mp3List.map(toPickerOption) : undefined}
                    headerFileValue={selectedPath}
                    onHeaderFileChange={setSelectedPath}
                    headerFileSelectId={waveformHeaderSelectId}
                    onHeaderDismiss={onDismissPrimaryWaveform}
                    headerDismissAriaLabel={
                      selectedPathB
                        ? 'Close this track and make the compare track the main waveform'
                        : 'Close waveform and return to the default view'
                    }
                    emptyStateContent={
                      <div
                        className={styles.waveformEmptySourceCard}
                        role="group"
                        aria-label="Choose primary MP3 and upload"
                      >
                        <div className={styles.sourceCard}>
                          <PrimarySourceCardInner
                            listLoading={listLoading}
                            listError={listError}
                            mp3List={mp3List}
                            selectedPath={selectedPath}
                            setSelectedPath={setSelectedPath}
                            fileInputRef={fileInputRef}
                            uploadId={uploadId}
                            onUploadFile={onUploadFile}
                            uploading={uploading}
                            uploadError={uploadError}
                            selectId={selectIdEmpty}
                            selectIdB={selectIdB}
                            compareOptions={compareOptions}
                            selectedPathB={selectedPathB}
                            setSelectedPathB={setSelectedPathB}
                            emptyOptionLabel="Choose an .mp3 to load the waveform…"
                            includeFileInput={false}
                            includeCompare={false}
                          />
                        </div>
                      </div>
                    }
                  />
                </div>
              </div>
              {signedUrl && selectedPath && !selectedPathB ? (
                <div className={styles.compareBelowRow} ref={compareBelowRef}>
                  <div className={styles.compareBelowInner}>
                    <button
                      type="button"
                      className={styles.fileBtn}
                      disabled={compareOptions.length === 0}
                      title={
                        compareOptions.length > 0
                          ? 'Choose a second track to show below this waveform'
                          : 'Add another .mp3 to your library to compare two tracks'
                      }
                      aria-expanded={compareMenuOpen}
                      onClick={() => {
                        if (compareOptions.length === 0) return;
                        setCompareMenuOpen((o) => !o);
                      }}
                    >
                      Compare
                    </button>
                    {compareMenuOpen && compareOptions.length > 0 ? (
                      <div
                        className={styles.compareBelowPopover}
                        role="dialog"
                        aria-label="Compare with another track"
                      >
                        <label className={styles.compareBelowLabel} htmlFor={waveformCompareSelectId}>
                          Second track
                        </label>
                        <select
                          id={waveformCompareSelectId}
                          className={styles.compareBelowSelect}
                          value={selectedPathB}
                          onChange={(e) => {
                            setSelectedPathB(e.target.value);
                            setCompareMenuOpen(false);
                          }}
                        >
                          <option value="">— None —</option>
                          {compareOptions.map((row) => (
                            <option key={row.path} value={row.path}>
                              {row.displayName || row.fileName}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {selectedPathB ? (
            <div
              className={styles.compareWaveWrap}
              aria-label="Compare: second audio waveform and player"
            >
              {urlErrorB ? (
                <div className={styles.waveformFrame}>
                  {displayLabelB ? <p className={styles.waveformCompareErrorName}>{displayLabelB}</p> : null}
                  <p className={styles.waveformBlockError}>{urlErrorB}</p>
                </div>
              ) : (
                <div className={styles.waveformFrame}>
                  <div className={styles.waveformBleed}>
                    <AnalysisWaveform
                      key={selectedPathB ? `wave-b-${selectedPathB}` : 'none-b'}
                      audioUrl={signedUrlB}
                      storagePath={selectedPathB || null}
                      fileLabel={displayLabelB || 'Compare track'}
                      sizeBytes={selectedRowB?.sizeBytes ?? null}
                      resolving={Boolean(selectedPathB) && urlLoadingB && !signedUrlB}
                      variant="wide"
                      headerFileOptions={
                        compareOptions.length > 0 ? compareOptions.map(toPickerOption) : undefined
                      }
                      headerFileValue={selectedPathB}
                      onHeaderFileChange={setSelectedPathB}
                      headerFileSelectId={compareWaveformHeaderSelectId}
                      onHeaderDismiss={onDismissCompareWaveform}
                      headerDismissAriaLabel="Remove compare track"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
