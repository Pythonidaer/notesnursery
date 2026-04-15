/**
 * Browser-side speech-to-text using Transformers.js (Whisper tiny, English).
 * Models load from Hugging Face Hub on first use; runs locally after download.
 *
 * @typedef {{ status: string, file?: string, progress?: number }} TranscribeProgress
 */

/** Task passed to `pipeline()` — must match Transformers.js ASR task id. */
export const TRANSCRIBE_TASK = 'automatic-speech-recognition';

/**
 * Valid remote model id on the Hub (ONNX / transformers.js compatible).
 * @see https://huggingface.co/Xenova/whisper-tiny.en
 */
export const TRANSCRIBE_MODEL_ID = 'Xenova/whisper-tiny.en';

let envConfigured = false;

/**
 * Pin remote loading for the browser bundle. Vite can polyfill `fs`/`path`, which makes
 * transformers.js think Node FS is available; it then tries `localModelPath` first and may
 * never reach Hub fetches for config.json / model.onnx.
 *
 * Does not override `remoteHost` or `remotePathTemplate` — those use @xenova/transformers
 * defaults (`env.js` for this package version).
 *
 * @param {Record<string, unknown> & { allowRemoteModels?: boolean, allowLocalModels?: boolean }} transformersEnv
 */
function configureTransformersEnvForBrowser(transformersEnv) {
  if (envConfigured) return;

  transformersEnv.allowRemoteModels = true;
  transformersEnv.allowLocalModels = false;
  transformersEnv.useFS = false;
  transformersEnv.useFSCache = false;

  if (typeof caches === 'undefined') {
    transformersEnv.useBrowserCache = false;
  }

  envConfigured = true;

  if (import.meta.env.DEV) {
    console.debug('[transcribe] env after browser-safety config', {
      task: TRANSCRIBE_TASK,
      modelId: TRANSCRIBE_MODEL_ID,
      allowRemoteModels: transformersEnv.allowRemoteModels,
      allowLocalModels: transformersEnv.allowLocalModels,
      useFS: transformersEnv.useFS,
      useFSCache: transformersEnv.useFSCache,
      useBrowserCache: transformersEnv.useBrowserCache,
      remoteHost: transformersEnv.remoteHost,
      remotePathTemplate: transformersEnv.remotePathTemplate,
      localModelPath: transformersEnv.localModelPath,
      libraryVersion: transformersEnv.version,
    });
  }
}

/** @type {Promise<import('@xenova/transformers').Pipeline> | null} */
let transcriberPromise = null;

/**
 * @param {(p: TranscribeProgress) => void} [firstProgress]
 */
function loadTranscriber(firstProgress) {
  if (!transcriberPromise) {
    transcriberPromise = import('@xenova/transformers').then(async (transformers) => {
      const { pipeline, env } = transformers;
      configureTransformersEnvForBrowser(env);

      if (import.meta.env.DEV) {
        console.debug('[transcribe] immediately before pipeline()', {
          task: TRANSCRIBE_TASK,
          modelId: TRANSCRIBE_MODEL_ID,
          envSnapshot: {
            allowRemoteModels: env.allowRemoteModels,
            allowLocalModels: env.allowLocalModels,
            useFS: env.useFS,
            useFSCache: env.useFSCache,
            useBrowserCache: env.useBrowserCache,
            remoteHost: env.remoteHost,
            remotePathTemplate: env.remotePathTemplate,
            localModelPath: env.localModelPath,
            libraryVersion: env.version,
          },
        });
      }

      return pipeline(TRANSCRIBE_TASK, TRANSCRIBE_MODEL_ID, {
        progress_callback: firstProgress,
      });
    });
  }
  return transcriberPromise;
}

/**
 * @param {unknown} output
 * @returns {string}
 */
function pickTranscriptText(output) {
  if (output == null) return '';
  if (typeof output === 'string') return output.trim();
  if (typeof output === 'object') {
    const o = /** @type {Record<string, unknown>} */ (output);
    if (typeof o.text === 'string') return o.text.trim();
    if (Array.isArray(o.chunks)) {
      return o.chunks
        .map((c) => (c && typeof c === 'object' && typeof /** @type {{ text?: string }} */ (c).text === 'string' ? /** @type {{ text: string }} */ (c).text : ''))
        .join(' ')
        .trim();
    }
  }
  return '';
}

/**
 * Transcribe audio from a fetchable URL (e.g. Supabase signed URL).
 * Free, local inference after model download; no paid API.
 *
 * @param {string} audioUrl
 * @param {{ onProgress?: (p: TranscribeProgress) => void }} [options]
 * @returns {Promise<{ text: string }>}
 */
export async function transcribeAudioFromUrl(audioUrl, options = {}) {
  const { onProgress } = options;
  const transcriber = await loadTranscriber(onProgress);
  if (import.meta.env.DEV) {
    console.debug('[transcribe] running ASR on audio URL', {
      modelId: TRANSCRIBE_MODEL_ID,
      urlPrefix: typeof audioUrl === 'string' ? audioUrl.slice(0, 48) : '',
    });
  }
  const raw = await transcriber(audioUrl, {
    return_timestamps: false,
    chunk_length_s: 30,
    progress_callback: onProgress,
  });
  const text = pickTranscriptText(raw);
  return { text };
}

/**
 * Clear cached pipeline (e.g. for tests). Optional.
 */
export function resetTranscriberForTests() {
  transcriberPromise = null;
  envConfigured = false;
}
