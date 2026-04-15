/**
 * Internal logging for debugging transcription failures (full error in console).
 * User-facing copy stays generic — never surface raw engine/ORT messages.
 *
 * @param {unknown} err
 * @param {string} [context]
 */
export function logTranscribeError(err, context = 'transcribe') {
  if (err instanceof Error) {
    console.error(`[${context}]`, err.name, err.message);
    if (err.stack) console.error(err.stack);
  } else {
    console.error(`[${context}]`, err);
  }
}

/**
 * Stable modal copy for any transcription failure after logging.
 * @returns {{ title: string, message: string, detail: string }}
 */
export function transcribeErrorForModal() {
  return {
    title: 'Transcribe audio',
    message: 'Transcription could not start in this browser.',
    detail: 'Try Chrome on desktop, a shorter clip, or refresh and try again.',
  };
}
