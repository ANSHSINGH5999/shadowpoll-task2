// Several Midnight SDK packages (@midnight-ntwrk/compact-runtime,
// @midnight-ntwrk/midnight-js-utils, ...) reference the Node.js `Buffer`
// global directly, without importing it — normal in Node, but Vite doesn't
// polyfill Node globals for the browser, so calling into those code paths
// (e.g. building providers, deploying/calling the contract) throws
// "Buffer is not defined". Must be imported before any other app code.
import { Buffer } from 'buffer';

if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}
