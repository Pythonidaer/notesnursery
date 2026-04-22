/** Upper bound for OCR.space free tier and Edge Function; processed output must be ≤ this. */
export const OCR_IMAGE_MAX_BYTES = 1_024 * 1_024;

/**
 * Max dimension (px) on the longest side, JPEG quality (0–1).
 * Tried in order until output fits {@link OCR_IMAGE_MAX_BYTES} or all attempts are exhausted.
 */
const PREPROCESS_ATTEMPTS = [
  { maxDimension: 1600, quality: 0.75 },
  { maxDimension: 1400, quality: 0.65 },
  { maxDimension: 1200, quality: 0.55 },
];

/**
 * @param {number} w
 * @param {number} h
 * @param {number} maxDim
 */
function fitWithinMax(w, h, maxDim) {
  if (w <= 0 || h <= 0) {
    throw new Error('Invalid image dimensions');
  }
  if (w <= maxDim && h <= maxDim) {
    return { width: w, height: h };
  }
  const scale = maxDim / Math.max(w, h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/**
 * Decodes the image in memory, resizes, re-encodes as JPEG, and retries a few size/quality steps
 * so the result fits the OCR size limit. Does not upload or store the image.
 *
 * @param {File | Blob} file
 * @returns {Promise<File>} JPEG `File` (≤ {@link OCR_IMAGE_MAX_BYTES} bytes)
 * @throws {Error} if the file is not a readable image, or it cannot be reduced enough
 */
export async function preprocessImageForOcr(file) {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Could not read that image. Try JPEG or PNG, or a different photo.');
  }

  const srcW = bitmap.width;
  const srcH = bitmap.height;

  try {
    for (const { maxDimension, quality } of PREPROCESS_ATTEMPTS) {
      const { width, height } = fitWithinMax(srcW, srcH, maxDimension);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not process image in this browser');
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Could not encode image'))),
          'image/jpeg',
          quality,
        );
      });
      if (blob.size <= OCR_IMAGE_MAX_BYTES) {
        return new File([blob], 'ocr.jpg', { type: 'image/jpeg', lastModified: Date.now() });
      }
    }

    throw new Error(
      'Could not reduce the image enough to send (1MB limit). Try a smaller or lower-resolution photo.',
    );
  } finally {
    bitmap.close();
  }
}
