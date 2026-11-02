#!/usr/bin/env node
/**
 * Top-1 accuracy of the four packs with and without the letter boost, on the v0.3 benchmark cohorts.
 *
 * Usage: `node scripts/boost_eval.mjs [weights]` (default `0,1`) after `bun run build`; needs the cohorts in
 * data/v0.3/ (`scripts/reproduce_v03.py` downloads and prepares them). Prints one Markdown row per pack and slice.
 *
 * Why the benchmark's own cohorts and slices (data/v0.3/flores-<set>.jsonl, massive-<set>.jsonl; sentences and the
 * first 20 code points): weight 0 must reproduce the accuracy the README reports for each pack, which shows the
 * harness measures the same thing, so the boosted columns differ only by the boost.
 *
 * VERIFIED: weight 0 reproduced the README figures of all four packs on 2026-11-02.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const weights = (process.argv[2] ?? '0,1').split(',').map(Number);
const PACKS = [['der_3', '3'], ['deferi_6', '6'], ['major_20', '20'], ['full', 'full']];
const SLICES = [['FLORES sentences', 'flores', text => text], ['FLORES first 20 code points', 'flores', text => Array.from(text).slice(0, 20).join('')],
  ['MASSIVE utterances', 'massive', text => text]];
const read = file => readFileSync(`${root}data/v0.3/${file}`, 'utf8').trim().split('\n').map(line => JSON.parse(line));

console.log(`| Pack | Slice | ${weights.map(w => (w ? `boost ${w}` : 'no boost')).join(' | ')} |`);
console.log(`| --- | --- | ${weights.map(() => '---:').join(' | ')} |`);
for (const [name, set] of PACKS) {
  const {load} = await import(`${root}dist/packs/${name}.node.js`);
  const pack = await load();
  for (const [label, corpus, slice] of SLICES) {
    const rows = read(`${corpus}-${set}.jsonl`);
    const correct = weights.map(boost => rows.filter(row => pack.predict(slice(row.text), {boost})[0]?.language === row.language).length);
    console.log(`| \`${name}\` | ${label} | ${correct.map(c => `${(100 * c / rows.length).toFixed(2)}%`).join(' | ')} |`);
  }
  pack.dispose?.();
}
