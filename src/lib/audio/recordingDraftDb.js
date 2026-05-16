const DB_NAME = 'notesnursery-recording-drafts';
const DB_VERSION = 2;
const STORE = 'drafts';

/** @typedef {'recording'|'paused'|'stopped-local'|'upload-pending'|'uploading'|'uploaded'|'failed'|'discarded'} RecordingDraftStatus */

/**
 * @typedef {object} RecordingDraft
 * @property {string} draftId
 * @property {string} userId
 * @property {string} startedAt ISO
 * @property {string} updatedAt ISO
 * @property {number} duration seconds (best effort)
 * @property {string} mimeType
 * @property {string} extension
 * @property {RecordingDraftStatus} status
 * @property {string} [displayName]
 * @property {ArrayBuffer} [audioBuffer] Merged capture bytes (reliable on iOS Safari)
 * @property {Blob[]} [chunks] Legacy; prefer audioBuffer
 * @property {string} [storagePath]
 * @property {string} [uploadError]
 */

/**
 * @param {ArrayBuffer | undefined | null} a
 * @param {ArrayBuffer} b
 */
export function concatArrayBuffers(a, b) {
  if (!a || a.byteLength === 0) return b;
  if (!b.byteLength) return a;
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(new Uint8Array(a), 0);
  out.set(new Uint8Array(b), a.byteLength);
  return out.buffer;
}

/**
 * Base MIME for Blobs and &lt;audio&gt; (strip codecs= on iOS).
 * @param {string} mimeType
 */
export function normalizeRecordingMimeType(mimeType) {
  const base = String(mimeType || '').split(';')[0].trim().toLowerCase();
  if (base === 'audio/mp4' || base === 'video/mp4') return 'audio/mp4';
  if (base === 'audio/webm') return 'audio/webm';
  if (base.startsWith('audio/')) return base;
  return 'application/octet-stream';
}

/** @returns {Promise<IDBDatabase>} */
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'draftId' });
        os.createIndex('userId', 'userId', { unique: false });
        os.createIndex('status', 'status', { unique: false });
      }
      if (oldVersion > 0 && oldVersion < 2) {
        /* v2 adds audioBuffer; existing rows keep legacy chunks until re-recorded */
      }
    };
  });
}

/**
 * @param {IDBDatabase} db
 * @param {'readonly'|'readwrite'} mode
 * @param {(store: IDBObjectStore) => IDBRequest} run
 */
function txRequest(db, mode, run) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = run(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });
}

/**
 * @param {unknown} part
 * @returns {Blob | null}
 */
function chunkToBlob(part, mimeType) {
  if (part instanceof Blob && part.size > 0) return part;
  if (part instanceof ArrayBuffer && part.byteLength > 0) {
    return new Blob([part], { type: mimeType });
  }
  return null;
}

/**
 * @param {RecordingDraft} draft
 * @returns {Blob}
 */
export function recordingDraftToBlob(draft) {
  const type = normalizeRecordingMimeType(draft.mimeType);
  if (draft.audioBuffer && draft.audioBuffer.byteLength > 0) {
    return new Blob([draft.audioBuffer], { type });
  }
  const parts = draft.chunks ?? [];
  const normalized = parts.map((p) => chunkToBlob(p, type)).filter(Boolean);
  if (normalized.length === 0) {
    return new Blob([], { type });
  }
  return new Blob(normalized, { type });
}

/**
 * @param {RecordingDraft} draft
 */
export function recordingDraftByteLength(draft) {
  if (draft.audioBuffer?.byteLength) return draft.audioBuffer.byteLength;
  const blob = recordingDraftToBlob(draft);
  return blob.size;
}

/**
 * @param {RecordingDraft} draft
 */
export async function putRecordingDraft(draft) {
  const db = await openDb();
  try {
    await txRequest(db, 'readwrite', (store) => store.put(draft));
  } finally {
    db.close();
  }
}

/**
 * @param {string} draftId
 * @returns {Promise<RecordingDraft | null>}
 */
export async function getRecordingDraft(draftId) {
  const db = await openDb();
  try {
    const row = await txRequest(db, 'readonly', (store) => store.get(draftId));
    return row ?? null;
  } finally {
    db.close();
  }
}

/**
 * @param {string} userId
 * @returns {Promise<RecordingDraft[]>}
 */
export async function listRecordingDraftsForUser(userId) {
  const db = await openDb();
  try {
    /** @type {RecordingDraft[]} */
    const all = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(/** @type {RecordingDraft[]} */ (req.result ?? []));
      req.onerror = () => reject(req.error ?? new Error('IndexedDB getAll failed'));
    });
    return all
      .filter(
        (d) =>
          d.userId === userId &&
          d.status !== 'discarded' &&
          d.status !== 'uploaded'
      )
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  } finally {
    db.close();
  }
}

/**
 * @param {string} draftId
 */
export async function deleteRecordingDraft(draftId) {
  const db = await openDb();
  try {
    await txRequest(db, 'readwrite', (store) => store.delete(draftId));
  } finally {
    db.close();
  }
}

/**
 * @param {string} draftId
 * @param {Blob} chunk
 * @param {{ duration?: number, status?: RecordingDraftStatus }} [patch]
 */
export async function appendRecordingChunk(draftId, chunk, patch = {}) {
  const existing = await getRecordingDraft(draftId);
  if (!existing) throw new Error('Draft not found');
  const chunkBuf = await chunk.arrayBuffer();
  const merged = concatArrayBuffers(existing.audioBuffer, chunkBuf);
  const now = new Date().toISOString();
  const next = {
    ...existing,
    ...patch,
    audioBuffer: merged,
    updatedAt: now,
    duration: typeof patch.duration === 'number' ? patch.duration : existing.duration,
  };
  await putRecordingDraft(next);
  return next;
}
