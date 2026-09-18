import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import wasmPkg from 'vite-plugin-wasm';

// This package's published type declarations don't resolve cleanly under
// every moduleResolution setting; calling through an `any`-typed alias keeps
// `tsc -b tsconfig.app.json` (what `npm run build` actually gates on)
// unaffected by this config-only file.
const wasm = wasmPkg as unknown as () => import('vite').Plugin;

// Midnight's compact-runtime ships a WASM module. Building for 'esnext'
// means Rollup's own ES module output handles top-level await natively, so
// no extra plugin is needed for that part.
//
// `globalThis.Buffer` is polyfilled directly in src/main.tsx instead of via
// vite-plugin-node-polyfills: that plugin's Rollup-level AST injection did
// not reliably reach every deeply-nested SDK file that references the bare
// `Buffer` global (compact-runtime, midnight-js-utils, ...), so a couple of
// them still threw "Buffer is not defined" at runtime even with the plugin
// active. Setting the real global once, before anything else runs, is a
// runtime fix that doesn't depend on the bundler finding every call site.
export default defineConfig({
  build: {
    target: 'esnext',
    rollupOptions: {
      // Multi-page build: silk-demo.html is a fully separate bundle from
      // index.html (its own JS entry, its own CSS). Tailwind is only
      // ever imported by the demo's entry module, so this keeps Tailwind's
      // reset/utilities from ever loading on the main ShadowPoll site.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        silkDemo: fileURLToPath(new URL('./silk-demo.html', import.meta.url)),
      },
    },
  },
  // tailwindcss() only expands files that actually `@import "tailwindcss"`
  // (src/silk-demo.css) — it leaves src/styles.css, which never references
  // Tailwind, untouched.
  plugins: [react(), tailwindcss(), wasm()],
  optimizeDeps: {
    // Keep both WASM-backed Midnight runtimes out of esbuild's dependency
    // prebundle so their generated bindings initialize before use.
    exclude: [
      '@midnight-ntwrk/ledger-v8',
      '@midnight-ntwrk/midnight-js-protocol',
      '@midnight-ntwrk/onchain-runtime-v3',
    ],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.wasm'],
  },
});
