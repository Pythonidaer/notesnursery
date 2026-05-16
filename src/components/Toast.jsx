import { useEffect } from 'react';
import styles from './Toast.module.css';

/**
 * Lightweight auto-dismiss toast.
 * @param {{
 *   message: string | null,
 *   onDismiss: () => void,
 *   variant?: 'default' | 'success' | 'headerMinimal',
 * }} props
 */
export default function Toast({ message, onDismiss, variant = 'default' }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = window.setTimeout(() => onDismiss(), 3200);
    return () => window.clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  const className = [
    styles.toast,
    variant === 'headerMinimal' ? styles.toastHeaderMinimal : '',
    variant === 'success' ? styles.toastSuccess : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} role="status" aria-live="polite">
      {message}
    </div>
  );
}
