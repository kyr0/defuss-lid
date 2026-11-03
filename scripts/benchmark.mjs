/**
 * Dataset benchmark used by scripts/reproduce*.py: one model per process (so load time and RSS are per model), every
 * raw prediction retained for paired bootstrap analysis. Runs the built runtime in dist/ (`bun run build` first), the
 * same code the npm package ships. Predictions are the model's own (`boost: false`): the reports this feeds measure
 * compression against exact baselines, and the letter boost, on by default since 2026-11-03, would mix a second
 * change into every paired comparison (scripts/boost_eval.mjs measures the boost separately).
 *
 * UNKNOWN: not rerun since its imports moved to dist/ on 2026-11-02; a run needs the downloaded corpora.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { LidModel } from '../dist/index.js';

const [kind, modelPath, dataset, output, lengthsArg = 'full,20,80',languagesArg] = process.argv.slice(2);
const allowed=languagesArg?languagesArg.split(','):undefined;
if (!kind || !['dlid', 'cld3', 'cld3-pack'].includes(kind) || !output) {
  console.error('Usage: node scripts/benchmark.mjs dlid|cld3|cld3-pack MODEL_OR_DASH DATA.jsonl OUTPUT.json [full,20,80] [allowed,languages]');
  process.exit(2);
}
const lengths = lengthsArg.split(',').map(x => x === 'full' ? null : Number(x));
if (lengths.some(x => x !== null && (!Number.isInteger(x) || x < 1))) throw new Error('invalid lengths');
const raw = fs.readFileSync(dataset);
const records = raw.toString('utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
if (!records.length || records.some(r => typeof r.text !== 'string' || typeof r.language !== 'string' || typeof r.id !== 'string')) throw new Error('invalid dataset');
const rssBefore = process.memoryUsage().rss;
const loadStart = performance.now();
let predict, dispose = () => {}, modelBytes, modelHash, labels, runtimeArtifactBytes = 0, bundleBytes = 0;
if (kind === 'dlid') {
  const bytes = fs.readFileSync(modelPath), m = LidModel.fromBuffer(bytes);
  modelBytes = bytes.length; modelHash = crypto.createHash('sha256').update(bytes).digest('hex');
  labels = m.meta.labels;
  predict = text => m.predict(text,{languages:allowed,boost:false})[0] || {language: 'und', score: 0};
} else if(kind === 'cld3-pack') {
  if(allowed)throw Error('CLD3 allowlists must be built into the pack');
  const {createCld3Pack}=await import('../dist/cld3-pack.js');
  const bytes=fs.readFileSync(modelPath);
  const m=await createCld3Pack(bytes,{core:fs.readFileSync(new URL('../runtime/cld3-core.bin.gz',import.meta.url))});
  labels=m.meta.labels;modelBytes=bytes.length;modelHash=crypto.createHash('sha256').update(bytes).digest('hex');
  predict=text=>m.predict(text,{boost:false})[0]||{language:'und',score:0};dispose=()=>m.dispose();
  runtimeArtifactBytes=['../runtime/cld3-core.bin.gz','../dist/cld3-pack.js',...fs.readdirSync(new URL('../dist/',import.meta.url)).filter(f=>/^container-.+\.js$/.test(f)).map(f=>'../dist/'+f)]
    .reduce((n,p)=>n+fs.statSync(new URL(p,import.meta.url)).size,0);
} else {
  if(allowed)throw Error('unmodified CLD3 wrapper cannot restrict argmax; build a pack');
  const require = createRequire(import.meta.url);
  const {loadModule} = require('cld3-asm');
  const factory = await loadModule();
  // minBytes=0 prevents an arbitrary byte-length gate on the short-text slice.
  const m = factory.create(0, 10000);
  predict = text => {
    const p = m.findLanguage(text);
    return {language: ({iw:'he',fil:'tl'})[p.language] || p.language, score: p.probability, reliable: p.is_reliable};
  };
  dispose = () => m.dispose();
  const base = path.dirname(require.resolve('cld3-asm/package.json'));
  const files = [];
  const walk = dir => {for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    const p = path.join(dir,e.name); if(e.isDirectory()) walk(p); else if(e.name.endsWith('.wasm')) files.push(p);
  }};
  walk(base);
  runtimeArtifactBytes = files.reduce((s,f) => s + fs.statSync(f).size,0);
  // npm's single-file Emscripten build embeds WASM as base64 in a JS file.
  const embedded = path.join(base,'dist/cjs/lib/node/cld3.js');
  const js = fs.readFileSync(embedded);
  const match = js.toString('utf8').match(/var wasmBinaryFile="data:application\/octet-stream;base64,([A-Za-z0-9+/=]+)"/);
  const wasm = match ? Buffer.from(match[1],'base64') : Buffer.concat(files.sort().map(f=>fs.readFileSync(f)));
  runtimeArtifactBytes = wasm.length;
  bundleBytes = js.length;
  // CLD3 embeds weights in WASM. A bare model-only size is unavailable here.
  modelBytes = null;
  modelHash = crypto.createHash('sha256').update(wasm).digest('hex');
}
const loadMs = performance.now()-loadStart, rssAfterLoad = process.memoryUsage().rss;
for (const r of records.slice(0,100)) predict(r.text);
const rows = [], timings = {};
for (const limit of lengths) {
  const name = limit === null ? 'full' : `prefix-${limit}`;
  const elapsed = [];
  for (const r of records) {
    const text = limit === null ? r.text : Array.from(r.text).slice(0,limit).join('');
    const start = performance.now(), p = predict(text), ms = performance.now()-start;
    elapsed.push(ms);
    rows.push({id:r.id, group:r.group||r.id, locale:r.locale, gold:r.language, pred:p.language||'und', score:p.score, slice:name, chars:Array.from(text).length});
  }
  elapsed.sort((a,b)=>a-b);
  const q = p => elapsed[Math.min(elapsed.length-1,Math.floor(p*elapsed.length))];
  timings[name] = {n:elapsed.length,p50_ms:q(.5),p95_ms:q(.95),mean_ms:elapsed.reduce((a,b)=>a+b,0)/elapsed.length};
}
dispose();
const result = {schema:1,kind,model:path.basename(modelPath),model_sha256:modelHash,model_bytes:modelBytes,
  embedded_wasm_bytes:kind==='cld3'?runtimeArtifactBytes:0,shared_runtime_bytes:kind==='cld3-pack'?runtimeArtifactBytes:0,embedded_js_bundle_bytes:bundleBytes,labels,allowed_languages:allowed,load_ms:loadMs,rss_before_load:rssBefore,rss_after_load:rssAfterLoad,
  peak_process_rss_bytes:process.resourceUsage().maxRSS*1024,
  runtime:process.version,bun:process.versions.bun||null,platform:`${os.platform()} ${os.release()} ${os.arch()}`,
  cpu:os.cpus()[0]?.model,dataset_sha256:crypto.createHash('sha256').update(raw).digest('hex'),
  dataset:path.basename(dataset),timings,notes:['single process; 100 full-text warmup calls','CLD3 minBytes=0/maxBytes=10000','prefix slices are artificial crops, not independent short-text data','scores are not calibrated probabilities']};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(output.replace(/\.json$/,'.predictions.jsonl'),rows.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({output,model:result.model,rows:rows.length,timings,model_bytes:modelBytes,embedded_wasm_bytes:result.embedded_wasm_bytes,shared_runtime_bytes:result.shared_runtime_bytes}));
