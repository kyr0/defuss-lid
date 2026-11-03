#!/usr/bin/env node
/**
 * Top-1 accuracy of the four packs with and without the letter boost, on the v0.3 benchmark cohorts.
 *
 * Usage: `node scripts/boost_eval.mjs [weights] [--alternatives]` (default `0,default`) after `bun run build`; needs the
 * cohorts in data/v0.3/ (`scripts/reproduce_v03.py` downloads and prepares them). Prints one Markdown row per pack
 * and slice. `--alternatives` also measures the same-language files on the other runtime that the pack cards compare
 * against (scripts/sizes.mjs CHOICES), so both sides of a card can show the default, boosted accuracy.
 *
 * Why the benchmark's own cohorts and slices (data/v0.3/flores-<set>.jsonl, massive-<set>.jsonl; sentences and the
 * first 20 code points): weight 0 must reproduce the accuracy the README reports for each pack, which shows the
 * harness measures the same thing, so the boosted columns differ only by the boost.
 *
 * VERIFIED: weight 0 reproduced the README figures of all four packs on 2026-11-02, and on 2026-11-03 the
 * "Compression results" rows of results-v0.3.md and results-dno-pq.md for the four packs and the four alternatives.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
// `default` is `boost: true`: each runtime's own default weight (BOOST_WEIGHT for fastText, CLD3_BOOST_WEIGHT for CLD3).
const weights = (args.find(arg => !arg.startsWith('--')) ?? '0,default').split(',').map(w => (w === 'default' ? true : Number(w)));
const fromPack = name => async () => (await import(`${root}dist/packs/${name}.node.js`)).load();
const fromFile = file => async () => {
  const bytes = readFileSync(`${root}models/v0.3/${file}`);
  if (!file.endsWith('.cld3q')) return (await import(`${root}dist/index.js`)).LidModel.fromBuffer(bytes);
  const {createCld3Pack} = await import(`${root}dist/cld3-pack.js`);
  return createCld3Pack(bytes, {core: readFileSync(`${root}runtime/cld3-core.bin.gz`)});
};
const PACKS = [['der_3', '3', fromPack('der_3')], ['deferi_6', '6', fromPack('deferi_6')], ['major_20', '20', fromPack('major_20')],
  ['full', 'full', fromPack('full')]];
if (args.includes('--alternatives')) {
  for (const file of ['3/cld3-pq-int8.cld3q', '6/cld3-pq-int8.cld3q', '20/fasttext-native-pq-int8.dlid', 'full/fasttext-native-pq-int8.dlid']) {
    PACKS.push([file, file.split('/')[0], fromFile(file)]);
  }
}
const SLICES = [['FLORES sentences', 'flores', text => text], ['FLORES first 20 code points', 'flores', text => Array.from(text).slice(0, 20).join('')],
  ['MASSIVE utterances', 'massive', text => text]];
const read = file => readFileSync(`${root}data/v0.3/${file}`, 'utf8').trim().split('\n').map(line => JSON.parse(line));

console.log(`| Pack | Slice | ${weights.map(w => (w === true ? 'default boost' : w ? `boost ${w}` : 'no boost')).join(' | ')} |`);
console.log(`| --- | --- | ${weights.map(() => '---:').join(' | ')} |`);
for (const [name, set, load] of PACKS) {
  const pack = await load();
  for (const [label, corpus, slice] of SLICES) {
    const rows = read(`${corpus}-${set}.jsonl`);
    const correct = weights.map(boost => rows.filter(row => pack.predict(slice(row.text), {boost})[0]?.language === row.language).length);
    console.log(`| \`${name}\` | ${label} | ${correct.map(c => `${(100 * c / rows.length).toFixed(2)}%`).join(' | ')} |`);
  }
  pack.dispose?.();
}
