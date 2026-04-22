# Semantic search (notes)

This guide is for **developers** and **curious users**. You do not need a machine-learning background.

---

## TL;DR

- You can now search your notes by **meaning** (semantic search), not just exact words.
- This feature **retrieves** relevant notes — it does **NOT** generate answers (no AI chat yet).

---

## 1. Overview (simple)

Notes Nursery can **search your notes by meaning**, not only by exact words.

- In the **Library** (signed in, production), use the **Semantic search** box: type a question or phrase in plain English, and the app returns notes that are *conceptually* close to what you asked.
- Under the hood, the app uses **embeddings** and **vector search** in Supabase Postgres.
- This feature is **retrieval**: it **finds** relevant notes. It does **not** write new answers for you (that would be RAG or a chat assistant—we have not built that yet).

---

## Why this matters

**Before:**

- Search only worked if you used the **exact words** in your note (or very close matches).

**Now:**

- You can search by **idea**, not wording.

**Example:** Searching *“footwork”* can return notes about *“movement in the ring”* even if the word “footwork” never appears.

---

## 2. What is happening under the hood (high level)

Think of it as a pipeline:

1. **Plain text** — Each note is turned into readable text: title, labels, and body (HTML is stripped to text, so you are not storing raw tags for search).
2. **Embedding** — That text is run through a small AI model (`gte-small` on Supabase). The model outputs a long list of numbers that *represent* the meaning of the text.
3. **Storage** — Those numbers are saved in Postgres in a **vector** column (`embedding`), one row per note per user, in the `note_embeddings` table.
4. **Your search** — When you search, your query text gets the same treatment: it becomes an embedding.
5. **Nearest matches** — The database compares your query’s numbers to each note’s numbers and picks the **closest** ones (mathematically “similar” in meaning).
6. **Results** — You see titles, short snippets, and a **similarity** score—not the raw embedding.

You do not need to understand the math to use this feature effectively: “closer” vectors ≈ “more similar” meaning.

---

## 3. Key concepts (plain English)

### Embeddings

- **What:** A fixed-length list of numbers produced by a model from a piece of text.
- **Why:** Computers cannot “understand” words the way humans do. Embeddings turn text into numbers so we can **compare** two texts by comparing their numbers.

**In this app:**

- Each embedding has **384** numbers.
- That size comes from the model we use (**`gte-small`**).

### Vectors

- **What:** A vector is just a **list of numbers** stored in the database (Postgres + the `pgvector` extension).

**Example:** `[0.12, -0.98, 0.45, ...]` (384 numbers in practice.)

**Think of it like:**

- A **coordinate** in a high-dimensional space.
- Similar meanings end up **closer together** in that space.

You do not need to understand the math to use this feature effectively — just know: **closer vectors = more similar meaning.**

The database uses these lists to run fast similarity queries and find the best matches for your query.

### Semantic search vs keyword search

- **Keyword search** — Looks for **exact** (or stemmed) words: if you search “dog”, you mainly get notes containing “dog”.
- **Semantic search** — Looks for **meaning**: a note about “puppies” or “golden retrievers” can match a query about “dogs” even if the word “dogs” never appears.

**Example:**

| | |
|--|--|
| **Note content** | *“Boxers with strong defensive skills and counterpunching”* |
| **Search query** | *“fighters who avoid getting hit”* |
| **Keyword search** | No match — the words are different. |
| **Semantic search** | Match — the **meaning** is similar. |

### Similarity score

- **What:** A number between about **0** and **1** (e.g. `0.82`).

**Meaning:**

- Closer to **1** → more similar meaning.
- Closer to **0** → less similar.

**Important:**

- This is **NOT** a percentage or a confidence score.
- It is only useful for **ranking** results **relative to each other** in that search.

### Retrieval vs RAG

- **Retrieval** — “Find me the notes that match this idea.” **This is what we built.**
- **RAG (Retrieval-Augmented Generation)** — “Find relevant notes, then **generate** an answer that quotes or summarizes them.” **We did not build that.** The app does not call a large chat model to compose answers from your notes.

### Chunking

- **What:** Splitting a long document into smaller pieces (chunks), each with its own embedding.
- **Why people use it:** Very long pages need many vectors so each section can match queries precisely.
- **Why we skip it for now:** The product targets **small libraries** (on the order of tens to low hundreds of notes per user). **One embedding per whole note** keeps the system simple. Very long notes may be a bit less precise than chunked search would be—that is an accepted tradeoff for this MVP.

---

## 4. Architecture (simple text diagram)

```
Browser (Library UI)
    → calls Supabase Edge Function: search-notes-semantic
        → (with your login) runs built-in AI: text → query embedding
        → runs Postgres function: vector similarity + join to your notes
    ← returns titles, snippets, similarity (not raw vectors)

Backfill / embed path:
    Script or future flows
    → Edge Function: embed-note-text (text → embedding)
    → Upsert row in note_embeddings for that user + note
```

**Frontend** does not talk to the vector column directly for search logic; the **Edge Function** owns embedding + calling the secure SQL search.

---

## 5. Database changes

### Table: `note_embeddings`

Stores **one embedding per note per user** (no chunking in this MVP).

Typical columns used by this feature:

| Column        | Role |
|---------------|------|
| `user_id`     | Who owns this row (must match the note owner). |
| `note_id`     | Which note this embedding belongs to. |
| `source_text` | The plain-text blob that was embedded (title + labels + body text). Helps debugging and re-embedding later. |
| `embedding`   | `vector(384)` — the numbers from `gte-small`. |
| `updated_at`  | When this row was last updated (backfill sets it). |

Your project may also have an `id` primary key; that is fine.

### Migration

`supabase/migrations/006_semantic_search_rls_and_rpc.sql` adds:

- Indexes on `user_id` and `note_id`
- A **unique** constraint on `(user_id, note_id)` so upserts work cleanly
- **Row Level Security (RLS)** on `note_embeddings`
- SQL function **`search_my_notes`** — vector similarity search scoped to **`auth.uid()`**

Apply this migration on your **hosted** database (SQL Editor or your normal migration process).

---

## 6. Edge Functions

Both run on Supabase. They use **Supabase’s built-in inference** for **`gte-small`** (no OpenAI key for embeddings).

Auth: each function builds a Supabase client with your **`Authorization: Bearer <access_token>`** and calls **`auth.getUser()`**. If you are not logged in, you get **401**.

> **Note:** Some projects use **ES256** JWTs (e.g. after moving to JWT signing keys). The API gateway can reject those at the edge. This repo sets **`verify_jwt = false`** for these two functions in `supabase/config.toml` so the request reaches your code; **authentication is still enforced inside** the function via `getUser()`.
>
> **This is safe because:**
>
> - The function still calls **`supabase.auth.getUser()`**.
> - If the token is invalid or missing, the request is **rejected** (401).
>
> So authentication still happens — **not** at the edge gateway, but **inside** the function, before any embedding or database work.

### `embed-note-text`

- **Purpose:** Accept JSON `{ "text": "..." }` and return `{ "embedding": [ ... 384 numbers ... ] }`.
- **Use:** Backfill script; any server-side or trusted caller with a user session.

### `search-notes-semantic`

- **Purpose:** Accept JSON `{ "query": "...", "limit": 8 }`, embed the query, call **`search_my_notes`**, return `{ "results": [ { "noteId", "title", "snippet", "similarity" } ] }`.
- **Use:** Library UI (`supabase.functions.invoke`).

### Deploy (from repo root, linked project)

```bash
npx supabase@latest login
npx supabase@latest link
npx supabase@latest functions deploy embed-note-text
npx supabase@latest functions deploy search-notes-semantic
```

---

## 7. Backfill process

**Why:** New notes (or existing notes before this feature) have **no row** in `note_embeddings` until you compute and store an embedding.

**What the script does:**

1. Uses your **Supabase URL**, **anon key**, and a valid **user access token** (`SUPABASE_ACCESS_TOKEN`).
2. Loads **your** notes (and labels) from `notes` / `note_labels`.
3. For each note, builds **source text** (same format as the app: Title / Labels / Body).
4. Calls **`embed-note-text`** to get a vector.
5. **Upserts** into `note_embeddings` (`user_id`, `note_id`, `source_text`, `embedding`, `updated_at`).

**Command** (replace the token with a fresh JWT from a logged-in session—see testing below):

```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_ACCESS_TOKEN='paste_your_jwt_here' npm run backfill:embeddings
```

npm script: **`npm run backfill:embeddings`** → `node scripts/backfill-note-embeddings.js`.

---

## 8. How to test

### A. Test that embeddings work (`test:embed`)

Uses **`npm run test:embed`** (`scripts/test-embed.js`). You need `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and a **user JWT**.

**Getting a token without copying from Network tab (optional dev trick):**  
In **development**, the app can expose `window.getToken` (see `src/lib/supabaseClient.js`). In the browser console after login: `await getToken()`, then:

```bash
SUPABASE_ACCESS_TOKEN='…' npm run test:embed
```

**Success looks like:**

```text
Status: 200
Embedding length: 384
```

If you see **`UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM`**, redeploy functions with this repo’s `supabase/config.toml` (`verify_jwt = false` for these functions) and try again.

### B. Test semantic search in the app

1. Run **backfill** so `note_embeddings` has data.
2. Open **Library**, use **Semantic search**.
3. Example queries:
   - *“notes about boxing”*
   - *“fighters with good footwork”*

**Expected:** Results are notes that **talk about those ideas**, not necessarily the exact words. Order should roughly follow **similarity** (higher first). If you have no embeddings yet, the list may be empty.

### C. Quick sanity checks

- **Empty query** — Should not crash; empty results.
- **Another user’s data** — You should **never** see someone else’s notes in results (RLS + `auth.uid()` in SQL).

---

## 9. Security model

- **RLS** on `note_embeddings`: users can only read/write **their own** rows (`user_id = auth.uid()`).
- **`search_my_notes`** joins `note_embeddings` to `notes` and filters **both** sides with **`auth.uid()`**. The app does **not** trust a `user_id` sent from the browser for matching—identity comes from the JWT inside Postgres / the Edge Function client.
- Search responses include **snippets and scores**, not the raw **embedding** vectors (smaller payload, less leakage).

---

## 10. Limitations (important)

- **No RAG** — The app does not generate answers from your notes; it only **retrieves** them.
- **No chunking** — One vector per note; very long notes may be less precise than a chunked system.
- **Small/medium scale** — Tuned for personal libraries, not millions of documents.
- **English-oriented model** — `gte-small` is aimed at English; other languages may work less well.
- **Depends on backfill** — Notes without a row in `note_embeddings` will not appear in semantic results until embedded.

---

## 11. Future improvements

- **RAG** — Optional “answer this question using my notes” with a separate LLM step.
- **Chunking** — Split long notes into sections for finer retrieval.
- **Better ranking** — Blend semantic score with recency, labels, or keyword filters.
- **UI** — Highlight why a note matched, filters combined with semantic search, empty states.
- **Caching** — Cache query embeddings for repeated searches (if needed at scale).

---

## Common issues

**No results**

- Backfill has not been run, or **`note_embeddings`** is empty for your user.

**Unauthorized errors**

- Missing or **expired** access token (get a fresh one from a logged-in session).

**Weird or weak results**

- Very **short** or very **long** notes, or notes with **little text**, can rank oddly or match loosely.

**What to try**

- Re-run **backfill** after you change many notes.
- Use **clearer, more specific** queries.

---

## Quick reference (files)

| Piece | Location |
|-------|----------|
| Migration (RLS + `search_my_notes`) | `supabase/migrations/006_semantic_search_rls_and_rpc.sql` |
| Source text for embedding | `src/utils/noteEmbeddingSourceText.js` |
| Library UI | `src/components/NoteSemanticSearch.jsx` |
| Client invoke helper | `src/lib/semanticSearch.js` |
| Embed function | `supabase/functions/embed-note-text/` |
| Search function | `supabase/functions/search-notes-semantic/` |
| Backfill | `scripts/backfill-note-embeddings.js` |
| Embed smoke test | `scripts/test-embed.js` |

---

If something in your project differs (extra columns, different vector size), align the database and `gte-small` (384 dims) before relying on this doc.
