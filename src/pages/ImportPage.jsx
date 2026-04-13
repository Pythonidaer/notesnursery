import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requiresAuthForPersistence } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotes } from '../context/NotesContext.jsx';
import { parseAppleNoteMarkdown } from '../utils/parseAppleNoteMarkdown.js';
import styles from './ImportPage.module.css';

export default function ImportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotes } = useNotes();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const processFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList).filter((f) =>
        f.name.toLowerCase().endsWith('.md')
      );
      if (files.length === 0) {
        setError('Please choose one or more .md files.');
        return;
      }
      if (requiresAuthForPersistence() && !user) {
        navigate('/login');
        return;
      }
      setError(null);
      setBusy(true);
      console.log('[import] start', { fileCount: files.length });
      try {
        const parsed = [];
        for (const file of files) {
          const text = await file.text();
          parsed.push(parseAppleNoteMarkdown(file.name, text));
        }
        console.log('[import] parsed', { noteCount: parsed.length });
        await addNotes(parsed);
        console.log('[import] addNotes complete');
        navigate('/library');
      } catch (e) {
        console.error('[import] failed', e);
        setError(e instanceof Error ? e.message : 'Could not read files.');
      } finally {
        setBusy(false);
        console.log('[import] loading state off');
      }
    },
    [addNotes, navigate, user]
  );

  const onInputChange = (e) => {
    const list = e.target.files;
    if (list?.length) processFiles(list);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  return (
    <div className={styles.wrap}>
      <h1 className={styles.heading}>Import notes</h1>
      <p className={styles.lead}>Drop markdown files here, or use the file picker.</p>

      <div
        className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        role="presentation"
      >
        {busy ? (
          <div className={styles.busyWrap}>
            <span className={styles.spinner} aria-label="Importing" />
            <p className={styles.dropHint}>Importing notes…</p>
          </div>
        ) : (
          <p className={styles.dropHint}>Drop .md files here</p>
        )}
        <button
          type="button"
          className={styles.pickBtn}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".md,text/markdown"
          multiple
          className={styles.hiddenInput}
          onChange={onInputChange}
        />
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
