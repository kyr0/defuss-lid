#!/usr/bin/env node
/**
 * Fetch the released model files from Hugging Face into models/ and verify them against models.lock.json.
 *
 * Why the models are not in git: they are released as versioned Hugging Face model repositories
 * (https://huggingface.co/kyr0/defuss-lid-1.0 for the fastText packs, the CLD3 core and every benchmark candidate,
 * https://huggingface.co/kyr0/cld3-pq-dno for the CLD3 DNO-PQ packs), which is where users download them, and
 * `models/` is gitignored so the two copies cannot drift. Why a lock file instead of "download main": the npm package,
 * the pack registry and every test assume exact bytes. A pinned revision plus SHA-256 per file turns a silently
 * changed upstream file into a hard failure here, before any test or publish sees it.
 *
 * Usage:
 *   node scripts/fetch-models.mjs          download missing or mismatched files (idempotent)
 *   node scripts/fetch-models.mjs --check  verify only, never touch the network (used by `prepack`)
 *   node scripts/fetch-models.mjs --live   verify the files on Hugging Face itself, without writing anything
 *
 * VERIFIED: `--live` matched all 32 locked files of both releases on Hugging Face on 2026-11-03; a deleted file was
 * re-downloaded * byte-identical.
 */
import {createHash} from 'node:crypto';
import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {lockedFiles, readLock} from './lock.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = readLock(root);
const files = lockedFiles(lock);
const mode = process.argv.includes('--check') ? 'check' : process.argv.includes('--live') ? 'live' : 'fetch';

const log = (level, message, fields = {}) => {
  const pairs = Object.entries(fields).map(([key, value]) => `${key}=${value}`).join(' ');
  (level === 'error' ? console.error : console.log)(`${new Date().toISOString()} ${level} ${message}${pairs ? ' ' + pairs : ''}`);
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function localState(path, expected) {
  try {
    const bytes = await readFile(join(root, path));
    return bytes.length === expected.bytes && sha256(bytes) === expected.sha256 ? 'ok' : 'mismatch';
  } catch (error) {
    if (error.code === 'ENOENT') return 'missing';
    throw error;
  }
}

async function download(path, expected) {
  const response = await fetch(expected.url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${expected.url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== expected.bytes || sha256(bytes) !== expected.sha256) {
    throw new Error(`hash mismatch for ${path}: got ${bytes.length} bytes sha256=${sha256(bytes)}`);
  }
  return bytes;
}

const failures = [];
for (const [path, expected] of Object.entries(files)) {
  try {
    if (mode === 'live') {
      await download(path, expected);
      log('info', 'verified remote', {file: path, bytes: expected.bytes});
      continue;
    }
    const state = await localState(path, expected);
    if (state === 'ok') continue;
    if (mode === 'check') throw new Error(`${state} (run: bun run models)`);
    const target = join(root, path);
    const bytes = await download(path, expected);
    await mkdir(dirname(target), {recursive: true});
    // Write to a sibling and rename: an interrupted download never leaves a truncated file under the real name.
    await writeFile(target + '.part', bytes);
    await rename(target + '.part', target);
    log('info', 'fetched', {file: path, bytes: bytes.length, revision: expected.revision.slice(0, 12)});
  } catch (error) {
    failures.push(path);
    log('error', 'model file failed', {file: path, reason: JSON.stringify(error.message)});
    await rm(join(root, path + '.part'), {force: true});
  }
}
if (failures.length) {
  log('error', 'models incomplete', {failed: failures.length, of: Object.keys(files).length});
  process.exit(1);
}
log('info', mode === 'live' ? 'remote release matches lock' : 'models verified', {
  files: Object.keys(files).length,
  releases: lock.releases.map(release => `${release.repository}@${release.revision.slice(0, 12)}`).join(','),
});
