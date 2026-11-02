#!/usr/bin/env node
/**
 * Structural gates: invariants that keep the repository consistent as it changes. Run by `make lint` (after the
 * build), so CI and every local `make verify` enforce them. Each check prints one line; any failure exits 1 with the
 * fix in the message.
 *
 * Why a script instead of reviewer discipline: every check below guards a fact that is written in two places (a
 * version in five files, a hash in the registry and the lock, a size or score in the README and on disk, a copy of the runtime
 * in docs/). Such pairs drift silently; a mechanical comparison is the only thing that keeps them equal.
 *
 * VERIFIED: during the 2026-11-02 migration it caught a stale README size table and an untagged report code block.
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, statSync} from 'node:fs';
import {readdir, readFile} from 'node:fs/promises';
import {dirname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {listLibFiles} from './docs.mjs';
import {generatedBlocks, replaceBlock} from './sizes.mjs';
import {collect, problems} from './snippets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(join(root, path), 'utf8');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const results = [];

async function check(name, fn) {
  try {
    const failures = (await fn()) ?? [];
    results.push({name, failures});
  } catch (error) {
    results.push({name, failures: [error.message]});
  }
}

const pkg = JSON.parse(await read('package.json'));
const lock = JSON.parse(await read('models.lock.json'));
const readme = await read('README.md');
const site = await read('docs/index.html');
const guides = (await readdir(join(root, 'documentation'))).filter(name => name.endsWith('.md'));
const pages = {'README.md': readme, 'ARCH.md': await read('ARCH.md'), 'docs/index.html': site};
for (const guide of guides) pages[`documentation/${guide}`] = await read(`documentation/${guide}`);

await check('layout', async () => {
  const required = ['README.md', 'ARCH.md', 'LICENSE', 'NOTICE.md', 'models.lock.json', 'Makefile', '.vae/VERIFY.py',
    '.github/workflows/verify.yml', '.githooks/commit-msg', 'docs/index.html', 'docs/.nojekyll', 'bun.lock', 'uv.lock', 'mise.toml'];
  const failures = required.filter(file => !existsSync(join(root, file))).map(file => `missing ${file}`);
  for (const lockfile of ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']) {
    if (existsSync(join(root, lockfile))) failures.push(`${lockfile}: this repository uses bun (bun.lock); delete it`);
  }
  // The runtime is TypeScript: JS or hand-written declarations in src/ would bypass the type checker and the build.
  const walk = async dir => (await readdir(join(root, dir), {withFileTypes: true}))
    .flatMap(entry => entry.isDirectory() ? [] : [`${dir}/${entry.name}`]);
  for (const file of [...await walk('src'), ...await walk('src/packs')]) {
    if (!file.endsWith('.ts') || file.endsWith('.d.ts')) failures.push(`${file}: src/ holds TypeScript sources only`);
  }
  if (existsSync(join(root, '.githooks/commit-msg')) && !(statSync(join(root, '.githooks/commit-msg')).mode & 0o111)) {
    failures.push('.githooks/commit-msg is not executable (chmod +x)');
  }
  return failures;
});

await check('versions', async () => {
  const failures = [];
  const python = /^version = "([^"]+)"/m.exec(await read('pyproject.toml'))?.[1];
  const module = /__version__ = "([^"]+)"/.exec(await read('defuss_lid/__init__.py'))?.[1];
  if (python !== pkg.version) failures.push(`pyproject.toml version ${python} ≠ package.json ${pkg.version}`);
  if (module !== pkg.version) failures.push(`defuss_lid/__init__.py __version__ ${module} ≠ ${pkg.version}`);
  if (!readme.includes(`version      = {${pkg.version}}`)) failures.push(`README citation version ≠ ${pkg.version}`);
  for (const [page, text] of Object.entries(pages)) {
    for (const [, version] of text.matchAll(/defuss-lid@(\d+\.\d+\.\d+)/g)) {
      if (version !== pkg.version) failures.push(`${page}: defuss-lid@${version} ≠ package.json ${pkg.version}`);
    }
  }
  return failures;
});

await check('model-urls', async () => {
  const failures = [];
  for (const [page, text] of Object.entries(pages)) {
    for (const [url, revision, path] of text.matchAll(/https:\/\/huggingface\.co\/kyr0\/defuss-lid-1\.0\/resolve\/([^/\s'"`]+)\/([^\s'"`)<]+)/g)) {
      if (revision !== lock.revision) failures.push(`${page}: ${url} is not pinned to the lock revision ${lock.revision}`);
      if (!lock.files[path]) failures.push(`${page}: ${path} is not a released file (models.lock.json)`);
    }
  }
  return failures;
});

await check('snippets', async () => {
  const blocks = await collect(root);
  const failures = blocks.flatMap(problems);
  const readmeTags = new Set(blocks.filter(b => b.source === 'README.md').flatMap(b => b.tags));
  for (const tag of ['node', 'bun', 'browser', 'install', 'run', 'cli']) {
    if (!readmeTags.has(tag)) failures.push(`README.md has no "${tag}" example; the e2e suite would no longer cover that path`);
  }
  if (!blocks.some(b => b.source === 'docs/index.html' && b.tags.length)) failures.push('docs/index.html has no checked example');
  return failures;
});

await check('registry', async () => {
  const failures = [];
  const {PACKS} = await import(new URL('../dist/packs/index.js', import.meta.url).href);
  for (const pack of Object.values(PACKS)) {
    const locked = lock.files[pack.asset.slice(lock.target.length + 1)];
    if (!locked || locked.bytes !== pack.bytes || locked.sha256 !== pack.sha256) {
      failures.push(`${pack.name}: registry bytes/sha256 differ from models.lock.json`);
    }
    for (const variant of ['node', 'browser']) {
      const source = await read(`src/packs/${pack.name}.${variant}.ts`);
      if (!source.includes(`new URL('../../${pack.asset}', import.meta.url)`)) {
        failures.push(`src/packs/${pack.name}.${variant}.ts: url literal ≠ registry asset ${pack.asset}`);
      }
    }
    for (const condition of ['node', 'default', 'types']) {
      if (!pkg.exports[`./packs/${pack.name}`]?.[condition]) failures.push(`package.json exports ./packs/${pack.name} lacks "${condition}"`);
    }
  }
  if (lock.target !== 'models/v0.3' || !pkg.files.includes(lock.target)) failures.push('package.json files must ship the locked model folder');
  return failures;
});

await check('exports', async () => {
  const failures = [];
  for (const [key, value] of Object.entries(pkg.exports)) {
    for (const target of typeof value === 'string' ? [value] : Object.values(value)) {
      if (target.includes('*')) continue;
      if (!existsSync(join(root, target))) failures.push(`exports["${key}"] → ${target} missing (run bun run build)`);
      if (target.startsWith('./dist/') && target.endsWith('.js')) {
        const source = target.replace('./dist/', 'src/').replace(/\.js$/, '.ts');
        if (!existsSync(join(root, source))) failures.push(`exports["${key}"] → ${target} has no source ${source}`);
      }
    }
  }
  return failures;
});

await check('site-runtime-copy', async () => {
  const expected = await listLibFiles(root);
  const actual = (await listLibFiles(join(root, 'docs/assets/lib')).catch(() => []));
  const failures = [];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push('docs/assets/lib file list differs from dist/ (run bun run docs)');
  for (const file of expected) {
    const [a, b] = await Promise.all([readFile(join(root, file)), readFile(join(root, 'docs/assets/lib', file)).catch(() => Buffer.alloc(0))]);
    if (sha256(a) !== sha256(b)) failures.push(`docs/assets/lib/${file} differs from ${file} (run bun run docs)`);
  }
  // GitHub Pages serves what is committed: an ignore rule over docs/ (a bare `dist/` matched docs/assets/lib/dist/)
  // would publish a site without its runtime while every local check still passes.
  if (existsSync(join(root, '.git'))) {
    const site = (await listLibFiles(root)).map(file => `docs/assets/lib/${file}`).concat('docs/index.html', 'docs/assets/site.js', 'docs/assets/site.css');
    let ignored = '';
    try {
      ignored = execFileSync('git', ['check-ignore', '--no-index', ...site], {cwd: root, encoding: 'utf8'});
    } catch (error) {
      if (error.status !== 1) throw error; // 1 = nothing ignored
    }
    for (const file of ignored.split('\n').filter(Boolean)) failures.push(`${file} is gitignored, so GitHub Pages would not serve it (fix .gitignore)`);
  }
  return failures;
});

await check('site-pins', async () => {
  const failures = [];
  const versions = new Set();
  for (const [tag] of site.matchAll(/<(?:script|link)\b[^>]*>/g)) {
    const url = /(?:src|href)="(https?:\/\/[^"]+)"/.exec(tag)?.[1];
    if (!url || /^<link\b/.test(tag) && !/rel="(?:stylesheet|modulepreload|preload)"/.test(tag)) continue;
    if (!url.startsWith('https://cdn.jsdelivr.net/') && !url.startsWith('https://fonts.')) failures.push(`unexpected external asset host: ${url}`);
    if (url.startsWith('https://cdn.jsdelivr.net/')) {
      const version = /defuss-shadcn@([^/]+)\//.exec(url)?.[1];
      if (!version || !/^\d+\.\d+\.\d+$/.test(version)) failures.push(`unpinned asset (exact version required): ${url}`);
      else versions.add(version);
      if (!/integrity="sha384-[A-Za-z0-9+/=]+"/.test(tag) || !/crossorigin="anonymous"/.test(tag)) failures.push(`asset without SRI: ${url}`);
    }
  }
  if (versions.size > 1) failures.push(`mixed defuss-shadcn versions: ${[...versions].join(', ')}`);
  return failures;
});

await check('generated', async () => {
  // Size, all-in and accuracy figures are computed from dist/, models/ and the report (scripts/sizes.mjs); a block
  // that differs from a fresh computation is stale. Rewriting a block must be a no-op on an up-to-date page.
  const failures = [];
  for (const [file, blocks] of Object.entries(await generatedBlocks())) {
    const text = file === 'README.md' ? readme : site;
    for (const [name, content] of Object.entries(blocks)) {
      if (replaceBlock(text, name, content, file) !== text) failures.push(`${file}: block "${name}" is stale (run node scripts/sizes.mjs --write)`);
    }
  }
  return failures;
});

await check('pack-cards', async () => {
  // Each card names its pack and exact byte count; the e2e suite matches the visible figures against both.
  const {PACKS} = await import(new URL('../dist/packs/index.js', import.meta.url).href);
  return Object.values(PACKS)
    .filter(pack => !site.includes(`data-pack="${pack.name}" data-bytes="${pack.bytes}"`))
    .map(pack => `docs/index.html: ${pack.name} card bytes ≠ ${pack.bytes}`);
});

await check('links', async () => {
  const failures = [];
  const slug = heading => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
  for (const [page, text] of Object.entries(pages)) {
    if (!page.endsWith('.md')) continue;
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const [path, anchor] = target.split('#');
      const file = normalize(join(dirname(join(root, page)), decodeURIComponent(path)));
      if (!existsSync(file)) {
        failures.push(`${page}: broken link ${target}`);
        continue;
      }
      if (anchor && file.endsWith('.md')) {
        const headings = [...(await readFile(file, 'utf8')).matchAll(/^#+ (.+)$/gm)].map(m => slug(m[1]));
        if (!headings.includes(anchor)) failures.push(`${page}: missing anchor ${target}`);
      }
    }
  }
  return failures;
});

await check('no-ai-coauthor', async () => {
  // The maintainer's rule: no AI assistant appears as a co-author in the history. The commit-msg hook blocks new
  // trailers locally; this scans everything that already reached the history (CI checks out the full log).
  let log = '';
  try {
    log = execFileSync('git', ['log', '--format=%H%n%B%n--end--'], {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
  } catch {
    return []; // no commits yet
  }
  const failures = [];
  for (const entry of log.split('--end--\n')) {
    const [hash, ...body] = entry.trim().split('\n');
    if (body.some(line => /^co-authored-by:.*(claude|anthropic)/i.test(line.trim()))) failures.push(`commit ${hash?.slice(0, 12)} has an AI co-author trailer`);
  }
  return failures;
});

let failed = 0;
for (const {name, failures} of results) {
  const ok = failures.length === 0;
  if (!ok) failed++;
  console.log(`${new Date().toISOString()} ${ok ? 'info' : 'error'} check=${name} ${ok ? 'ok' : `failures=${failures.length}`}`);
  for (const failure of failures) console.log(`  - ${failure}`);
}
process.exit(failed ? 1 : 0);
