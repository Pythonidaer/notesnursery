import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSupabaseBackend } from '../config/appConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import styles from './AppHeaderNav.module.css';

const PILL_ANCHOR_SEL = '[data-nn-top-nav-pill]';

/**
 * @param {{
 *   menuTriggerClassName?: string,
 *   menuOverlapPill?: boolean,
 *   onOutsideMenuPointerDownCapture?: () => void,
 * }} [props]
 */
export default function AppHeaderNav({
  menuTriggerClassName,
  menuOverlapPill = false,
  onOutsideMenuPointerDownCapture,
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { colorScheme, setColorScheme } = useTheme();
  const remote = useSupabaseBackend();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const triggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const [fixedMenu, setFixedMenu] = useState(/** @type {{ right: number; top: number } | null} */ (null));

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

  /** No dimmed backdrop — outside taps hit the page underneath; arm suppressors (e.g. tap-to-edit) before the event reaches the note. */
  useEffect(() => {
    if (!open || !onOutsideMenuPointerDownCapture) return;
    const onCap = (e) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (containerRef.current?.contains(t)) return;
      onOutsideMenuPointerDownCapture();
    };
    document.addEventListener('pointerdown', onCap, true);
    return () => document.removeEventListener('pointerdown', onCap, true);
  }, [open, onOutsideMenuPointerDownCapture]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !menuOverlapPill) {
      setFixedMenu(null);
      return;
    }
    const update = () => {
      const t = triggerRef.current;
      const pill = t?.closest(PILL_ANCHOR_SEL);
      const anchor = pill instanceof HTMLElement ? pill : t;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      /** Pull the panel slightly up over the pill; anchor from top so content grows downward (avoids clipping when the pill is near the top of the viewport). */
      const overlapPx = 10;
      setFixedMenu({
        right: Math.max(8, window.innerWidth - r.right),
        top: Math.max(8, r.top - overlapPx),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, menuOverlapPill]);

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
        <Link to="/recordings" className={styles.menuLink} onClick={close}>
          Recordings
        </Link>
      </li>
      <li className={styles.menuItem}>
        <Link to="/analysis" className={styles.menuLink} onClick={close}>
          Analysis
        </Link>
      </li>
      <li className={styles.menuItem}>
        <Link to="/instructions" className={styles.menuLink} onClick={close}>
          Instructions
        </Link>
      </li>
      <li className={styles.menuDivider} role="separator" />
      <li className={styles.menuMeta}>Appearance</li>
      <li className={styles.menuItem}>
        <div className={styles.appearanceToggle} role="group" aria-label="Color scheme">
          <button
            type="button"
            className={`${styles.appearanceBtn} ${colorScheme === 'light' ? styles.appearanceBtnActive : ''}`}
            aria-pressed={colorScheme === 'light'}
            onClick={() => void setColorScheme('light')}
          >
            Light
          </button>
          <button
            type="button"
            className={`${styles.appearanceBtn} ${colorScheme === 'dark' ? styles.appearanceBtnActive : ''}`}
            aria-pressed={colorScheme === 'dark'}
            onClick={() => void setColorScheme('dark')}
          >
            Dark
          </button>
        </div>
      </li>
    </>
  );

  const menuStyle =
    menuOverlapPill && open && fixedMenu
      ? {
          position: 'fixed',
          top: fixedMenu.top,
          right: fixedMenu.right,
          bottom: 'auto',
          left: 'auto',
          maxHeight: 'min(70vh, calc(100vh - 1rem))',
          overflowY: 'auto',
        }
      : undefined;

  return (
    <div className={styles.root} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={[styles.menuTrigger, menuTriggerClassName].filter(Boolean).join(' ')}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="true"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={toggle}
      >
        <span className={styles.hamburger} aria-hidden />
      </button>

      <nav
        id={menuId}
        className={[styles.menuPanel, menuOverlapPill && open ? styles.menuPanelFixed : ''].filter(Boolean).join(' ')}
        style={menuStyle}
        hidden={!open}
        aria-label="Site"
      >
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
