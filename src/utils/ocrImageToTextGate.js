import { isAdminComedyRatingUser } from './comedyRating.js';

/**
 * UI-only gate for the note editor’s image→text (OCR) toolbar control.
 * Uses the same admin as comedy star ratings (`COMEDY_RATING_ADMIN_EMAIL` in `comedyRating.js`).
 *
 * @param {{ email?: string | null } | null | undefined} user — Supabase auth user
 * @returns {boolean}
 */
export function isOcrImageToTextUser(user) {
  return isAdminComedyRatingUser(user);
}
