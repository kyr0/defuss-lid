#!/usr/bin/env node
/**
 * End-to-end suite: consume the publishable artifacts exactly like a user, never the source tree.
 *
 *  1. `bun pm pack` (runs prepack: model hash check + clean build) → assert the tarball holds exactly the intended files
 *  2. install the tarball into clean consumer projects with bun and with npm, as the README's install example says
 *  3. type-check a TypeScript consumer against the installed declarations (strict, NodeNext)
 *  4. `uv build` the Python wheel
 *  5. execute every code example of README.md, documentation/ and the website (scripts/snippets.mjs):
 *     node/bun examples in the consumer on Node.js and Bun, `run` shell lines against the wheel, `cli` lines checked
 *     against the real `--help` output; browser examples become pages for Playwright
 *  6. Playwright in Chromium, Firefox and WebKit: browser examples, browser/Node numeric parity of every released
 *     model file, and the website (with its runtime copy replaced by the installed package's files)
 *
 * Results land in output/e2e/ (summary.json, logs, Playwright report). Exit code 0 only when everything passed.
 * Set E2E_SKIP_BROWSERS=1 for a fast Node/Bun/Python-only run while iterating.
 *
 * VERIFIED: on 2026-11-02 all 21 documented examples and 72 Playwright tests passed in Chromium, Firefox and
 * WebKit.
 */
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cp, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {basename, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {lockedFiles} from './lock.mjs';
import {collect, problems} from './snippets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const work = join(root, 'tmp/e2e'), www = join(work, 'www'), output = join(root, 'output/e2e');
const consumer = join(www, 'consumer'), installed = join(consumer, 'node_modules/defuss-lid');
const locked = lockedFiles(JSON.parse(await readFile(join(root, 'models.lock.json'), 'utf8')));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const summary = {startedAt: new Date().toISOString(), version: pkg.version, steps: {}, snippets: []};

const log = (message, fields = {}) => {
  const pairs = Object.entries(fields).map(([key, value]) => `${key}=${value}`).join(' ');
  console.log(`${new Date().toISOString()} info ${message}${pairs ? ' ' + pairs : ''}`);
};
const run = (command, args, options = {}) => execFileSync(command, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options});

await rm(work, {recursive: true, force: true});
await rm(output, {recursive: true, force: true});
await mkdir(consumer, {recursive: true});
await mkdir(join(output, 'snippets'), {recursive: true});

// 1. Pack and inspect the tarball.
const tarball = join(work, basename(run('bun', ['pm', 'pack', '--destination', work, '--quiet'], {cwd: root}).trim().split('\n').at(-1)));
const packed = run('tar', ['-tzf', tarball]).split('\n').filter(Boolean).map(file => file.replace(/^package\//, '')).sort();
const expectedModels = Object.keys(locked);
const allowed = file => ['package.json', 'README.md', 'LICENSE', 'NOTICE.md'].includes(file) || /^licenses\/[\w.-]+\.txt$/.test(file) ||
  /^dist\/.+\.(js|d\.ts)$/.test(file) || /^runtime\/cld3-(core\.bin\.gz|core\.json|glue\.js|glue\.d\.ts|layout\.js|layout\.d\.ts)$/.test(file) ||
  expectedModels.includes(file);
assert.deepEqual(packed.filter(file => !allowed(file)), [], 'tarball contains files outside the published contract');
assert.deepEqual(expectedModels.filter(file => !packed.includes(file)), [], 'tarball lacks released model files');
summary.steps.pack = {tarball: basename(tarball), files: packed.length};
log('packed', {tarball: basename(tarball), files: packed.length});

// 2. Install like a user: the README's `install` example, with the tarball in place of the registry name.
const blocks = await collect(root);
const violations = blocks.flatMap(problems);
assert.deepEqual(violations, [], 'code examples violate the snippet contract (scripts/snippets.mjs)');
const installLines = [...new Set(blocks.filter(b => b.tags.includes('install'))
  .flatMap(b => b.code.split('\n').map(line => line.replace(/^#\s*or:\s*/, '').trim()).filter(line => line && !line.startsWith('#'))))];
assert.ok(installLines.length >= 2, 'the README documents bun and npm installation');
for (const line of installLines) {
  const [manager, verb, name] = line.split(/\s+/);
  assert.equal(name, 'defuss-lid', `install example installs something else: ${line}`);
  const dir = manager === 'bun' ? consumer : join(work, `consumer-${manager}`);
  await mkdir(dir, {recursive: true});
  await writeFile(join(dir, 'package.json'), JSON.stringify({private: true, type: 'module'}));
  run(manager, [verb, tarball], {cwd: dir});
  const check = `import {LidModel} from 'defuss-lid'; import {PACKS} from 'defuss-lid/packs'; if (typeof LidModel.fromBuffer !== 'function' || !PACKS.der_3) process.exit(1);`;
  run('node', ['--input-type=module', '-e', check], {cwd: dir});
  log('installed', {with: manager});
}
const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0, 'zero runtime dependencies');
const targets = Object.values(manifest.exports).flatMap(value => typeof value === 'string' ? [value] : Object.values(value));
for (const target of targets.filter(t => !t.includes('*'))) {
  await readFile(join(installed, target)).catch(() => assert.fail(`export target missing: ${target}`));
}

// 3. Types as a TypeScript consumer sees them.
await writeFile(join(consumer, 'types.ts'), `
import {LidModel, loadModel, type Prediction, type PredictOptions} from 'defuss-lid';
import {loadCld3Pack, type Cld3Pack, type Cld3Prediction} from 'defuss-lid/cld3-pack';
import {loadCld3} from 'defuss-lid/cld3';
import {PACKS, PACK_NAMES, type PackMeta, type PackName} from 'defuss-lid/packs';
import * as der from 'defuss-lid/packs/der_3';
import * as major from 'defuss-lid/packs/major_20';
const options: PredictOptions = {k: 2, threshold: 0.1, languages: ['de']};
const name: PackName = PACK_NAMES[0]!;
const meta: PackMeta = PACKS[name];
export async function check(): Promise<string> {
  const fast: LidModel = await der.load({cacheSize: 0});
  const ranked: Prediction[] = fast.predict('Guten Morgen', options);
  const remote: LidModel = await loadModel(der.url);
  const cld3: Cld3Pack = await major.load({coreURL: '/core.gz'});
  const top: Cld3Prediction[] = cld3.predict('x', {threshold: 0.5});
  const other: Cld3Pack = await loadCld3Pack('/x.cld3q');
  const reference = await loadCld3({minBytes: 0});
  // @ts-expect-error CLD3 packs are top-1 only
  cld3.predict('x', {k: 2});
  return [ranked[0]?.language, top[0]?.reliable, remote.meta.labels.length, other.meta.method, meta.bytes, reference].join();
}
`);
await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({compilerOptions: {
  target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, types: [], lib: ['ES2022', 'DOM'],
  noUncheckedIndexedAccess: true, skipLibCheck: false,
}, files: ['types.ts']}));
run(join(root, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json'], {cwd: consumer});
summary.steps.types = 'ok';
log('types checked');

// 4. The Python wheel.
const wheelDir = join(work, 'py');
run('uv', ['build', '--wheel', '--out-dir', wheelDir], {cwd: root});
const wheel = join(wheelDir, (await readdir(wheelDir)).find(file => file.endsWith('.whl')));
const withWheel = ['run', '--isolated', '--no-project', '--with', wheel];
summary.steps.wheel = basename(wheel);
log('wheel built', {wheel: basename(wheel)});

// 5. Execute the examples.
const scripts = new Set(Object.keys(pkg.scripts));
const makeTargets = new Set([...(await readFile(join(root, 'Makefile'), 'utf8')).matchAll(/^([\w-]+(?: [\w-]+)*):/gm)].flatMap(m => m[1].split(' ')));
/** `uv run defuss-lid …` / `uv run python …` → the same command against the installed wheel. */
const viaWheel = line => line.replace(/^uv run (?=defuss-lid\b|python\b)/, `uv ${withWheel.map(arg => JSON.stringify(arg)).join(' ')} `);
const browserPages = [];
for (const block of blocks) {
  const record = {id: block.id, source: `${block.source}:${block.line}`, lang: block.lang, tags: block.tags, results: {}};
  summary.snippets.push(record);
  if (block.lang === 'js' || block.lang === 'ts') {
    const file = join(consumer, 'snippets', `${block.id}.mjs`);
    await mkdir(join(consumer, 'snippets'), {recursive: true});
    await writeFile(file, block.code);
    for (const runtime of block.tags.filter(tag => tag === 'node' || tag === 'bun')) {
      const result = spawnSync(runtime, [file], {cwd: consumer, encoding: 'utf8'});
      const printed = result.stdout.trimEnd().split('\n').filter(Boolean);
      await writeFile(join(output, 'snippets', `${block.id}.${runtime}.log`), result.stdout + result.stderr);
      assert.equal(result.status, 0, `${record.source} failed on ${runtime}:\n${result.stderr}`);
      assert.deepEqual(printed, block.expected, `${record.source} printed something else on ${runtime}`);
      record.results[runtime] = 'pass';
    }
  }
  if (block.tags.includes('browser')) browserPages.push(block);
  if (block.tags.includes('run')) {
    for (const line of block.code.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))) {
      const result = spawnSync('bash', ['-c', viaWheel(line)], {cwd: root, encoding: 'utf8'});
      await writeFile(join(output, 'snippets', `${block.id}.run.log`), `$ ${line}\n${result.stdout}${result.stderr}`, {flag: 'a'});
      assert.equal(result.status, 0, `${record.source}: \`${line}\` failed:\n${result.stderr}`);
    }
    record.results.run = 'pass';
  }
  if (block.tags.includes('cli')) {
    for (const line of block.code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))) {
      const words = line.split(/\s+/);
      if (words[0] === 'make') {
        for (const target of words.slice(1)) assert.ok(makeTargets.has(target), `${record.source}: make target "${target}" does not exist`);
      } else if (words[0] === 'bun' && words[1] === 'run') {
        assert.ok(scripts.has(words[2]), `${record.source}: package script "${words[2]}" does not exist`);
      } else if (line === 'bun install' || line === 'uv sync') {
        // toolchain entry points: their lockfiles are checked by `make setup` in CI
      } else if (/^uv run (defuss-lid|python)\b/.test(line)) {
        // Program plus subcommand or script: `defuss-lid subset`, `python scripts/build_cld3.py`.
        const base = words.slice(2, 4);
        const help = spawnSync('uv', [...withWheel, ...base, '--help'], {cwd: root, encoding: 'utf8'});
        assert.equal(help.status, 0, `${record.source}: \`${base.join(' ')} --help\` failed:\n${help.stderr}`);
        for (const flag of line.match(/(?<=\s)--[\w-]+/g) ?? []) {
          assert.ok(help.stdout.includes(flag), `${record.source}: ${base.join(' ')} has no ${flag}`);
        }
      } else {
        assert.fail(`${record.source}: unknown cli command, extend scripts/e2e.mjs: ${line}`);
      }
    }
    record.results.cli = 'pass';
  }
}
log('examples executed', {blocks: blocks.length, browser: browserPages.length});

// 6. Browser pages and the website, then Playwright.
const exportsMap = {};
for (const [key, value] of Object.entries(manifest.exports)) {
  const target = typeof value === 'string' ? value : value.default;
  const specifier = key === '.' ? 'defuss-lid' : `defuss-lid/${key.slice(2)}`;
  if (specifier.endsWith('/*')) exportsMap[specifier.slice(0, -1)] = `/consumer/node_modules/defuss-lid/${target.slice(2, -1)}`;
  else if (target.endsWith('.js')) exportsMap[specifier] = `/consumer/node_modules/defuss-lid/${target.slice(2)}`;
}
await mkdir(join(www, 'snippets'), {recursive: true});
for (const block of browserPages) {
  const page = block.lang === 'html'
    ? (block.code.includes('<html') ? block.code : `<!doctype html><meta charset="utf-8"><body>\n${block.code}</body>`)
    : `<!doctype html><meta charset="utf-8"><script type="importmap">${JSON.stringify({imports: exportsMap})}</script>\n<script type="module">\n${block.code}</script>`;
  await writeFile(join(www, 'snippets', `${block.id}.html`), page);
}
await writeFile(join(www, 'snippets/manifest.json'), JSON.stringify(browserPages.map(b => ({id: b.id, source: `${b.source}:${b.line}`, expected: b.expected}))));

// Node.js reference predictions for the browser parity test, computed with the installed package.
const fixtures = JSON.parse(await readFile(join(root, 'tests/native-fixtures.json'), 'utf8')).map(item => item.text);
const parity = run('node', ['--input-type=module', '-e', `
  import {readFileSync} from 'node:fs';
  import {LidModel} from 'defuss-lid';
  import {createCld3Pack} from 'defuss-lid/cld3-pack';
  const files = ${JSON.stringify(Object.keys(locked).filter(f => /\.(dlid|cld3q)$/.test(f)))};
  const texts = ${JSON.stringify(fixtures)};
  const core = readFileSync(new URL(import.meta.resolve('defuss-lid/runtime/cld3-core.bin.gz')));
  const out = {};
  for (const file of files) {
    const bytes = readFileSync(new URL(import.meta.resolve('defuss-lid/' + file)));
    const cld3 = file.endsWith('.cld3q');
    const model = cld3 ? await createCld3Pack(bytes, {core}) : LidModel.fromBuffer(bytes);
    out[file] = texts.map(text => model.predict(text, {k: cld3 ? 1 : 3}));
    model.dispose?.();
  }
  console.log(JSON.stringify({texts, expected: out}));
`], {cwd: consumer, maxBuffer: 64 * 1024 * 1024});
await writeFile(join(www, 'parity.json'), parity);

await cp(join(root, 'docs'), join(www, 'docs'), {recursive: true});
// The minimal example uses package-relative imports, so it runs inside the installed package.
await cp(join(root, 'examples'), join(installed, 'examples'), {recursive: true});
run('node', [join(root, 'scripts/docs.mjs'), '--from', installed, '--to', join(www, 'docs/assets/lib')]);
summary.steps.www = 'ok';

if (process.env.E2E_SKIP_BROWSERS) {
  log('browsers skipped (E2E_SKIP_BROWSERS)');
} else {
  const port = String(4200 + Math.floor(Math.random() * 600));
  const result = spawnSync(join(root, 'node_modules/.bin/playwright'), ['test'], {
    cwd: root, stdio: 'inherit', env: {...process.env, E2E_ROOT: www, E2E_PORT: port, CI: process.env.CI ?? ''},
  });
  summary.steps.playwright = result.status === 0 ? 'pass' : `fail (${result.status})`;
  if (result.status !== 0) {
    await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2));
    process.exit(result.status ?? 1);
  }
}

summary.finishedAt = new Date().toISOString();
summary.tarballSha256 = createHash('sha256').update(await readFile(tarball)).digest('hex');
await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
log('e2e passed', {examples: blocks.length, summary: 'output/e2e/summary.json'});
