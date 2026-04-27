# PRD: Mobile-first note detail (“Notes test”)

**Status:** In development (dogfood / preview)  
**Primary routes:** `/notes-test` (hub), `/notes-test/:noteId` (detail)  
**Last updated:** 2026-04-26  

---

## 1. Summary

We are building a **mobile-first note reading and editing experience** that will eventually replace or augment the current note detail flow. The work ships behind the **`/notes-test`** URLs so we can **test on real devices**, iterate on scroll and chrome, and gather feedback before promoting it to the default note view.

The global app chrome behaves differently on note detail: the **main app header is hidden**, and the page uses a **dedicated top bar** (back, optional nav menu, save when editing, more menu) plus a **scrollable note column** tuned for small viewports.

---

## 2. Goals

1. **Reading:** Title, audio (when present), and body are the default focal content. Secondary metadata (date line, labels, comedy rating) is **de-emphasized** and **revealed by scrolling up** (“pull” meta from behind the top band), not stacked above the title on first paint.
2. **Consistency:** The **overlap height** under the top bar (safe area + bar) must match **measured layout** (including subpixel heights, e.g. ~56.2px on phone) so the first frame does not clip the title or land “a few lines into” the body after refresh or when switching notes.
3. **Editing:** Tap-to-edit style flow with **mobile toolbar** variant, floating audio in edit mode, save/discard, and parity with core note operations where reasonable.
4. **Polish:** Optional **dark canvas** for the note surface; labels and actions reachable from **ellipsis** and drill sheets without crowding the main column.
5. **Safe rollout:** Route remains **reachable by URL** (and optional nav link) for **production dogfooding** until we merge into the primary note route or gate behind a feature flag.

---

## 3. Non-goals (for this PRD)

- Replacing the library/cards primary navigation (out of scope until promotion).
- Perfect SEO or public discoverability of `/notes-test` (preview route).
- Feature parity with every desktop-only affordance in one pass.

---

## 4. User-facing behavior

### 4.1 Entry points

- **Hub:** `/notes-test` — short explanation and links to Library / Cards.
- **Detail:** `/notes-test/<noteId>` — full note experience (after user is authenticated when using Supabase).
- **App menu:** Link to `/notes-test` exists in the header nav menu (`AppHeaderNav`) for convenience during development.

### 4.2 Layout and scroll model

- **Shell:** Fills the viewport (`appShell--notesTestDetail` / `appMain--notesTestDetail` in `App.jsx` + `index.css`) so the **scroll container is the note column**, not the window.
- **Top bar:** Fixed visual hierarchy (`z-index`), height **H** measured at runtime from the bar’s `getBoundingClientRect().height` and exposed as CSS variable **`--notesTestTopBarOverlap`** on the page shell.
- **Scroll region (`.scrollMain`):** Negative `margin-top` of **H** pulls content **up under** the top bar; inner wrapper (`.scrollInner`) uses **`padding-top: H`** so that at **`scrollTop === 0`** the **meta band** occupies the region **behind** the bar.
- **Meta block (`.metaReveal`):** Date, label chips, comedy rating. `min-height` is at least **H** so the reveal band is stable as content grows.
- **Initial scroll (“snap below meta”):** After layout sync, set `scrollTop = 0`, force layout, then set `scrollTop` from **geometry**: difference between the **read surface** (or edit block) top and the **scrollport** top. This avoids fragile `offsetTop + padding` arithmetic that caused incorrect initial scroll when switching notes or refreshing.

### 4.3 Reading vs editing

- **Read:** `NoteBodyContent` for HTML/Markdown; title and body in a **`readSurface`** anchor used for scroll snapping.
- **Edit:** `NoteRichTextEditor` with **`toolbarVariant="mobileNotes"`**, title field, floating audio provider/dock; **`editBlock`** used as scroll anchor when editing.

### 4.4 Dark canvas

- Toggle via ellipsis menu: **“Use Dark Background”** (persisted in `localStorage` under `notesNursery_notesTestUseDarkBg`).
- Shell tokens override background/surface/text; read HTML/Markdown roots follow **`data-nn-read-body-root`** styling; common inline “black ink” spans/fonts are remapped for readability on dark.

### 4.5 Menus and secondary actions

- **More (⋯):** Note info, transfer, POS tools, theme (light/dark canvas), delete, etc.
- **Labels:** Drill sheet with search; chip remove on the meta row where applicable.
- **Errors:** `actionError` may render **between** the top bar and the scroll main (affects perceived “chrome” height; see open issues).

---

## 5. Technical touchpoints (for engineers)

| Area | Location |
|------|----------|
| Routes, shell classes | `src/App.jsx` |
| Viewport / main flush | `src/index.css` |
| Page logic, scroll sync, menus | `src/pages/NotesTestPage.jsx` |
| Layout / dark canvas CSS | `src/pages/NotesTestPage.module.css` |
| Nav link to hub | `src/components/AppHeaderNav.jsx` |
| Auth gate on detail | `NotesTestPage.jsx` → `Navigate` to `/login` when remote backend and no user |

---

## 6. Current progress (completed or largely working)

- [x] `/notes-test` hub and `/notes-test/:noteId` detail routes.
- [x] Hide global header on detail path; dedicated top bar + pinned viewport shell.
- [x] Meta band behind measured top bar height; **subpixel-accurate** `--notesTestTopBarOverlap` (no premature `ceil` of bar height).
- [x] **Geometry-based** initial scroll snap (`getBoundingClientRect` delta) plus **ResizeObserver** on meta, scrollport, bar, and anchor; delayed re-snap (~120ms) and resize handler for late layout.
- [x] **Minimum inner height** so short notes can still scroll enough to reveal meta.
- [x] Mobile editor toolbar variant, tap-edit flow, save, delete modal, transfer, note info, comedy rating on meta row.
- [x] Labels drill sheet; dark canvas toggle with read-body token alignment and inline color remapping.
- [x] Auth: unauthenticated users with remote backend redirected to login.

---

## 7. Open issues and risks

These items are **not fully verified** or are **known fragile**; they should drive the next planning pass.

1. **Initial scroll on real devices**  
   After refresh or **navigating between note IDs**, confirm the viewport **consistently** shows the **title at the top of the reading area** with meta hidden above (scroll-up reveal only). If mis-scroll returns, suspects include: late **font loading** (`document.fonts.ready`), async body hydration, or **content height changes** after first paint.

2. **`actionError` and layout**  
   An error banner between the header and `.scrollMain` **does not inflate** the measured top bar height **H**. That can introduce a **vertical offset** between “visual chrome” and the overlap math until errors are cleared.

3. **Strict mode / double effects**  
   React 18 Strict Mode can double-invoke effects in development; production behavior should still be validated separately.

4. **Production exposure**  
   The route is **intentionally reachable** for dogfooding. It is **not** a security boundary: rely on normal **auth** for data access. Optional follow-up: **env-gated route** (e.g. build-time flag) if we need to disable the UI in production without removing code.

5. **Promotion path**  
   Decide whether this shell **replaces** the current note page, lives behind a **feature flag**, or merges incrementally (header/scroll only, then editor, etc.).

6. **Accessibility & motion**  
   Scroll snap and reveal behavior should be reviewed for **reduced motion**, screen reader order, and focus management in sheets/menus (not fully audited in this doc).

---

## 8. Success criteria (exit “preview”)

- Initial scroll and meta reveal are **stable** across: iOS Safari, Chrome Android, refresh, and **note-to-note** navigation.
- No systematic clipping of title/audio on first paint for typical notes (short and long body, with and without labels).
- Product decision on **default route** and **feature flag** documented; tech debt (e.g. `actionError` vs **H**) resolved or accepted explicitly.

---

## 9. Related documentation

_Add links here as the feature stabilizes (e.g. design specs, QA checklist)._
