import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Prevent Node-only ONNX native bindings from entering the browser bundle.
      // @xenova/transformers imports this for Node; the browser must use onnxruntime-web only.
      'onnxruntime-node': resolve(__dirname, 'src/shims/onnxruntime-node-stub.js'),
    },
  },
  optimizeDeps: {
    // Ensure onnxruntime-common resolves once so `registerBackend` is defined when ort-web loads.
    include: ['onnxruntime-web', 'onnxruntime-common'],
    exclude: ['@xenova/transformers'],
  },
});
