#!/usr/bin/env node
/**
 * Size and accuracy figures of the README and the website, computed from the built files, the release files and the
 * measured reports: `node scripts/sizes.mjs` prints them, `--write` replaces every generated block, and
 * scripts/verify.mjs fails when a block differs from a fresh computation.
 *
 * Generated blocks (between `<!-- NAME:start -->` and `<!-- NAME:end -->`):
 *   README.md        sizes (runtime and pack files), packs (all-in budget, accuracy, same-language alternative)
 *   docs/index.html  meta (page description), stats (the default pack's figures above Google's original weights),
 *                    budget:<pack> (one card per recommended pack), accuracy (rows of the accuracy table)
 *
 * The README reports the model's own accuracy (`boost: false`, "Compression results" of the reports); the website shows
 * what a page gets by default, the letter boost on ("Default results"), on both sides of every comparison, except the
 * Original column of `full`: Google's CLD3 weights as released, which have no letter boost.
 *
 * Why generated: the deciding number for an application is the all-in download, pack plus runtime, and the two
 * runtimes differ by an order of magnitude (fastText is plain JavaScript, CLD3 adds a WebAssembly core). Pack sizes
 * alone made CLD3 look smaller than it is to ship. Every runtime change moves these sums, so hand-written copies go
 * stale after the next refactor; computed ones cannot.
 *
 * VERIFIED: the hand-written figures of the old README (12,482 and 164,801 bytes) no longer matched the built
 * files on 2026-11-02.
 */
import {readFile, writeFile} from 'node:fs/promises';
import {join, posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'fflate';

const root = fileURLToPath(new URL('../', import.meta.url));
export const START = '<!-- sizes:start -->';
export const END = '<!-- sizes:end -->';

const kB = bytes => `${(bytes / 1000).toFixed(1)} kB`;
const percent = value => `${value}%`;

/**
 * Raw and on-the-wire bytes of files; already-compressed files count as stored. The gzip figure uses fflate at level 9,
 * not node:zlib. Why: zlib does not promise the same output across builds, and Node.js updates its bundled zlib in
 * minor releases, so figures computed with node:zlib differ between machines and the gate comparing them fails.
 * fflate is pure JavaScript pinned in bun.lock, so the same bytes give the same figure under every Node.js, Bun and CPU.
 *
 * VERIFIED: node:zlib level 9 compressed models/v0.3/der_3.dlid to 70,341 bytes on Node.js 26.11.1 (zlib 1.2.12) and
 * to 72,047 on 26.13.0 (zlib 1.3.2.1-motley), which CI had installed; fflate gave 71,164 on both and on Bun 1.4.3
 * (2026-11-02).
 */
async function measure(files) {
  const bytes = await Promise.all(files.map(file => readFile(join(root, file))));
  const raw = bytes.reduce((sum, b) => sum + b.length, 0);
  const gzip = bytes.reduce((sum, b, i) => sum + (files[i].endsWith('.gz') ? b.length : gzipSync(b, {level: 9}).length), 0);
  return {raw, gzip};
}

/**
 * A built entry and every chunk it imports, transitively: what loading the entry downloads. Why follow the imports
 * instead of matching chunk names: pkgroll splits shared code into hashed chunks whose number and names change with
 * the source, and a missed chunk under-reports the runtime.
 */
export async function closure(entry) {
  const files = [], queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    if (files.includes(file)) continue;
    files.push(file);
    const code = await readFile(join(root, file), 'utf8');
    for (const [, spec] of code.matchAll(/\b(?:from|import)\s*['"](\.{1,2}\/[^'"]+\.js)['"]/g)) {
      queue.push(posix.join(posix.dirname(file), spec));
    }
  }
  return files;
}

/** What an application loads besides the pack: the fastText JS, or the CLD3 JS plus its WebAssembly core. */
export async function runtimes() {
  return {
    fasttext: {label: 'fastText', ...(await measure(await closure('dist/index.js')))},
    cld3: {label: 'CLD3', ...(await measure([...(await closure('dist/cld3-pack.js')), 'runtime/cld3-core.bin.gz']))},
  };
}

/** The measured reports: v0.3 (every alternative), the CLD3 DNO-PQ packs and the fastText DNO-PQ packs. */
export const REPORTS = ['documentation/results-v0.3.md', 'documentation/results-dno-pq.md', 'documentation/results-fasttext-dno-pq.md'];

/**
 * Rows of one table of the measured reports, keyed `set|method`: "Compression results" (`boost: false`) or "Default
 * results" (letter boost on). Only that section is read: later tables share its row shape with other columns
 * (macro-F1), and parsing the whole file let them overwrite it. A report without the section contributes no rows.
 */
export async function reportRows(heading = 'Compression results') {
  const rows = new Map();
  for (const file of REPORTS) {
    const report = await readFile(join(root, file), 'utf8');
    const section = report.split(/^## /m).find(part => part.startsWith(`${heading}\n`));
    if (!section) continue;
    for (const [, set, method, , flores, first20, massive] of section.matchAll(
      /^\| (3|6|20|full) \| ((?:CLD3|fastText)[^|]*?) \| ([\d.]+) \| ([\d.]+) \| ([\d.]+) \| ([\d.]+) \|$/gm)) {
      if (rows.has(`${set}|${method}`)) throw new Error(`${file}: set ${set}, ${method} is already reported`);
      rows.set(`${set}|${method}`, {flores, first20, massive});
    }
  }
  if (!rows.size) throw new Error(`no report (${REPORTS.join(', ')}) has a "## ${heading}" section`);
  return rows;
}

/** The report with Google's original CLD3 weights, measured on the same rows as the CLD3 DNO-PQ packs. */
const ORIGINAL_REPORT = 'documentation/results-dno-pq.md';
const SLICES = {'FLORES sentences': 'flores', 'FLORES first 20 code points': 'first20', 'MASSIVE utterances': 'massive'};

/**
 * Accuracy of Google's original CLD3 by set, from the "Google original %" column of "Against Google's original CLD3".
 * Why this table and not "Baselines for the same output inventories" of results-v0.3.md: the card compares all three
 * slices, and only this table has the first 20 code points. VERIFIED: the v0.3 baseline table lists FLORES and MASSIVE
 * only, and its full row (97.81, 89.09) equals this table's (2026-11-06).
 * The original has no letter boost: these are the weights as Google released them, so `scores` and `defaults` are the
 * same figures.
 */
export async function originalRows() {
  const report = await readFile(join(root, ORIGINAL_REPORT), 'utf8');
  const section = report.split(/^## /m).find(part => part.startsWith("Against Google's original CLD3\n"));
  if (!section) throw new Error(`${ORIGINAL_REPORT} has no "## Against Google's original CLD3" section`);
  const rows = new Map();
  for (const [, set, slice, value] of section.matchAll(/^\| (20|full) \| ([^|]+?) \| [\d,]+ \| ([\d.]+) \|/gm)) {
    if (!SLICES[slice]) throw new Error(`${ORIGINAL_REPORT}: unknown slice "${slice}"`);
    rows.set(set, {...rows.get(set), [SLICES[slice]]: value});
  }
  for (const [set, row] of rows) {
    const missing = Object.values(SLICES).filter(key => !row[key]);
    if (missing.length) throw new Error(`${ORIGINAL_REPORT}: set ${set} lacks ${missing.join(', ')} for Google's original CLD3`);
  }
  return rows;
}

/**
 * Each recommended pack with the measured alternative for the same languages on the other runtime, and, where a card
 * shows it, the original weights the pack was made from. The registry names the pack; the report rows and the files
 * follow from its set.
 */
const CHOICES = {
  der_3: {set: '3', method: 'fastText DNO-PQ', alt: {method: 'CLD3 PQ + int8', file: '3/cld3-pq-int8.cld3q'}},
  deferi_6: {set: '6', method: 'fastText DNO-PQ', alt: {method: 'CLD3 PQ + int8', file: '6/cld3-pq-int8.cld3q'}},
  major_20: {set: '20', method: 'CLD3 DNO-PQ', alt: {method: 'fastText native PQ + int8', file: '20/fasttext-native-pq-int8.dlid'}},
  full: {
    set: 'full', method: 'CLD3 DNO-PQ', alt: {method: 'fastText native PQ + int8', file: 'full/fasttext-native-pq-int8.dlid'},
    original: {method: 'CLD3 original weights', file: 'full/cld3-raw.cld3q'},
  },
};

/** All figures of the four packs: pack, runtime, all-in (raw and gzip), accuracy, and the same for the comparisons. */
export async function packFigures() {
  const {PACKS} = await import(new URL('../dist/packs/index.js', import.meta.url).href);
  const [runtime, rows, boosted, originals] = await Promise.all([runtimes(), reportRows(), reportRows('Default results'), originalRows()]);
  const figures = [];
  for (const pack of Object.values(PACKS)) {
    const choice = CHOICES[pack.name];
    const describe = async (file, method, scores, defaults) => {
      const family = method.startsWith('CLD3') ? runtime.cld3 : runtime.fasttext;
      const size = await measure([file]);
      if (!scores || !defaults) throw new Error(`the reports (${REPORTS.join(', ')}) lack a row for set ${choice.set}, ${method}`);
      return {method, file, family: family.label, pack: size, runtime: family, allIn: {raw: size.raw + family.raw, gzip: size.gzip + family.gzip}, scores, defaults};
    };
    const measured = (file, method) => describe(file, method, ...[rows, boosted].map(table => table.get(`${choice.set}|${method}`)));
    const original = choice.original && originals.get(choice.set);
    figures.push({
      name: pack.name, languages: [...pack.languages].sort(), kind: pack.kind,
      own: await measured(pack.asset, choice.method),
      alt: await measured(`models/v0.3/${choice.alt.file}`, choice.alt.method),
      original: choice.original && await describe(`models/v0.3/${choice.original.file}`, choice.original.method, original, original),
    });
  }
  return figures;
}

/** README size table: what each file costs. */
export async function sizeTable() {
  const {PACKS} = await import(new URL('../dist/packs/index.js', import.meta.url).href);
  const rows = [
    [await closure('dist/index.js'), '`dist/index.js` (+ shared chunks)', 'fastText runtime: `LidModel`, `loadModel`, `letterSupport`'],
    [await closure('dist/cld3-pack.js'), '`dist/cld3-pack.js` (+ shared chunks)', 'CLD3 pack runtime with the Emscripten glue'],
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

/**
 * Website card block: the pack size, then all-in gzipped, pack, runtime, all-in and accuracy next to the original
 * weights (where the card shows them) and the alternative on the other runtime.
 */
export async function cardBlocks() {
  const figures = await packFigures();
  const blocks = {};
  for (const f of figures) {
    const o = f.own, a = f.alt;
    const columns = [{figure: o, head: f.name}, ...(f.original ? [{figure: f.original, head: 'Original'}] : []), {figure: a, head: `${a.family} alternative`}];
    // Smaller is better for sizes, larger for accuracy; only a value no other column reaches is marked. Why the unique
    // best and not "better than the pack": with three columns a pairwise mark is ambiguous, and with two columns the
    // unique best is exactly the old pair rule (equal values mark neither side).
    const row = (label, pick, show, lowerIsBetter, total = false) => {
      const values = columns.map(({figure}) => pick(figure));
      const best = lowerIsBetter ? Math.min(...values) : Math.max(...values);
      const marked = values.filter(value => value === best).length === 1 ? values.indexOf(best) : -1;
      const cell = (value, i) => `<td class="table-cell lid-num"${i === marked ? ' data-better' : ''}>${show(value)}${i === marked ? '<span class="sr-only"> (better)</span>' : ''}</td>`;
      return `<tr class="table-row${total ? ' lid-budget-total' : ''}"><th class="table-head" scope="row">${label}</th>${values.map(cell).join('')}</tr>`;
    };
    const scoreRow = (label, key) => row(label, figure => Number(figure.defaults[key]), value => `${value.toFixed(2)}%`, false);
    const compared = f.original ? `Google's original CLD3 and ${a.family}` : a.family;
    blocks[`budget:${f.name}`] = [
      `<p class="lid-pack-bytes"><span data-bytes-label>${(o.pack.raw / 1000).toFixed(1)}</span> kB <span class="lid-pack-bytes-note">pack, ${kB(o.allIn.gzip)} all-in gzipped</span></p>`,
      `<table class="table lid-budget" aria-label="${f.name} compared with ${compared} for the same languages">`,
      `<thead><tr class="table-row"><th class="table-head" scope="col"><span class="sr-only">Figure</span></th>${columns.map(({head}) => `<th class="table-head lid-num" scope="col">${head}</th>`).join('')}</tr></thead>`,
      '<tbody>',
      // gzipped all-in first: what a page downloads from a server that compresses, the figure to decide on
      row('All-in, gzipped', figure => figure.allIn.gzip, kB, true, true),
      row('Pack', figure => figure.pack.raw, kB, true),
      row('Runtime', figure => figure.runtime.raw, kB, true),
      row('All-in', figure => figure.allIn.raw, kB, true),
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
    cell(o.defaults.flores), cell(o.defaults.first20), cell(o.defaults.massive),
  ].join('')}</tr>`).join('\n');
}

/**
 * The pack the demo opens with and the hero features: every CLD3 label, the size a page downloads (gzipped). Why
 * `full` and not `major_20`: the maintainer chose the pack that covers open-ended input (2026-11-06), and the demo's
 * samples still work with it. VERIFIED: `full` identifies each of the 20 demo samples as its own language, reliable,
 * with the default letter boost (Node.js probe, 2026-11-06; the e2e demo test checks the same in three browsers).
 */
const FEATURED = 'full';
/** The page description's second pack: the smallest CLD3 pack for widely used languages. */
const SMALL = 'major_20';

/**
 * Labels of a CLD3 pack file, as the runtime reads them from its container. Why load the file instead of reusing the
 * featured pack's registry entry: the original's count must come from the original's own file, or the comparison
 * would show the pack against itself. VERIFIED: full/cld3-raw.cld3q and full.cld3q both list the same 109 labels
 * (Node.js probe, 2026-11-06).
 */
async function cld3Labels(file) {
  const {createCld3Pack} = await import(new URL('../dist/cld3-pack.js', import.meta.url).href);
  const [pack, core] = await Promise.all([readFile(join(root, file)), readFile(join(root, 'runtime/cld3-core.bin.gz'))]);
  const model = await createCld3Pack(pack, {core});
  try {
    return model.meta.labels;
  } finally {
    model.dispose();
  }
}

/**
 * Website head: the page description, and the band of the featured pack's figures, each above the same figure of
 * Google's original weights. The original has no letter boost, so the accuracy labels say the boost is the pack's.
 */
export async function heroBlocks() {
  const figures = Object.fromEntries((await packFigures()).map(f => [f.name, f]));
  const top = figures[FEATURED], small = figures[SMALL], original = top.original;
  if (!original) throw new Error(`${FEATURED} has no original weights to compare with (CHOICES.${FEATURED}.original)`);
  const originalLabels = await cld3Labels(original.file);
  const size = bytes => `${(bytes / 1000).toFixed(1)}&nbsp;kB`;
  const plain = bytes => `${(bytes / 1000).toFixed(1)} kB`;
  const stat = (value, versus, label) => `<div class="mk-stat"><span class="mk-stat-value">${value}</span><span class="lid-stat-vs">vs. original</span><span class="lid-stat-original">${versus}</span><span class="mk-stat-label">${label}</span></div>`;
  const boost = 'with the letter boost, which the original lacks';
  return {
    meta: `<meta name="description" content="Language identification with pretrained fastText and Google CLD3 models, compressed into small language packs: all ${top.languages.length} CLD3 labels in ${plain(top.own.pack.gzip)} gzipped, ${small.languages.length} languages in ${plain(small.own.pack.gzip)}. Runs in Node.js, Bun and browsers, with no inference service.">`,
    stats: [
      stat(size(top.own.pack.gzip), size(original.pack.gzip), `gzipped pack file for all ${top.languages.length} CLD3 labels (<code>${FEATURED}</code>), plus its WebAssembly runtime`),
      stat(`${top.own.defaults.first20}%`, `${original.defaults.first20}%`, `<code>${FEATURED}</code> top-1 on the first 20 code points of FLORES sentences, ${boost}`),
      stat(`${top.own.defaults.flores}%`, `${original.defaults.flores}%`, `<code>${FEATURED}</code> top-1 on FLORES sentences, ${boost}`),
      stat(String(top.languages.length), String(originalLabels.length), 'languages and dialects'),
    ].join('\n'),
  };
}

/** Every generated block: file → marker name → content. */
export async function generatedBlocks() {
  return {
    'README.md': {sizes: await sizeTable(), packs: await packsTable()},
    'docs/index.html': {...await heroBlocks(), ...await cardBlocks(), accuracy: await accuracyTable()},
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
