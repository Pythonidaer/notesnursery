import { Link, useLocation } from 'react-router-dom';
import { htmlToPlain } from '../utils/noteBodyPlain.js';
import ComedyRatingTrigger from './ComedyRatingTrigger.jsx';
import styles from '../styles/NoteCard.module.css';

/** @param {{ note: { id: string, title: string, bodyHtml: string, comedyRating?: number | null, labels?: string[] } }} props */
export default function NoteCard({ note }) {
  const location = useLocation();
  const fromState = { from: `${location.pathname}${location.search}` };
  const preview = htmlToPlain(note.bodyHtml).replace(/\s+/g, ' ').trim();

  return (
    <article className={styles.card}>
      <Link to={`/notes/${note.id}`} state={fromState} className={styles.cardMain}>
        <h2 className={styles.title}>{note.title || 'Untitled'}</h2>
        <p className={styles.preview}>{preview || 'No content'}</p>
      </Link>
      <div className={styles.cardFooter}>
        <Link to={`/notes/${note.id}`} state={fromState} className={styles.readMore}>
          Read more
        </Link>
        <ComedyRatingTrigger note={note} variant="card" />
      </div>
    </article>
  );
}
