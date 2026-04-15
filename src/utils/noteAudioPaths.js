/**
 * Normalize a filename for storage keys: no path separators, reasonable length.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeAudioFileName(name) {
  if (typeof name !== 'string' || !name.trim()) return 'audio';
  const base = name.replace(/[/\\]/g, '-').replace(/\s+/g, ' ').trim();
  const stripped = base.replace(/^\.+/, '');
  const limited = stripped.length > 120 ? stripped.slice(0, 120) : stripped;
  return limited || 'audio';
}

/**
 * Stable object path: `{userId}/{scopeId}/{uuid}_{safeName}` — per-user, scoped by note or draft session, collision-resistant.
 * @param {string} userId
 * @param {string} scopeId  Note id, draft key, or other folder key (no slashes).
 * @param {string} originalFileName
 * @returns {string}
 */
export function buildNoteAudioObjectPath(userId, scopeId, originalFileName) {
  const safe = sanitizeAudioFileName(originalFileName);
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const scope = String(scopeId || 'session').replace(/[/\\]/g, '-');
  return `${userId}/${scope}/${id}_${safe}`;
}
