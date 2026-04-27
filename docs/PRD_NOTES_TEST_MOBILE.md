# PRD: Mobile-first note detail

**Status:** Shipped as default note view  
**Primary route:** `/notes/:noteId` (legacy `/notes-test` and `/notes-test/:id` redirect to Library or `/notes/:id`)  
**Last updated:** 2026-04-27  

---

## 1. Summary

The **mobile-first note reading and editing experience** is the default **note detail** flow. Implementation lives in [`src/pages/NoteDetailPage.jsx`](../src/pages/NoteDetailPage.jsx) and [`NoteDetailPage.module.css`](../src/pages/NoteDetailPage.module.css) (formerly the notes-test page).

The global app chrome behaves differently on note detail: the **main app header is hidden**, and the page uses a **dedicated top bar** (back, optional nav menu, save when editing, more menu) plus a **scrollable note column** tuned for small viewports.

---

## 2. Goals

1. **Reading:** Title, audio (when present), and body are the default focal content. Secondary metadata (date line, labels, comedy rating) is **de-emphasized** and **revealed by scrolling up** (“pull” meta from behind the top band), not stacked above the title on first paint.
2. **Consistency:** The **overlap height** under the top bar (safe area + bar) must match **measured layout** (including subpixel heights, e.g. ~56.2px on phone) so the first frame does not clip the title or land “a few lines into” the body after refresh or when switching notes.
3. **Editing:** Tap-to-edit style flow with **mobile toolbar** variant, floating audio in edit mode, save/discard, and parity with core note operations where reasonable.
4. **Polish:** Optional **dark canvas** for the note surface; labels and actions reachable from **ellipsis** and drill sheets without crowding the main column.
5. **Legacy URLs:** Old `/notes-test` bookmarks redirect so shared links keep working.

---

## 3. Non-goals (for this PRD)

- Replacing the library/cards primary navigation (out of scope until promotion).
- Perfect SEO for note URLs (standard app surface).
- Feature parity with every desktop-only affordance in one pass.

---

## 4. User-facing behavior

### 4.1 Entry points

- **Detail:** `/notes/<noteId>` — full note experience (Library/Cards/search link here; in production with Supabase, unauthenticated users are sent to login when persistence is required).
- **Legacy:** `/notes-test` → `/library`; `/notes-test/<noteId>` → `/notes/<noteId>`.

### 4.2 Layout and scroll model

- **Shell:** Fills the viewport (`appShell--noteDetail` / `appMain--noteDetail` in `App.jsx` + `index.css`) so the **scroll container is the note column**, not the window.
- **Top bar:** Fixed visual hierarchy (`z-index`), height **H** measured at runtime from the bar’s `getBoundingClientRect().height` and exposed as a CSS variable on the page shell where used for overlap math.
- **Scroll region (`.scrollMain`):** Negative `margin-top` of **H** pulls content **up under** the top bar; inner wrapper (`.scrollInner`) uses **`padding-top: H`** so that at **`scrollTop === 0`** the **meta band** occupies the region **behind** the bar.
- **Meta block (`.metaReveal`):** Date, label chips, comedy rating. `min-height` is at least **H** so the reveal band is stable as content grows.
- **Initial scroll (“snap below meta”):** After layout sync, set `scrollTop = 0`, force layout, then set `scrollTop` from **geometry**: difference between the **read surface** (or edit block) top and the **scrollport** top. This avoids fragile `offsetTop + padding` arithmetic that caused incorrect initial scroll when switching notes or refreshing.

### 4.3 Reading vs editing

- **Read:** `NoteBodyContent` for HTML/Markdown; title and body in a **`readSurface`** anchor used for scroll snapping.
- **Edit:** `NoteRichTextEditor` with **`toolbarVariant="mobileNotes"`**, title field, floating audio provider/dock; **`editBlock`** used as scroll anchor when editing.

### 4.4 Dark canvas

- **Global appearance** (hamburger menu: Light / Dark) drives the note shell; legacy `localStorage` key `notesNursery_notesTestUseDarkBg` is migrated once to `notesNursery_colorScheme` by the inline boot script in `index.html`.
- When the app theme is dark, `.shellDark` applies read HTML/Markdown roots via **`data-nn-read-body-root`** styling; common inline “black ink” spans/fonts are remapped for readability on dark.

### 4.5 Menus and secondary actions

- **More (⋯):** Note info, transfer, POS tools, attach/delete, etc. (appearance: hamburger menu.)
- **Labels:** Drill sheet with search; chip remove on the meta row where applicable.
- **Errors:** `actionError` may render **between** the top bar and the scroll main (affects perceived “chrome” height; see open issues).

---

## 5. Technical touchpoints (for engineers)

| Area | Location |
|------|----------|
| Routes, shell classes | `src/App.jsx` |
| Viewport / main flush | `src/index.css` |
| Page logic, scroll sync, menus | `src/pages/NoteDetailPage.jsx` |
| Layout / dark canvas CSS | `src/pages/NoteDetailPage.module.css` |
| Auth gate on detail | `NoteDetailPage.jsx` → `Navigate` to `/login` when remote backend and no user |

---

## 6. Current progress (completed or largely working)

- [x] Default `/notes/:noteId` detail route; legacy `/notes-test` redirects.
- [x] Hide global header on detail path; dedicated top bar + pinned viewport shell.
- [x] Meta band behind measured top bar height; subpixel-accurate overlap (no premature `ceil` of bar height).
- [x] **Geometry-based** initial scroll snap (`getBoundingClientRect` delta) plus **ResizeObserver** on meta, scrollport, bar, and anchor; delayed re-snap (~120ms) and resize handler for late layout.
- [x] **Minimum inner height** so short notes can still scroll enough to reveal meta.
- [x] Mobile editor toolbar variant, tap-edit flow, save, delete modal, transfer, note info, comedy rating on meta row.
- [x] Labels drill sheet; global dark/light theme with read-body token alignment and inline color remapping.
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
