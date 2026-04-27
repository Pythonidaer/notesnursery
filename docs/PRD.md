# Product requirements document — Note detail UX and related UI

This document tracks **progress** on the note detail / rich-editor experience and **queued work** for upcoming sessions, including small UI fixes and theme (light/dark) follow-ups.

---

## Feature summary — Note detail page & editor chrome

The note detail surface (`NoteDetailPage`, route `/notes/:noteId`) exercises a mobile-oriented rich editor: title + body, floating audio chrome, grammar tooling, attach flows, and read/edit parity. Work has focused on making **read and edit** feel like one product: consistent spacing, controls that match other note chrome (e.g. audio row), and fewer duplicated or misaligned affordances.

---

## Progress (completed or largely settled)

- **Title + info control (read vs edit)**  
  - Read mode: `titleRow` uses a single flex gap (`0.35rem`) between the heading and the info button; info hit target aligned with audio gear (`2.45rem` circle, SVG sizing).  
  - Edit mode: **structure aligned with read** — title uses the same `titleTextSlot` flex rules as the read `h1` (edit wraps an `input` in `titleTextSlotEditable`); info button is a **direct sibling** under the same `titleRow`.  
  - Edit title width is synced from a hidden measure span (avoids `field-sizing` under-measure); long titles use flex + horizontal scroll on the input instead of clipping.  
  - Residual risk: tiny span-vs-input metric differences are covered with minimal pixel slack; re-verify on target browsers if overlap or excess gap reappears.

- **Toolbar / attach**  
  - Duplicate OCR/paperclip patterns reduced where an attach sheet exists; breakpoints adjusted so desktop can use the portaled bottom toolbar where intended.

- **Grammar / POS**  
  - Viewport resize handling improved so POS overlay and grammar UI stay coherent under zoom and mobile viewport changes.

- **Bottom chrome**  
  - Grammar pill + FAB alignment and padding iterated for mobile; further desktop-specific tweaks remain (see TODOs).

---

## TODO — Next session UI fixes

These are **scoped UI follow-ups** on the current note detail / editor work:

1. **Standardize read and edit title + info icon distance**  
   - Confirm visually across breakpoints and zoom that read and edit match (single `titleRow` gap, no drift from input metrics or min-width rules).  
   - Adjust slack, `min-width` placeholders, or typography if any environment still shows mismatch.

2. **Grammar pill — left padding on desktop**  
   - Add or tune **left-side padding** for the grammar pill on **desktop** so it aligns with the rest of the bottom chrome and doesn’t hug the viewport edge.

3. **“Note saved” feedback placement**  
   - Move the **note saved** test / toast so it is **centered above the metadata** (or the agreed meta block), instead of the current position, for clearer hierarchy and less collision with other chrome.

---

## Shipped — light / dark mode (site-wide)

**Behavior:** Appearance is **Light** or **Dark**, chosen from the **hamburger menu** (`AppHeaderNav`). It applies via `html[data-theme]` and shared CSS variables in `src/index.css` (including `data-notes-canvas` on `document.documentElement` for portaled UI). **Local mode** persists in `localStorage` (`notesNursery_colorScheme`). **Production** also stores `profiles.color_scheme` in Supabase (`light` \| `dark`, nullable); on first load with no local key, the client loads the profile value after `profilePreferencesLoaded`.

**Anti-flicker:** An inline script in `index.html` runs before the app bundle and sets `data-theme` / `data-notes-canvas` / `color-scheme` from `localStorage`, with one-time migration from legacy `notesNursery_notesTestUseDarkBg`.

**Implementation notes:** `ThemeProvider` (`src/context/ThemeContext.jsx`) wraps the app inside `AuthProvider`. Note detail **does not** use a separate ellipsis “Use Dark Background” toggle; the shell follows the global theme (`useTheme` + `.shellDark` for read/editor remaps).

**Follow-up:** Continue migrating any remaining module CSS hex values to tokens; full contrast/accessibility pass on uncommon states.

### After theme work (still queued)

- **Cleanup on note detail**  
  - Continue **UI cleanup** on `NoteDetailPage` (former notes-test layout, now default at `/notes/:noteId`).

---

## Document maintenance

Update this PRD when a TODO ships or when theme decisions (schema field names, token strategy) are finalized so future sessions start from a single source of truth.
