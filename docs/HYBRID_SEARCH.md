# Hybrid search (planned)

Design notes for a future enhancement to [semantic search](SEMANTIC_SEARCH.md).

**Current state (as of this writing):**

- **Semantic Search** — implemented, production. Uses Supabase PGVector + `gte-small` embeddings via edge function. Retrieval-only (not RAG).
- **Keyword Search** — implemented, production. Client-side match on title, plain-text body, and labels: queries split on whitespace into tokens; **every** token must appear somewhere in the combined searchable text (**AND**). No backend required.
- **Hybrid Search** — planned. Will merge both signals into one ranked result set. **Not yet implemented.**

Both current modes share one search card in the UI (`NoteSemanticSearch.jsx`). The small **Semantic / Keyword** pill toggle switches between them. This separation keeps complexity low and makes each mode independently testable while the hybrid approach is designed.

---

---

## 1. Overview

**Hybrid search** means returning ranked notes using **more than one retrieval signal**, then combining them. In the Notes Nursery context, the goal is to pair:

- **Semantic (vector) similarity** — what the note is *about* in meaning space.
- **Keyword (text) match** — whether the user’s query tokens appear as substrings in the fields we search (today: **AND** across all tokens on combined title/body/labels text).

**Why not semantic alone?** Today’s system embeds a single vector per full note. That is a good tradeoff for small libraries, but it has known limits: proper nouns, book or venue names, and short user queries can be **under-weighted** compared to the overall “theme” of a long note. Adding an explicit text-matching pass addresses **exact-phrase and title** needs without discarding the strength of meaning-based search.

**Goal:** Users should not miss a note that literally contains *“Bell in Hand Tavern”* in the title, while still benefiting from semantic matches when they search with a loose or conceptual query.

---

## 2. Current system (brief)

### Semantic Search

- **Model:** `gte-small` (384-dim) via Supabase Edge Function + Postgres `pgvector`.
- **Storage:** one embedding per note in `note_embeddings` (keyed by `user_id` + `note_id`), with stored `source_text` used to build the embedded plain-text (see [SEMANTIC_SEARCH.md](SEMANTIC_SEARCH.md)).
- **Query path:** `search-notes-semantic` embeds the query, calls `search_my_notes`, returns ranked results by **vector distance / similarity** only.
- **Security:** RLS, `auth.uid()`-scoped RPC; no change to that principle is required for a hybrid design — only how results are *ranked* and *merged*.

### Keyword Search (new)

- **Implementation:** `src/utils/keywordSearch.js` — pure client-side functions, no backend.
- **Fields searched:** `note.title`, plain text from `note.bodyHtml`, and `note.labels`.
- **Matching:** trim, lowercase, split on whitespace into tokens; build one combined searchable string from title + stripped body + labels; each token must satisfy `searchable.includes(token)` (**AND**). Case-insensitive; no stemming.
- **Notes data source:** the same `notes` array already loaded in `NotesContext` (no additional fetch).
- **Intentional separation:** keyword and semantic modes are deliberately kept distinct to reduce complexity and allow independent testing. Hybrid ranking will merge them later.

---

## 3. Problem

- **Proper nouns and venues** (e.g. *Bell in Hand Tavern*) are easy for humans to search literally; a single full-note embedding may emphasize the note’s *general* topic and dilute a rare phrase.
- **Short queries** are weak semantic signals: a few words may not sit close to a long, diverse embedding in vector space.
- **Long notes** create one “average” representation; a specific string buried in the body competes with everything else in that vector.

**Example:** a travel note that mentions *Bell in Hand Tavern* in passing among many other places. A query *“Bell in Hand”* should still surface that note via **string match**, even if the semantic score is not top-ranked.

---

## 4. Proposed solution

Run **two** retrieval paths (both already implemented as separate modes):

1. **Semantic search (implemented):** current vector pipeline, unchanged.
2. **Keyword search (implemented):** client-side tokenized **AND** match on `title`, `bodyHtml` (HTML-stripped), and `labels` via `src/utils/keywordSearch.js` (`tokenizeKeywordQuery` + `searchNotesKeyword`).

The next step is to **merge** results by `note_id`: each note that appears in either result set gets **both** scores (with zeros where absent), then sort by a **combined** score (see [§6](#6-result-merging-strategy)).

The UI already shares one search card; a future `hybrid` mode value in the toggle would activate merged ranking without restructuring the component.

---

## 5. Keyword search approach (current implementation)

The MVP keyword search runs **client-side** in the browser, not in Postgres:

- Source: `notes` array from `NotesContext` (already loaded for Library/Cards views).
- **Fields:** `title`, `bodyHtml` (tags stripped via `stripHtml()`), and `labels`.
- **Matching:** tokenize with `query.trim().toLowerCase().split(/\s+/).filter(Boolean)`; one combined lowercase string from title, stripped body, and labels; `tokens.every((t) => searchable.includes(t))`. Case-insensitive substring per token; no stemming.
- **Empty guard:** returns `[]` if query is empty or whitespace-only.
- **No backend required:** works offline and does not consume Supabase edge function invocations.

This is sufficient for personal libraries of hundreds of notes. If the library grows large enough that client-side filtering lags, consider the Postgres approach below as a follow-up:

- `title ILIKE '%' || safe_query || '%'`
- `source_text ILIKE ...` (same table as embeddings).
- **Sanitize** the query for `LIKE` (escape `%`, `_`, and cap length) to prevent accidental patterns.

**Optional later:** [PostgreSQL full-text search](https://www.postgresql.org/docs/current/textsearch.html) (`to_tsvector` / `to_tsquery`) for stemming, ranking (*`ts_rank`*), and better phrase handling. That adds index and migration work; ILIKE is acceptable for **100–150 notes per user** in early iterations.

---

## 6. Result merging strategy

- **Deduplicate** on `note_id` after both branches return candidate lists (with limits, e.g. top *N* per branch or a merge cap).
- For each note, attach:
  - `semanticScore` — from the existing similarity output (0–1 style scale used today, or normalized to `[0,1]`).
  - `keywordScore` — from a simple model in [§7](#7-keyword-scoring-simple-model) (0 if no keyword hit).

**Combined score (example):**

`combinedScore = (semanticScore × 0.7) + (keywordScore × 0.3)`

- Weights are **tunable**; product feedback may favor keyword more for short queries, or semantic more for long natural-language questions.
- Edge cases: note only in keyword list → `semanticScore = 0`; only in semantic list → `keywordScore = 0` (unless you impute; usually **0** is fine for MVP).

---

## 7. Keyword scoring (simple model)

A practical, debuggable first pass (numbers are illustrative; tune with real queries):

- **Title contains full query (case-insensitive):** highest keyword score (e.g. 1.0).
- **Title contains an important query token or ordered substring:** high (e.g. 0.8–0.9).
- **Body / `source_text` contains full query string:** high but slightly below title (e.g. 0.7–0.85).
- **Partial / token matches only:** medium (e.g. 0.3–0.5).
- **No match in scoped fields:** 0.0 (note excluded from keyword branch, or given 0 in merge).

The important property is **monotonicity**: stronger literal overlap → higher `keywordScore`, so merging does not need to be perfect on day one.

---

## 8. Implementation approach (recommended)

- **Primary surface:** extend the existing **`search-notes-semantic`** Edge Function (or a renamed successor) so that one authenticated request:
  1. Embeds the query and runs the **vector** branch (current RPC/flow).
  2. Runs a **keyword** query (via Supabase client with user JWT, or a small SQL function with `auth.uid()`), returning candidate `note_id`s and simple match metadata for scoring.
  3. **Merges and sorts** in the Edge Function, returns a **single** list to the client (shape compatible with current UI, plus optional `semanticScore` / `keywordScore` for debugging or future UI).

- **Why merge in the function first:** same deploy unit as today, **easy logging**, fast iteration, no need to coordinate multiple client calls. Moving merge into SQL (see below) is an optimization, not a prerequisite.

- **Client:** the Library can keep `supabase.functions.invoke` **unchanged** from a *call count* perspective if the function returns the merged list.

---

## 9. Why not overengineer

- Target scale is a **small personal library** (on the order of **100–150 notes** per user, as in the rest of the product docs).
- **No Elasticsearch, Meilisearch, or external search SaaS** is required for MVP; Postgres + the existing stack stay sufficient.
- **No chunking** of notes in the first hybrid iteration (still one vector per note); chunking remains a *separate* future lever if very long notes become common.

---

## 10. Future improvements

- **Hybrid ranking** — combine semantic similarity with keyword signals; boost exact phrase matches, title hits, label hits, and optionally recency or star rating (see [§6–§7](#6-result-merging-strategy)).
- **SQL-side merge and ranking** — one RPC returns merged scores; less data over the wire; easier to index for keyword search at scale.
- **Full-text search (`tsvector` / `tsquery`)** — better than raw `ILIKE` for language-aware matching and `ts_rank`.
- **Chunking** — multiple embeddings per long note, with careful deduplication in results.
- **Query embedding cache** — cache frequent queries to cut embedding cost.
- **UI** — highlight matched terms, show *why* a result ranked (semantic vs keyword), blend with label/date filters in one coherent UX.

---

## See also

- [SEMANTIC_SEARCH.md](SEMANTIC_SEARCH.md) — current production behavior, embeddings, backfill, security.
