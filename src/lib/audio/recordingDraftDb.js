const DB_NAME = 'notesnursery-recording-drafts';
const DB_VERSION = 1;
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
 * @property {Blob[]} chunks
 * @property {string} [storagePath]
 * @property {string} [uploadError]
 */

/** @returns {Promise<IDBDatabase>} */
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'draftId' });
        os.createIndex('userId', 'userId', { unique: false });
        os.createIndex('status', 'status', { unique: false });
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
  const now = new Date().toISOString();
  const next = {
    ...existing,
    ...patch,
    chunks: [...(existing.chunks ?? []), chunk],
    updatedAt: now,
    duration: typeof patch.duration === 'number' ? patch.duration : existing.duration,
  };
  await putRecordingDraft(next);
  return next;
}

/**
 * @param {RecordingDraft} draft
 * @returns {Blob}
 */
export function recordingDraftToBlob(draft) {
  const type = draft.mimeType || 'application/octet-stream';
  const parts = draft.chunks ?? [];
  return new Blob(parts, { type });
}
