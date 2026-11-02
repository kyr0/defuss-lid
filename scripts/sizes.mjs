#!/usr/bin/env node
/**
 * Size and accuracy figures of the README and the website, computed from the built files, the release files and the
 * measured report: `node scripts/sizes.mjs` prints them, `--write` replaces every generated block, and
 * scripts/verify.mjs fails when a block differs from a fresh computation.
 *
 * Generated blocks (between `<!-- NAME:start -->` and `<!-- NAME:end -->`):
 *   README.md        sizes (runtime and pack files), packs (all-in budget, accuracy, same-language alternative)
 *   docs/index.html  budget:<pack> (one card per recommended pack), accuracy (rows of the accuracy table)
 *
 * Why generated: the deciding number for an application is the all-in download, pack plus runtime, and the two
 * runtimes differ by an order of magnitude (fastText is plain JavaScript, CLD3 adds a WebAssembly core). Pack sizes
 * alone made CLD3 look smaller than it is to ship. Every runtime change moves these sums, so hand-written copies go
 * stale after the next refactor; computed ones cannot.
 *
 * VERIFIED: the hand-written figures of the old README (12,482 and 164,801 bytes) no longer matched the built
 * files on 2026-11-02.
 */
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
export const START = '<!-- sizes:start -->';
export const END = '<!-- sizes:end -->';

const kB = bytes => `${(bytes / 1000).toFixed(1)} kB`;
const percent = value => `${value}%`;

/** Raw and on-the-wire (gzip -9) bytes of files; already-compressed files count as stored. */
async function measure(files) {
  const bytes = await Promise.all(files.map(file => readFile(join(root, file))));
  const raw = bytes.reduce((sum, b) => sum + b.length, 0);
  const gzip = bytes.reduce((sum, b, i) => sum + (files[i].endsWith('.gz') ? b.length : gzipSync(b, {level: 9}).length), 0);
  return {raw, gzip};
}

/** What an application loads besides the pack: the fastText JS, or the CLD3 JS plus its WebAssembly core. */
export async function runtimes() {
  const chunks = (await readdir(join(root, 'dist'))).filter(name => /^container-.+\.js$/.test(name)).map(name => `dist/${name}`);
  return {
    fasttext: {label: 'fastText', ...(await measure(['dist/index.js', ...chunks]))},
    cld3: {label: 'CLD3', ...(await measure(['dist/cld3-pack.js', ...chunks, 'runtime/cld3-core.bin.gz']))},
  };
}

/**
 * Rows of the "Compression results" table of the measured report, keyed `set|method`. Only that section is read:
 * later tables share its row shape with other columns (macro-F1), and parsing the whole file let them overwrite it.
 */
export async function reportRows() {
  const report = await readFile(join(root, 'documentation/results-v0.3.md'), 'utf8');
  const section = report.split(/^## /m).find(part => part.startsWith('Compression results\n'));
  if (!section) throw new Error('documentation/results-v0.3.md has no "## Compression results" section');
  const rows = new Map();
  for (const [, set, method, , flores, first20, massive] of section.matchAll(
    /^\| (3|6|20|full) \| ((?:CLD3|fastText)[^|]*?) \| ([\d.]+) \| ([\d.]+) \| ([\d.]+) \| ([\d.]+) \|$/gm)) {
    rows.set(`${set}|${method}`, {flores, first20, massive});
  }
  return rows;
}

/**
 * Each recommended pack with the measured alternative for the same languages on the other runtime. The registry
 * names the pack; the report row and the alternative file follow from its set.
 */
const CHOICES = {
  der_3: {set: '3', method: 'fastText native PQ + int8', alt: {method: 'CLD3 PQ + int8', file: '3/cld3-pq-int8.cld3q'}},
  deferi_6: {set: '6', method: 'fastText native PQ + int8', alt: {method: 'CLD3 PQ + int8', file: '6/cld3-pq-int8.cld3q'}},
  major_20: {set: '20', method: 'CLD3 PQ + int8', alt: {method: 'fastText native PQ + int8', file: '20/fasttext-native-pq-int8.dlid'}},
  full: {set: 'full', method: 'CLD3 PQ + int8', alt: {method: 'fastText native PQ + int8', file: 'full/fasttext-native-pq-int8.dlid'}},
};

/** All figures of the four packs: pack, runtime, all-in (raw and gzip), accuracy, and the same for the alternative. */
export async function packFigures() {
  const {PACKS} = await import(new URL('../dist/packs/index.js', import.meta.url).href);
  const [runtime, rows] = await Promise.all([runtimes(), reportRows()]);
  const figures = [];
  for (const pack of Object.values(PACKS)) {
    const choice = CHOICES[pack.name];
    const describe = async (file, method) => {
      const family = method.startsWith('CLD3') ? runtime.cld3 : runtime.fasttext;
      const size = await measure([file]);
      const scores = rows.get(`${choice.set}|${method}`);
      if (!scores) throw new Error(`documentation/results-v0.3.md has no row for set ${choice.set}, ${method}`);
      return {method, family: family.label, pack: size, runtime: family, allIn: {raw: size.raw + family.raw, gzip: size.gzip + family.gzip}, scores};
    };
    figures.push({
      name: pack.name, languages: [...pack.languages].sort(), kind: pack.kind,
      own: await describe(pack.asset, choice.method),
      alt: await describe(`models/v0.3/${choice.alt.file}`, choice.alt.method),
    });
  }
  return figures;
}

/** README size table: what each file costs. */
export async function sizeTable() {
  const {PACKS} = await import(new URL('../dist/packs/index.js', import.meta.url).href);
  const chunks = (await readdir(join(root, 'dist'))).filter(name => /^container-.+\.js$/.test(name)).map(name => `dist/${name}`);
  const rows = [
    [['dist/index.js', ...chunks], '`dist/index.js` (+ shared chunk)', 'fastText runtime: `LidModel`, `loadModel`'],
    [['dist/cld3-pack.js', ...chunks], '`dist/cld3-pack.js` (+ shared chunk)', 'CLD3 pack runtime with the Emscripten glue'],
    [['runtime/cld3-core.bin.gz'], '`runtime/cld3-core.bin.gz`', 'shared CLD3 WebAssembly core, stored gzip-compressed; once per app'],
    ...Object.values(PACKS).map(pack => [[pack.asset], `\`${pack.name}\``, `${pack.languages.length} languages, ${pack.kind === 'fasttext' ? 'fastText' : 'CLD3'} pack`]),
  ];
  const lines = ['| File | Size | Gzipped | What |', '| --- | ---: | ---: | --- |'];
  for (const [files, name, what] of rows) {
    const {raw, gzip} = await measure(files);
    lines.push(`| ${name} | ${kB(raw)} | ${kB(gzip)} | ${what} |`);
  }
  return lines.join('\n');
}

const languageList = figure => figure.languages.length > 20 ? `${figure.languages.length} CLD3 labels` : figure.languages.join(', ');

/** README packs block: the recommended packs and, below, the same languages on the other runtime. */
export async function packsTable() {
  const figures = await packFigures();
  const head = '| Pack | Languages | Method | Pack | All-in | All-in gzipped | FLORES sentences | FLORES first 20 code points | MASSIVE utterances |';
  const lines = [head, '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
  for (const f of figures) {
    const o = f.own;
    lines.push(`| \`${f.name}\` | ${languageList(f)} | ${o.method} | ${kB(o.pack.raw)} | ${kB(o.allIn.raw)} | ${kB(o.allIn.gzip)} | ${percent(o.scores.flores)} | ${percent(o.scores.first20)} | ${percent(o.scores.massive)} |`);
  }
  lines.push('', 'The same languages on the other runtime, measured in the same run but not shipped as packs:', '',
    '| Languages of | Method | Pack | All-in | All-in gzipped | FLORES sentences | FLORES first 20 code points | MASSIVE utterances |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const f of figures) {
    const a = f.alt;
    lines.push(`| \`${f.name}\` | ${a.method} | ${kB(a.pack.raw)} | ${kB(a.allIn.raw)} | ${kB(a.allIn.gzip)} | ${percent(a.scores.flores)} | ${percent(a.scores.first20)} | ${percent(a.scores.massive)} |`);
  }
  return lines.join('\n');
}

/** Website card block: the pack size, then all-in gzipped, pack, runtime, all-in and accuracy next to the alternative. */
export async function cardBlocks() {
  const figures = await packFigures();
  const blocks = {};
  for (const f of figures) {
    const o = f.own, a = f.alt;
    // Smaller is better for sizes, larger for accuracy; equal values mark neither side.
    const row = (label, mine, theirs, show, lowerIsBetter, total = false) => {
      const better = mine === theirs ? 0 : (mine < theirs) === lowerIsBetter ? 1 : 2;
      const cell = (value, side) => `<td class="table-cell lid-num"${better === side ? ' data-better' : ''}>${show(value)}${better === side ? '<span class="sr-only"> (better)</span>' : ''}</td>`;
      return `<tr class="table-row${total ? ' lid-budget-total' : ''}"><th class="table-head" scope="row">${label}</th>${cell(mine, 1)}${cell(theirs, 2)}</tr>`;
    };
    const scoreRow = (label, key) => row(label, Number(o.scores[key]), Number(a.scores[key]), value => `${value.toFixed(2)}%`, false);
    blocks[`budget:${f.name}`] = [
      `<p class="lid-pack-bytes"><span data-bytes-label>${(o.pack.raw / 1000).toFixed(1)}</span> kB <span class="lid-pack-bytes-note">pack, ${kB(o.allIn.gzip)} all-in gzipped</span></p>`,
      `<table class="table lid-budget" aria-label="${f.name} compared with ${a.family} for the same languages">`,
      `<thead><tr class="table-row"><th class="table-head" scope="col"><span class="sr-only">Figure</span></th><th class="table-head lid-num" scope="col">${f.name}</th><th class="table-head lid-num" scope="col">${a.family} alternative</th></tr></thead>`,
      '<tbody>',
      // gzipped all-in first: what a page downloads from a server that compresses, the figure to decide on
      row('All-in, gzipped', o.allIn.gzip, a.allIn.gzip, kB, true, true),
      row('Pack', o.pack.raw, a.pack.raw, kB, true),
      row('Runtime', o.runtime.raw, a.runtime.raw, kB, true),
      row('All-in', o.allIn.raw, a.allIn.raw, kB, true),
      scoreRow('FLORES sentences', 'flores'),
      scoreRow('First 20 code points', 'first20'),
      scoreRow('MASSIVE utterances', 'massive'),
      '</tbody>',
      '</table>',
    ].join('\n');
  }
  return blocks;
}

/** Website accuracy table body: one row per shipped pack, the same figures as the README packs table. */
export async function accuracyTable() {
  const figures = await packFigures();
  const cell = (value, number = true) => `<td class="table-cell${number ? ' lid-num' : ''}" data-cell>${value}</td>`;
  return figures.map(({name, languages, own: o}) => `<tr class="table-row" data-pack="${name}">${[
    `<th class="table-head" scope="row"><code>${name}</code></th>`,
    cell(languages.length), cell(o.method, false),
    cell((o.pack.raw / 1000).toFixed(1)), cell((o.allIn.raw / 1000).toFixed(1)),
    cell(o.scores.flores), cell(o.scores.first20), cell(o.scores.massive),
  ].join('')}</tr>`).join('\n');
}

/** Every generated block: file → marker name → content. */
export async function generatedBlocks() {
  return {
    'README.md': {sizes: await sizeTable(), packs: await packsTable()},
    'docs/index.html': {...await cardBlocks(), accuracy: await accuracyTable()},
  };
}

/**
 * Replace the content between `<!-- name:start -->` and `<!-- name:end -->`, indented like the start marker, so a
 * write followed by a check is a fixed point. Throws when a marker is missing.
 */
export function replaceBlock(text, name, content, file) {
  const start = `<!-- ${name}:start -->`, end = `<!-- ${name}:end -->`;
  const from = text.indexOf(start), to = text.indexOf(end);
  if (from < 0 || to < from) throw new Error(`${file} lacks ${start} … ${end}`);
  const indent = /[ \t]*$/.exec(text.slice(0, from))[0];
  const body = content.split('\n').map(line => line && indent + line).join('\n');
  return `${text.slice(0, from + start.length)}\n${body}\n${indent}${text.slice(to)}`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const blocks = await generatedBlocks();
  for (const [file, named] of Object.entries(blocks)) {
    let text = await readFile(join(root, file), 'utf8');
    for (const [name, content] of Object.entries(named)) {
      text = replaceBlock(text, name, content, file);
      if (!process.argv.includes('--write')) console.log(`== ${file} ${name}\n${content}\n`);
    }
    if (process.argv.includes('--write')) await writeFile(join(root, file), text);
  }
}
