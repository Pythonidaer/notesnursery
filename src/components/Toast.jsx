import { useEffect } from 'react';
import styles from './Toast.module.css';

/**
 * Lightweight auto-dismiss toast (fixed position).
 * @param {{ message: string | null, onDismiss: () => void }} props
 */
export default function Toast({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = window.setTimeout(() => onDismiss(), 3200);
    return () => window.clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  );
}
