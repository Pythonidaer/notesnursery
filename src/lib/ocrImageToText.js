import { getSupabase } from './supabaseClient.js';
import { preprocessImageForOcr } from '../utils/preprocessImageForOcr.js';

/**
 * @param {File} file
 * @returns {Promise<{ imageBase64: string, mimeType: string }>}
 */
function fileToBase64Payload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = reader.result;
      if (typeof s !== 'string') {
        reject(new Error('Could not read file'));
        return;
      }
      const i = s.indexOf(',');
      const b64 = i >= 0 ? s.slice(i + 1) : s;
      resolve({ imageBase64: b64, mimeType: file.type || 'image/jpeg' });
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Image → text via `ocr-image-to-text` Edge Function (OCR is performed server-side).
 * Never sends API keys to the client.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {File} file
 * @returns {Promise<string>} trimmed text
 */
export async function ocrImageFileToText(supabase, file) {
  if (!file || !file.size) {
    throw new Error('No image file selected');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }

  const processed = await preprocessImageForOcr(file);
  const { imageBase64, mimeType } = await fileToBase64Payload(processed);
  const { data, error } = await supabase.functions.invoke('ocr-image-to-text', {
    body: { imageBase64, mimeType },
  });

  if (error) {
    const raw = error.message || 'Could not read text from image';
    if (
      /Failed to send a request to the Edge Function/i.test(raw) ||
      /ERR_NETWORK|Failed to fetch|NetworkError|Load failed/i.test(raw)
    ) {
      throw new Error(
        'OCR could not be reached. Deploy the ocr-image-to-text Edge Function, set the OCR_SPACE_API_KEY secret in Supabase, and try again (or check your network).',
      );
    }
    throw new Error(raw);
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  const text =
    data && typeof data === 'object' && 'text' in data && data.text != null ? String(data.text) : '';
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('No text was recognized in that image');
  }
  return trimmed;
}

/**
 * Convenience: uses the singleton client from `getSupabase()`.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function ocrImageFileToTextWithDefaultClient(file) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Sign in to import text from images');
  }
  return ocrImageFileToText(supabase, file);
}
