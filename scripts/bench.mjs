#!/usr/bin/env node
/**
 * Micro-benchmark for `make bench`: load time and per-prediction latency of each pack and the full fastText model on
 * the native fixture sentences, on the current runtime (`node` or `bun`). Prints one JSON document.
 *
 * Why separate from scripts/benchmark.mjs: that one measures accuracy on downloaded corpora for the reports; this one
 * needs nothing but the release files and answers "did a change make inference slower?" in seconds.
 *
 * VERIFIED: 7.5 to 27.5 µs per fixture sentence on Node.js 26, Apple M-series (make bench, 2026-11-02).
 */
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createCld3Pack} from '../dist/cld3-pack.js';
import {LidModel} from '../dist/index.js';
import {PACKS} from '../dist/packs/index.js';

const root = new URL('../', import.meta.url);
const texts = JSON.parse(readFileSync(new URL('tests/native-fixtures.json', root), 'utf8')).map(item => item.text);
const core = readFileSync(new URL('runtime/cld3-core.bin.gz', root));
const rounds = Number(process.env.ROUNDS || 200);
const models = [
  ...Object.values(PACKS).map(pack => ({name: pack.name, file: pack.asset, cld3: pack.kind === 'cld3-pack'})),
  {name: 'fasttext-176', file: 'models/v0.3/full/fasttext-native-exact.dlid', cld3: false},
];

const results = [];
for (const {name, file, cld3} of models) {
  const bytes = readFileSync(new URL(file, root));
  const loadStart = performance.now();
  const model = cld3 ? await createCld3Pack(bytes, {core}) : LidModel.fromBuffer(bytes, {cacheSize: 0});
  const loadMs = performance.now() - loadStart;
  for (const text of texts) model.predict(text); // warm-up: JIT and, for fastText, nothing cached (cacheSize 0)
  const start = performance.now();
  for (let round = 0; round < rounds; round++) for (const text of texts) model.predict(text);
  const perPrediction = (performance.now() - start) / (rounds * texts.length);
  model.dispose?.();
  results.push({model: name, bytes: bytes.length, load_ms: +loadMs.toFixed(2), predict_us: +(perPrediction * 1000).toFixed(1)});
}
console.log(JSON.stringify({
  measuredAt: new Date().toISOString(), runtime: process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.version}`,
  platform: `${process.platform} ${process.arch}`, sentences: texts.length, rounds, results,
}, null, 2));
