#!/usr/bin/env node
/**
 * Copy the browser runtime into docs/assets/lib/ for the website.
 *
 * Why a copy instead of loading the runtime from a CDN: the site is served by GitHub Pages straight from docs/, it must
 * work before (and independently of) an npm release, and it must run exactly the code this checkout ships. The copy
 * keeps the package layout (dist/, runtime/) because dist/cld3-pack.js resolves the CLD3 core via a relative URL.
 * Run `bun run build` first: the source is the built dist/, the same files the npm tarball ships.
 * Models are not copied: the site loads them from the pinned Hugging Face revision, the place users download them from.
 *
 * `scripts/verify.mjs` fails when the copy differs from the package files, so `bun run docs` after a runtime change is
 * enforced, not remembered. `--from <dir>` copies from another package root (e2e uses the installed tarball).
 *
 * VERIFIED: scripts/verify.mjs check 'site-runtime-copy' compares every copied file by SHA-256.
 */
import {cp, mkdir, readdir, rm} from 'node:fs/promises';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fromIndex = process.argv.indexOf('--from');
const source = fromIndex > 0 ? process.argv[fromIndex + 1] : root;
const toIndex = process.argv.indexOf('--to');
const target = toIndex > 0 ? process.argv[toIndex + 1] : join(root, 'docs/assets/lib');

/** Files the browser needs: runtime JavaScript and the shared CLD3 core, never type declarations or Node loaders. */
export const shipsToBrowser = path =>
  (/^dist\/.+\.js$/.test(path) && !path.endsWith('.node.js') && path !== 'dist/cld3.js') ||
  path === 'runtime/cld3-core.bin.gz' || path === 'NOTICE.md';

export async function listLibFiles(base) {
  const out = [];
  const walk = async dir => {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else out.push(relative(base, full).split('\\').join('/'));
    }
  };
  for (const dir of ['dist', 'runtime']) await walk(join(base, dir));
  out.push('NOTICE.md');
  return out.filter(shipsToBrowser).sort();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('scripts/docs.mjs')) {
  await rm(target, {recursive: true, force: true});
  const files = await listLibFiles(source);
  for (const file of files) {
    await mkdir(join(target, file, '..'), {recursive: true});
    await cp(join(source, file), join(target, file));
  }
  console.log(`${new Date().toISOString()} info docs runtime copied files=${files.length} to=${relative(root, target) || target}`);
}
