/**
 * Vite/browser shim: @xenova/transformers imports `onnxruntime-node` for Node,
 * but the browser path must use `onnxruntime-web` only. The real optional
 * dependency must not be bundled for the client.
 */
export default {};
