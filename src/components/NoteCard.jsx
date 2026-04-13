import { Link } from 'react-router-dom';
import { htmlToPlain } from '../utils/noteBodyPlain.js';
import styles from '../styles/NoteCard.module.css';

/** @param {{ note: { id: string, title: string, bodyHtml: string } }} props */
export default function NoteCard({ note }) {
  const preview = htmlToPlain(note.bodyHtml).replace(/\s+/g, ' ').trim();

  return (
    <Link to={`/notes/${note.id}`} className={styles.card}>
      <h2 className={styles.title}>{note.title || 'Untitled'}</h2>
      <p className={styles.preview}>{preview || 'No content'}</p>
      <span className={styles.readMore}>Read more</span>
    </Link>
  );
}
