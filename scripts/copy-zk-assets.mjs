// Copies the compiled contract's proving/verifying keys and zkir circuits
// into public/ so Vite serves them as static files. The browser fetches
// them at runtime (via FetchZkConfigProvider) to generate proofs locally.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'managed', 'shadowpoll');
const dest = join(root, 'public', 'zk', 'shadowpoll');

if (!existsSync(src)) {
  console.warn('[copy-zk-assets] managed/shadowpoll not found — run "npm run compact:compile" first.');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(join(src, 'keys'), join(dest, 'keys'), { recursive: true });
cpSync(join(src, 'zkir'), join(dest, 'zkir'), { recursive: true });

console.log('[copy-zk-assets] copied keys/ and zkir/ into public/zk/shadowpoll/');
