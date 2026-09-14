/**
 * esbuild bundling (doc 04 "Package And Bootstrap"): ESM, platform node,
 * target node20, shebang, externalize the two public runtime packages
 * (`@modelcontextprotocol/server`, `@neondatabase/neon-js`), bundle
 * `@bemtevi/content-core` into the artifact. Emits `dist/index.js` plus
 * `dist/meta.json` for the architecture gate (no repo source in inputs).
 */

import { build } from 'esbuild';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const dist = path.join(here, 'dist');

if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

const result = await build({
  entryPoints: [path.join(here, 'src/index.ts')],
  absWorkingDir: repoRoot,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: path.join(dist, 'index.js'),
  banner: { js: '#!/usr/bin/env node' },
  // Doc 04: externalize exactly the two public runtime packages; everything
  // else (including the workspace `@bemtevi/content-core`) is bundled in.
  external: ['@modelcontextprotocol/server', '@modelcontextprotocol/server/*', '@neondatabase/neon-js'],
  metafile: true,
  sourcemap: false,
  logLevel: 'info',
});

// esbuild emits metafile input keys relative to `absWorkingDir`; the
// architecture gate matches absolute POSIX paths (`/packages/...`,
// `/node_modules/...`), so re-root every key before persisting.
const toAbsolutePosix = (key) => {
  const posix = key.replace(/\\/g, '/');
  return posix.startsWith('/') ? posix : `/${posix}`;
};
const metafile = {
  inputs: Object.fromEntries(
    Object.entries(result.metafile.inputs).map(([key, value]) => [toAbsolutePosix(key), value]),
  ),
  outputs: result.metafile.outputs,
};
writeFileSync(path.join(dist, 'meta.json'), JSON.stringify(metafile, null, 2));
console.log('built dist/index.js');
