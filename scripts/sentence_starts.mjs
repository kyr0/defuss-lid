#!/usr/bin/env node
/**
 * Sentence-start discrimination dataset: the first two words of every FLORES-200 and MASSIVE benchmark sentence, as
 * distinct starts per language, with each pack's answer and, for every wrong answer, the measured root cause.
 *
 * Usage: `node scripts/sentence_starts.mjs [out-dir] [--pack name=file.cld3q ...]` after `bun run build`, with the
 * v0.3 cohorts in data/v0.3/ (`scripts/reproduce_v03.py`) and the v0.3 models in models/v0.3/ (`bun run models`).
 * Default out-dir: data/sentence-start-discrimination-flores-massive-dataset/. `--pack major_20=edited.cld3q` measures
 * another file in that pack's place (same cohort and reference), e.g. an edited pack. It
 * writes:
 * - starts.jsonl: one row per language and distinct start: the start as text, its word key, how many FLORES and
 *   MASSIVE sentences begin with it, the benchmark languages whose text contains the same words, and per pack the
 *   answer, the answer with the letter boost, the answer of the uncompressed reference, and the cause;
 * - typical-starts.tsv: the 100 most frequent starts per language;
 * - summary.json: inputs with SHA-256, Node and ICU versions, and every aggregate of REPORT.md;
 * - REPORT.md: accuracy, causes, confusions and the most frequent wrong starts per pack.
 *
 * Words are Unicode word boundaries (Intl.Segmenter, UAX #29 plus ICU's dictionaries for Chinese, Japanese, Thai, Lao,
 * Khmer and Burmese), so languages written without spaces get words too. Why not whitespace: it would make a whole
 * Chinese sentence one "word", and the start would no longer be short. The start text runs from the first word to the
 * end of the second, so leading quotes are dropped and punctuation between the words is kept, as a user would type it.
 *
 * Why these causes, checked in this order for a wrong answer (`classify`):
 * 1. abstain: no answer (CLD3 returns `und`);
 * 2. shared: the two words occur side by side in the predicted language's benchmark text, so the start alone is
 *    evidence for both languages and no identifier can be sure;
 * 3. words: each word occurs in the predicted language's benchmark text, though not side by side;
 * 4. alphabet: the predicted language's letters explain fewer of the start's letters than the true language's
 *    (`letterSupport`), the case the letter boost targets;
 * 5. compression: the exact-subset reference (same labels, uncompressed weights) answers correctly, so pruning or
 *    quantization lost it;
 * 6. unseen: the predicted language has no benchmark text, so causes 2 and 3 cannot be checked (CLD3 knows 109
 *    languages, the benchmarks cover 80): the error may be ambiguity the data cannot show;
 * 7. model: the uncompressed model makes the same mistake, on a start whose words the predicted language's benchmark
 *    text does not contain and whose letters fit the true language at least as well.
 * Ambiguity comes first because a right answer on an ambiguous start is luck, not evidence. The benchmark text is a
 * sample (about 1,000 FLORES and 3,000 MASSIVE sentences per language), so shared and words are lower bounds. Each
 * row also keeps the raw facts (languages sharing the words, reference and boosted answers), so other cuts need no
 * rerun.
 *
 * Packs and references: der_3 and deferi_6 against models/v0.3/<n>/fasttext-native-exact.dlid; major_20 and full
 * against models/v0.3/<n>/cld3-raw.cld3q. A pack is measured on the languages of its own benchmark cohort.
 *
 * VERIFIED: on 2026-11-03 (Node 26.11.1, ICU 78.3) it read 233,584 sentences in 80 languages into 162,919 distinct
 * starts and measured the four packs in about 20 s; tests/sentence-starts.test.ts checks the start and cause rules.
 */
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const PACKS = [
  {name: 'der_3', set: '3', reference: 'fasttext-native-exact.dlid'},
  {name: 'deferi_6', set: '6', reference: 'fasttext-native-exact.dlid'},
  {name: 'major_20', set: '20', reference: 'cld3-raw.cld3q'},
  {name: 'full', set: 'full', reference: 'cld3-raw.cld3q'},
];
const CORPORA = ['flores', 'massive'];
const CAUSES = ['abstain', 'shared', 'words', 'alphabet', 'compression', 'unseen', 'model'];
const segmenters = new Map();

function segmenter(language) {
  let s = segmenters.get(language);
  if (!s) {
    try {
      s = new Intl.Segmenter(language, {granularity: 'word'});
    } catch {
      s = new Intl.Segmenter('und', {granularity: 'word'});
    }
    segmenters.set(language, s);
  }
  return s;
}

/** Word-like segments of `text`, with their offsets; stops after `limit` words. */
export function words(text, language, limit = Infinity) {
  const out = [];
  for (const {segment, index, isWordLike} of segmenter(language).segment(text)) {
    if (!isWordLike) continue;
    out.push({segment, index});
    if (out.length >= limit) break;
  }
  return out;
}

/** Lowercase NFC key of a word sequence: what makes two starts the same, regardless of case and punctuation. */
export const wordKey = list => list.map(w => w.segment.normalize('NFC').toLowerCase()).join(' ');

/**
 * The start of a sentence: the text from its first word to the end of its `n`-th word (fewer if the sentence is
 * shorter), and the start's word key; undefined for text without words.
 */
export function sentenceStart(text, language, n = 2) {
  const first = words(text, language, n);
  if (!first.length) return undefined;
  const last = first.at(-1);
  return {start: text.slice(first[0].index, last.index + last.segment.length), key: wordKey(first), words: first.length};
}

/** Root cause of one answer, by the rules of the module documentation ('correct' when it is right). */
export function classify({truth, prediction, sharedWith, wordsWith, benchmarked, support, referenceCorrect}) {
  if (prediction === truth) return 'correct';
  if (!prediction) return 'abstain';
  if (sharedWith.includes(prediction)) return 'shared';
  if (wordsWith.includes(prediction)) return 'words';
  if ((support.get(prediction) ?? 0) < (support.get(truth) ?? 0)) return 'alphabet';
  if (referenceCorrect) return 'compression';
  return benchmarked.has(prediction) ? 'model' : 'unseen';
}

const percent = (part, whole) => (whole ? `${(100 * part / whole).toFixed(2)}%` : 'n/a');

function readCohorts() {
  const files = {}, rows = new Map(), cohorts = new Map();
  for (const corpus of CORPORA) {
    for (const {set} of PACKS) {
      const file = `data/v0.3/${corpus}-${set}.jsonl`;
      const bytes = readFileSync(join(root, file));
      files[file] = {sha256: createHash('sha256').update(bytes).digest('hex'), rows: 0};
      for (const line of bytes.toString('utf8').split('\n')) {
        if (!line.trim()) continue;
        const row = JSON.parse(line);
        files[file].rows++;
        rows.set(row.id, {corpus, language: row.language, text: row.text});
        if (!cohorts.has(set)) cohorts.set(set, new Set());
        cohorts.get(set).add(row.language);
      }
    }
  }
  return {files, rows: [...rows.values()], cohorts};
}

/** Distinct starts per language, with counts per corpus and the most frequent surface form. */
function collectStarts(rows) {
  const starts = new Map();
  for (const {corpus, language, text} of rows) {
    const s = sentenceStart(text, language);
    if (!s) continue;
    const id = `${language}\t${s.key}`;
    let entry = starts.get(id);
    if (!entry) starts.set(id, entry = {language, key: s.key, words: s.words, flores: 0, massive: 0, forms: new Map()});
    entry[corpus]++;
    entry.forms.set(s.start, (entry.forms.get(s.start) ?? 0) + 1);
  }
  return [...starts.values()].map(({forms, ...entry}) => ({
    ...entry,
    start: [...forms].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
    count: entry.flores + entry.massive,
  }));
}

/**
 * Which benchmark languages contain each start's words: side by side (`pairs`, by start key) and each word anywhere
 * (`vocabulary`, by word). A one-word start is its own pair.
 */
function occurrences(rows, starts) {
  const pairs = new Map(starts.map(s => [s.key, new Set()]));
  const vocabulary = new Map(starts.flatMap(s => s.key.split(' ')).map(w => [w, new Set()]));
  for (const {language, text} of rows) {
    const list = words(text, language).map(w => w.segment.normalize('NFC').toLowerCase());
    for (let i = 0; i < list.length; i++) {
      vocabulary.get(list[i])?.add(language);
      pairs.get(list[i])?.add(language);
      if (i + 1 < list.length) pairs.get(`${list[i]} ${list[i + 1]}`)?.add(language);
    }
  }
  return {pairs, vocabulary};
}

async function loadModels(pack) {
  const {LidModel} = await import(pathToFileURL(join(root, 'dist/index.js')).href);
  const {createCld3Pack} = await import(pathToFileURL(join(root, 'dist/cld3-pack.js')).href);
  const {load} = await import(pathToFileURL(join(root, `dist/packs/${pack.name}.node.js`)).href);
  const core = readFileSync(join(root, 'runtime/cld3-core.bin.gz'));
  const bytes = readFileSync(join(root, `models/v0.3/${pack.set}/${pack.reference}`));
  const reference = pack.reference.endsWith('.dlid') ? LidModel.fromBuffer(bytes) : await createCld3Pack(bytes, {core});
  const model = pack.file ? await createCld3Pack(readFileSync(pack.file), {core}) : await load();
  return {model, reference};
}

const emptyCauses = () => Object.fromEntries(CAUSES.map(c => [c, {starts: 0, sentences: 0, fixedByBoost: 0}]));

async function evaluate(pack, languages, starts, benchmarked, letterSupport) {
  const {model, reference} = await loadModels(pack);
  const total = {starts: 0, sentences: 0}, correct = {starts: 0, sentences: 0}, boosted = {starts: 0, sentences: 0};
  const referenceCorrect = {starts: 0, sentences: 0}, causes = emptyCauses(), confusions = new Map(), perLanguage = {};
  const errors = [];
  // fastText has no reliable flag: null then, so the report does not show a misleading 0.
  let reliableErrors = null;
  const add = (counter, start) => {
    counter.starts++;
    counter.sentences += start.count;
  };
  try {
    for (const start of starts) {
      if (!languages.has(start.language)) continue;
      const [answer] = model.predict(start.start, {boost: false}), [boost] = model.predict(start.start, {boost: true});
      const [ref] = reference.predict(start.start, {boost: false});
      const support = letterSupport(start.start, [start.language, answer?.language ?? start.language]);
      const cause = classify({truth: start.language, prediction: answer?.language, sharedWith: start.sharedWith,
        wordsWith: start.wordsWith, benchmarked, support, referenceCorrect: ref?.language === start.language});
      start.predictions ??= {};
      start.predictions[pack.name] = {language: answer?.language ?? null, score: answer?.score ?? null,
        ...(answer && 'reliable' in answer ? {reliable: answer.reliable} : {}), boosted: boost?.language ?? null,
        reference: ref?.language ?? null, cause};
      const lang = perLanguage[start.language] ??= {starts: 0, sentences: 0, correct: 0, correctSentences: 0,
        causes: Object.fromEntries(CAUSES.map(c => [c, 0]))};
      add(total, start);
      lang.starts++;
      lang.sentences += start.count;
      if (boost?.language === start.language) add(boosted, start);
      if (ref?.language === start.language) add(referenceCorrect, start);
      if (cause === 'correct') {
        add(correct, start);
        lang.correct++;
        lang.correctSentences += start.count;
        continue;
      }
      add(causes[cause], start);
      if (boost?.language === start.language) causes[cause].fixedByBoost++;
      lang.causes[cause]++;
      if (answer && 'reliable' in answer) reliableErrors = (reliableErrors ?? 0) + Number(answer.reliable);
      const id = `${start.language}>${answer?.language ?? 'und'}`;
      const c = confusions.get(id) ?? {truth: start.language, prediction: answer?.language ?? 'und', starts: 0, sentences: 0,
        causes: Object.fromEntries(CAUSES.map(k => [k, 0]))};
      c.starts++;
      c.sentences += start.count;
      c.causes[cause]++;
      confusions.set(id, c);
      errors.push({language: start.language, start: start.start, count: start.count, prediction: answer?.language ?? 'und',
        cause, sharedWith: start.sharedWith, wordsWith: start.wordsWith});
    }
  } finally {
    model.dispose?.();
    reference.dispose?.();
  }
  return {
    pack: pack.name, file: pack.file ?? null, reference: `models/v0.3/${pack.set}/${pack.reference}`, languages: [...languages].sort(), total,
    accuracy: {starts: correct.starts / total.starts, sentences: correct.sentences / total.sentences},
    boosted: {starts: boosted.starts / total.starts, sentences: boosted.sentences / total.sentences},
    referenceAccuracy: {starts: referenceCorrect.starts / total.starts, sentences: referenceCorrect.sentences / total.sentences},
    errors: {starts: total.starts - correct.starts, sentences: total.sentences - correct.sentences, reliable: reliableErrors},
    causes,
    confusions: [...confusions.values()].sort((a, b) => b.sentences - a.sentences).slice(0, 50),
    topErrors: errors.sort((a, b) => b.count - a.count).slice(0, 50),
    perLanguage,
  };
}

function report(summary, startsByLanguage) {
  const lines = ['# Sentence-start discrimination: FLORES-200 and MASSIVE', '',
    `Generated ${summary.generated} by \`scripts/sentence_starts.mjs\` (Node ${summary.node}, ICU ${summary.icu}). `
    + `Inputs: ${summary.sentences} benchmark sentences in ${summary.languages} languages; `
    + `${summary.starts} distinct two-word starts. Causes and their order are defined in the script header.`, '',
    '## Accuracy and causes of the errors, per pack', '',
    'Each distinct start counts once; "sentences" weights it by how many benchmark sentences begin with it.', '',
    '| Pack | Starts | Accuracy (starts) | Accuracy (sentences) | With boost | Reference | Errors | '
    + CAUSES.map(c => `${c}`).join(' | ') + ' | Reliable errors |',
    `| --- | ---: | ---: | ---: | ---: | ---: | ---: | ${CAUSES.map(() => '---:').join(' | ')} | ---: |`];
  for (const p of summary.packs) {
    lines.push(`| \`${p.pack}\` | ${p.total.starts} | ${percent(p.accuracy.starts, 1)} | ${percent(p.accuracy.sentences, 1)} | `
      + `${percent(p.boosted.starts, 1)} | ${percent(p.referenceAccuracy.starts, 1)} | ${p.errors.starts} | `
      + CAUSES.map(c => `${p.causes[c].starts} (${percent(p.causes[c].starts, p.errors.starts)})`).join(' | ')
      + ` | ${p.errors.reliable ?? '-'} |`);
  }
  lines.push('', 'Errors the letter boost fixes, per cause (starts):', '',
    `| Pack | ${CAUSES.join(' | ')} |`, `| --- | ${CAUSES.map(() => '---:').join(' | ')} |`);
  for (const p of summary.packs) {
    lines.push(`| \`${p.pack}\` | ${CAUSES.map(c => `${p.causes[c].fixedByBoost} of ${p.causes[c].starts}`).join(' | ')} |`);
  }
  for (const p of summary.packs) {
    lines.push('', `## \`${p.pack}\``, '', 'Most frequent confusions (true language > answer):', '',
      `| Confusion | Starts | Sentences | ${CAUSES.join(' | ')} |`, `| --- | ---: | ---: | ${CAUSES.map(() => '---:').join(' | ')} |`);
    for (const c of p.confusions.slice(0, 15)) {
      lines.push(`| ${c.truth} > ${c.prediction} | ${c.starts} | ${c.sentences} | ${CAUSES.map(k => c.causes[k]).join(' | ')} |`);
    }
    lines.push('', 'Most frequent wrong starts:', '', '| Language | Start | Sentences | Answer | Cause | Pair (else each word) also in |',
      '| --- | --- | ---: | --- | --- | --- |');
    for (const e of p.topErrors.slice(0, 15)) {
      lines.push(`| ${e.language} | \`${e.start.replaceAll('|', '\\|').replaceAll('`', "'")}\` | ${e.count} | ${e.prediction} | `
        + `${e.cause} | ${(e.sharedWith.length ? e.sharedWith : e.wordsWith).slice(0, 8).join(' ') || '-'} |`);
    }
    lines.push('', 'Per language:', '', `| Language | Starts | Accuracy (starts) | Accuracy (sentences) | ${CAUSES.join(' | ')} |`,
      `| --- | ---: | ---: | ---: | ${CAUSES.map(() => '---:').join(' | ')} |`);
    for (const [language, l] of Object.entries(p.perLanguage).sort((a, b) => a[1].correct / a[1].starts - b[1].correct / b[1].starts)) {
      lines.push(`| ${language} | ${l.starts} | ${percent(l.correct, l.starts)} | ${percent(l.correctSentences, l.sentences)} | `
        + `${CAUSES.map(c => l.causes[c]).join(' | ')} |`);
    }
  }
  lines.push('', '## Languages: distinct starts and typical beginnings', '',
    '"Unique" counts the starts whose two words occur in no other benchmark language\'s text.', '',
    '| Language | Sentences | Distinct starts | Unique | Most frequent starts |', '| --- | ---: | ---: | ---: | --- |');
  for (const [language, list] of [...startsByLanguage].sort()) {
    const sentences = list.reduce((n, s) => n + s.count, 0), unique = list.filter(s => s.unique).length;
    const top = list.slice(0, 5).map(s => `\`${s.start.replaceAll('|', '\\|').replaceAll('`', "'")}\` ${s.count}`).join(', ');
    lines.push(`| ${language} | ${sentences} | ${list.length} | ${percent(unique, list.length)} | ${top} |`);
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const argv = process.argv.slice(2), overrides = new Map();
  for (let i = argv.indexOf('--pack'); i >= 0; i = argv.indexOf('--pack')) {
    const [name, file] = argv.splice(i, 2)[1].split('=');
    if (!PACKS.some(p => p.name === name) || !file) throw new Error(`--pack expects one of ${PACKS.map(p => p.name)}=file`);
    overrides.set(name, file);
  }
  for (const pack of PACKS) pack.file = overrides.get(pack.name);
  const out = argv[0] ?? join(root, 'data/sentence-start-discrimination-flores-massive-dataset');
  const {letterSupport} = await import(pathToFileURL(join(root, 'dist/index.js')).href);
  const {files, rows, cohorts} = readCohorts();
  const starts = collectStarts(rows);
  const {pairs, vocabulary} = occurrences(rows, starts);
  const others = (set, language) => [...set].filter(l => l !== language).sort();
  for (const s of starts) {
    s.sharedWith = others(pairs.get(s.key), s.language);
    const [first, ...rest] = s.key.split(' ').map(w => vocabulary.get(w));
    s.wordsWith = others([...first].filter(l => rest.every(set => set.has(l))), s.language);
    s.unique = s.sharedWith.length === 0;
  }
  const benchmarked = new Set(rows.map(r => r.language));
  starts.sort((a, b) => a.language.localeCompare(b.language) || b.count - a.count || a.key.localeCompare(b.key));
  const packs = [];
  for (const pack of PACKS) {
    const result = await evaluate(pack, cohorts.get(pack.set), starts, benchmarked, letterSupport);
    packs.push(result);
    console.log(`${pack.name}: ${result.total.starts} starts, accuracy ${percent(result.accuracy.starts, 1)}, errors `
      + CAUSES.map(c => `${c} ${result.causes[c].starts}`).join(', '));
  }
  const byLanguage = new Map();
  for (const s of starts) {
    if (!byLanguage.has(s.language)) byLanguage.set(s.language, []);
    byLanguage.get(s.language).push(s);
  }
  const summary = {generated: new Date().toISOString(), node: process.version, icu: process.versions.icu, inputs: files,
    sentences: rows.length, languages: byLanguage.size, starts: starts.length, causes: CAUSES, packs};
  mkdirSync(out, {recursive: true});
  writeFileSync(join(out, 'starts.jsonl'), starts.map(s => JSON.stringify(s)).join('\n') + '\n');
  writeFileSync(join(out, 'typical-starts.tsv'), ['language\trank\tstart\tcount\tflores\tmassive\tunique\tshared_with\twords_with',
    ...[...byLanguage].flatMap(([language, list]) => list.slice(0, 100).map((s, i) =>
      [language, i + 1, s.start.replace(/\s/g, ' '), s.count, s.flores, s.massive, s.unique, s.sharedWith.join(' '),
        s.wordsWith.join(' ')].join('\t')))].join('\n') + '\n');
  writeFileSync(join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(join(out, 'REPORT.md'), report(summary, byLanguage));
  console.log(`wrote ${out}: ${starts.length} starts in ${byLanguage.size} languages from ${rows.length} sentences`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
