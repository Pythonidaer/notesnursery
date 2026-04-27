# Product requirements document — Notes test UX and related UI

This document tracks **progress** on the Notes test / rich-editor experience and **queued work** for upcoming sessions, including small UI fixes and a broader theme (light/dark) initiative.

---

## Feature summary — Notes test page & editor chrome

The Notes test surface (`NotesTestPage`) exercises a mobile-oriented rich editor: title + body, floating audio chrome, grammar tooling, attach flows, and read/edit parity. Work has focused on making **read and edit** feel like one product: consistent spacing, controls that match other note chrome (e.g. audio row), and fewer duplicated or misaligned affordances.

---

## Progress (completed or largely settled)

- **Title + info control (read vs edit)**  
  - Read mode: `titleRow` uses a single flex gap (`0.35rem`) between the heading and the info button; info hit target aligned with audio gear (`2.45rem` circle, SVG sizing).  
  - Edit mode: **structure aligned with read** — title lives in `titleEditCluster`; info button is a **direct sibling** under the same `titleRow` so spacing uses the **same row gap**, not a second nested gap.  
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

These are **scoped UI follow-ups** on the current Notes test / editor work:

1. **Standardize read and edit title + info icon distance**  
   - Confirm visually across breakpoints and zoom that read and edit match (single `titleRow` gap, no drift from input metrics or min-width rules).  
   - Adjust slack, `min-width` placeholders, or typography if any environment still shows mismatch.

2. **Grammar pill — left padding on desktop**  
   - Add or tune **left-side padding** for the grammar pill on **desktop** so it aligns with the rest of the bottom chrome and doesn’t hug the viewport edge.

3. **“Note saved” feedback placement**  
   - Move the **note saved** test / toast so it is **centered above the metadata** (or the agreed meta block), instead of the current position, for clearer hierarchy and less collision with other chrome.

---

## TODO — Next major initiative: light / dark mode across the site

**Goal:** One user-controlled appearance (light vs dark) that applies **consistently** across the app, persists per user, and does not regress contrast or accessibility.

### Scope

- **Global theme**  
  - Introduce or extend **dark mode and light mode** so the **entire website** responds predictably when the user switches preference (not only isolated pages).

- **Data model and settings**  
  - **Read the database schema** (Supabase / existing tables) and decide **where to store** `theme` / `color_scheme` (or equivalent) for a user.  
  - Expose the choice as a **setting in the hamburger menu** (load on sign-in, save on change, sensible default).

- **CSS audit before rollout**  
  - **Review CSS across the codebase** and compare patterns to `src/pages/NotesTestPage.module.css` (tokens, `var(--*)`, hard-coded colors, ad hoc dark flags).  
  - Document how dark/light is applied today (e.g. class on `html`/`body`, context, media queries) so new work **centralizes** tokens and avoids one-off fixes.  
  - **Accessibility:** when the setting flips, verify contrast, focus rings, and component states so nothing becomes **inconsistent or inaccessible**.

### After theme work

- **Cleanup and NotesTest integration**  
  - Once light/dark is **reliable site-wide**, continue **UI cleanup** and plan **next steps for NotesTest UI integration** (e.g. promoting patterns into shared components or the main note detail flow) without fighting duplicate theme logic.

---

## Document maintenance

Update this PRD when a TODO ships or when theme decisions (schema field names, token strategy) are finalized so future sessions start from a single source of truth.
