import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './AppHeaderNav.module.css';

export default function AppHeaderNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const remote = useSupabaseBackend();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    close();
  }, [location.pathname, close]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!containerRef.current?.contains(/** @type {Node} */ (e.target))) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    if (remote) {
      navigate('/login', { replace: true });
    } else {
      navigate('/library', { replace: true });
    }
  };

  const toggle = () => setOpen((v) => !v);

  const navLinks = (
    <>
      <li className={styles.menuItem}>
        <Link to="/import" className={styles.menuLink} onClick={close}>
          Import
        </Link>
      </li>
      <li className={styles.menuItem}>
        <Link to="/library" className={styles.menuLink} onClick={close}>
          Library
        </Link>
      </li>
      <li className={styles.menuItem}>
        <Link to="/cards" className={styles.menuLink} onClick={close}>
          Cards
        </Link>
      </li>
      <li className={styles.menuItem}>
        <Link to="/instructions" className={styles.menuLink} onClick={close}>
          Instructions
        </Link>
      </li>
    </>
  );

  return (
    <div className={styles.root} ref={containerRef}>
      <button
        type="button"
        className={styles.menuTrigger}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="true"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={toggle}
      >
        <span className={styles.hamburger} aria-hidden />
      </button>

      <nav id={menuId} className={styles.menuPanel} hidden={!open} aria-label="Site">
        <ul className={styles.menuList}>
          {navLinks}

          {!remote ? (
            <>
              <li className={styles.menuDivider} role="separator" />
              <li className={styles.menuMeta}>Local mode — notes are not saved to the cloud.</li>
            </>
          ) : null}

          {remote && user ? (
            <>
              <li className={styles.menuDivider} role="separator" />
              {user.email ? (
                <li className={styles.menuMeta} title={user.email}>
                  {user.email}
                </li>
              ) : null}
              <li className={styles.menuItem}>
                <button type="button" className={styles.menuButton} onClick={() => void handleSignOut()}>
                  Sign out
                </button>
              </li>
            </>
          ) : null}

          {remote && !user ? (
            <>
              <li className={styles.menuDivider} role="separator" />
              <li className={styles.menuItem}>
                <Link to="/login" className={styles.menuLink} onClick={close}>
                  Log in
                </Link>
              </li>
              <li className={styles.menuItem}>
                <Link to="/signup" className={styles.menuLink} onClick={close}>
                  Sign up
                </Link>
              </li>
            </>
          ) : null}
        </ul>
      </nav>
    </div>
  );
}
