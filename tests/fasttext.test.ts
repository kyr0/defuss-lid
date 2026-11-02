import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';
import {bucketIds, hashBytes, LidModel, loadModel} from '../src/index.js';
import {model, tinyFastText} from './helpers/dlid.js';

/** Released lid.176.ftz coefficients, repacked (byte-identical to the former models/fasttext-176.dlid). */
const FULL = 'full/fasttext-native-exact.dlid';
const fixtures: Array<{text: string; language: string; score: number; hidden: number[]}> =
  JSON.parse(readFileSync(new URL('./native-fixtures.json', import.meta.url), 'utf8'));

describe('fastText hashing', () => {
  test('matches fastText signed-byte FNV-1a', () => {
    expect(hashBytes(new TextEncoder().encode('hello'))).toBe(1335831723);
    // A byte ≥ 0x80 is XORed as a sign-extended char (-1), not as 255.
    expect(hashBytes(new Uint8Array([255]))).toBe(Math.imul(2166136261 ^ -1, 16777619) >>> 0);
  });

  test('n-grams count code points, skip the bare boundary markers and EOS', () => {
    // "<ä>" with minn 2, maxn 4: "<ä", "<ä>", "ä>" (the single "ä" is kept only for minn 1).
    expect(bucketIds('ä', 2, 4, 100)).toHaveLength(3);
    expect(bucketIds('ä', 1, 1, 100)).toHaveLength(1);
    expect(bucketIds('</s>', 2, 4, 100)).toEqual([]);
    expect(bucketIds('abc', 2, 4, 100)).toEqual(bucketIds('abc', 2, 4, 100));
    expect(bucketIds('abc', 0, 0, 100)).toEqual([]);
  });
});

describe('released full model', () => {
  const bytes = model(FULL);
  const lid = LidModel.fromBuffer(bytes);

  test('identifies languages and abstains on empty input', () => {
    expect(lid.predict('')).toEqual([]);
    expect(lid.predict('   \t ')).toEqual([]);
    // Only fastText's separators make text blank; U+FEFF and U+001C are word characters to fastText (and to the
    // Python runtime, which uses the same rule).
    expect(lid.predict(' \t\n\r\v\f\0')).toEqual([]);
    expect(lid.predict('\ufeff')[0]!.language).toBe('en');
    expect(lid.predict('\u001c')).toHaveLength(1);
    expect(lid.predict('Das ist ein deutscher Satz.')[0]!.language).toBe('de');
    expect(lid.predict('Hello, how are you today?')[0]!.language).toBe('en');
    expect(lid.predict('Как у тебя дела?')[0]!.language).toBe('ru');
    expect(lid.meta.labels).toHaveLength(176);
  });

  test('k-best is sorted, bounded by k and by the threshold', () => {
    // An ambiguous text keeps several labels above fastText's 1e-5 floor.
    const top = lid.predict('la casa', {k: 5});
    expect(top).toHaveLength(5);
    expect(top.map(p => p.score)).toEqual(top.map(p => p.score).sort((a, b) => b - a));
    expect(top[0]).toEqual(lid.predict('la casa')[0]);
    expect(lid.predict('la casa', {k: 5, threshold: 0.5}).map(p => p.language)).toEqual(['es']);
    expect(lid.predict('la casa', {threshold: 0.9})).toEqual([]);
    // Like fastText, labels below probability 1e-5 are never reported, even with threshold 0.
    expect(lid.predict('Das ist ein deutscher Satz.', {k: 5}).map(p => p.language)).toEqual(['de']);
  });

  test('restricting languages changes the argmax but never renormalizes', () => {
    const text = 'Bonjour tout le monde.';
    const all = lid.predict(text, {k: 176});
    const restricted = lid.predict(text, {k: 2, languages: ['de', 'en']});
    expect(restricted.map(p => p.language).sort()).toEqual(['de', 'en']);
    for (const p of restricted) expect(p.score).toBe(all.find(q => q.language === p.language)!.score);
    expect(lid.predict(text, {languages: ['en']})[0]!.language).toBe('en');
  });

  test('tokenization follows the fastText stream reader', () => {
    const base = lid.features('Guten Morgen');
    expect(lid.features('Guten\nMorgen')).toEqual(base);
    expect(lid.features('Guten \t\r\v\f\0 Morgen')).toEqual(base);
    expect(lid.features('__label__en Guten Morgen')).toEqual(base);
    // A literal EOS ends the input; text after it is ignored.
    expect(lid.features('Guten Morgen </s> ignored words')).toEqual(base);
  });

  test('rejects invalid arguments with typed errors', () => {
    expect(() => lid.predict('\ud800')).toThrow(TypeError);
    expect(() => lid.predict(42 as unknown as string)).toThrow(TypeError);
    expect(() => lid.predict('hello', {k: 0})).toThrow(RangeError);
    expect(() => lid.predict('hello', {k: 1.5})).toThrow(RangeError);
    expect(() => lid.predict('hello', {threshold: Number.NaN})).toThrow(RangeError);
    expect(() => lid.predict('hello', {threshold: 1.5})).toThrow(RangeError);
    expect(() => lid.predict('x', {languages: []})).toThrow(/languages/);
    expect(() => lid.predict('x', {languages: ['xx']})).toThrow(/languages/);
    expect(() => lid.predict('x', {languages: ['en', 'en']})).toThrow(/languages/);
    expect(() => LidModel.fromBuffer(bytes, {cacheSize: -1})).toThrow(RangeError);
  });

  test('unaligned input, disabled cache and ArrayBuffer input give identical results', () => {
    const unaligned = new Uint8Array(bytes.length + 1);
    unaligned.set(bytes, 1);
    const text = 'Wie geht es dir?';
    expect(LidModel.fromBuffer(unaligned.subarray(1)).predict(text)).toEqual(lid.predict(text));
    expect(LidModel.fromBuffer(bytes, {cacheSize: 0}).predict(text)).toEqual(lid.predict(text));
    const copy = bytes.slice().buffer;
    expect(LidModel.fromBuffer(copy).predict(text)).toEqual(lid.predict(text));
    // A cache smaller than the vocabulary of the text evicts and still returns the same features.
    const small = LidModel.fromBuffer(bytes, {cacheSize: 1});
    expect(small.features('eins zwei drei eins')).toEqual(lid.features('eins zwei drei eins'));
  });

  test('a truncated file is rejected', () => {
    expect(() => LidModel.fromBuffer(bytes.subarray(0, bytes.length - 1))).toThrow(/payload size/);
  });

  test('matches native fastText within the documented tolerance', () => {
    expect(fixtures.length).toBeGreaterThan(10);
    for (const item of fixtures) {
      const p = lid.predict(item.text)[0]!;
      expect(p.language, item.text).toBe(item.language);
      expect(Math.abs(p.score - item.score), item.text).toBeLessThan(3e-5);
      const hidden = lid.hidden(lid.features(item.text));
      for (let i = 0; i < hidden.length; i++) expect(Math.abs(hidden[i]! - item.hidden[i]!), item.text).toBeLessThan(1e-4);
    }
  });

  test('loadModel fetches over HTTP and reports HTTP errors', async () => {
    const {createServer} = await import('node:http');
    const server = createServer((request, response) => {
      if (request.url === '/model.dlid') response.end(bytes);
      else response.writeHead(404).end();
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const {port} = server.address() as {port: number};
    try {
      const fetched = await loadModel(`http://127.0.0.1:${port}/model.dlid`);
      expect(fetched.predict('Guten Morgen!')).toEqual(lid.predict('Guten Morgen!'));
      await expect(loadModel(`http://127.0.0.1:${port}/missing.dlid`)).rejects.toThrow(/404/);
    } finally {
      server.close();
    }
  });
});

describe('v0.3 fastText packs', () => {
  const sets = {'3': 3, '6': 6, '20': 20, full: 176} as const;
  for (const [set, size] of Object.entries(sets)) {
    for (const name of ['fasttext-pq-int8', 'fasttext-native-pq-int8']) {
      test(`${set}/${name}: int8 classifier, inventory and predictions`, () => {
        const m = LidModel.fromBuffer(model(`${set}/${name}.dlid`));
        expect(m.meta.labels).toHaveLength(size);
        expect(m.meta.head_kind).toBe('int8');
        expect(m.arrays.head).toBeInstanceOf(Int8Array);
        for (const [text, label] of [['Das ist ein deutscher Satz.', 'de'], ['Hello, how are you today?', 'en'], ['Как у тебя дела?', 'ru']]) {
          expect(m.predict(text!)[0]!.language).toBe(label);
          expect(m.predict(text!, {k: 176}).every(p => m.meta.labels.includes(p.language))).toBe(true);
        }
        const zeroScales = {...m.arrays, head_scales: new Float32Array(m.arrays.head_scales!.length)};
        expect(() => new LidModel(m.meta, zeroScales, m.shapes)).toThrow(/int8 classifier/);
      });
    }
  }

  test('an exact label subset scores like the full model restricted to its labels', () => {
    // HS scores depend only on each label's own tree path, so dropping other labels must not change any score.
    const full = LidModel.fromBuffer(model(FULL));
    for (const set of ['3', '6', '20']) {
      const subset = LidModel.fromBuffer(model(`${set}/fasttext-native-exact.dlid`));
      expect(subset.meta.loss).toBe('hs-subset');
      for (const {text} of fixtures) {
        const expected = full.predict(text, {k: 5, languages: subset.meta.labels});
        const actual = subset.predict(text, {k: 5});
        expect(actual.map(p => p.language), text).toEqual(expected.map(p => p.language));
        actual.forEach((p, i) => expect(p.score).toBeCloseTo(expected[i]!.score, 12));
      }
    }
  });

  test('feature-pruned packs keep fewer rows and never emit an excluded label', () => {
    const exact = LidModel.fromBuffer(model('3/fasttext-native-exact.dlid'));
    const pruned = LidModel.fromBuffer(model('3/fasttext-native-pq-int8.dlid'));
    expect(pruned.arrays.codes!.length).toBeLessThan(exact.arrays.codes!.length);
    for (const {text} of fixtures) for (const p of pruned.predict(text, {k: 10})) expect(exact.meta.labels).toContain(p.language);
  });
});

describe('synthetic models: paths no released file uses', () => {
  const head = (logit: number) => ({head: {shape: [2, 2], data: new Float32Array([logit, 0, 0, 0])}});
  const vector = {vectors: {shape: [1, 2], data: new Float32Array([1, 0])}};

  test('flat softmax: threshold applies to the probability, as in fastText Loss::findKBest', () => {
    // p(a) = sigmoid(z) for logits [z, 0]; pick z so p(a) sits 5e-6 below / above the threshold 0.6.
    const logit = (p: number) => Math.log(p / (1 - p));
    const below = LidModel.fromBuffer(tinyFastText({}, {...vector, ...head(logit(0.6 - 5e-6))}));
    const above = LidModel.fromBuffer(tinyFastText({}, {...vector, ...head(logit(0.6 + 5e-6))}));
    expect(below.predict('x')[0]!.score).toBeCloseTo(0.6 - 5e-6 + 1e-5, 6);
    expect(below.predict('x', {threshold: 0.6})).toEqual([]);
    expect(above.predict('x', {threshold: 0.6}).map(p => p.language)).toEqual(['a']);
    expect(above.predict('x', {k: 2}).reduce((sum, p) => sum + p.score, 0)).toBeCloseTo(1 + 2e-5, 6);
  });

  test('int8 embedding rows are scaled per row', () => {
    const m = LidModel.fromBuffer(tinyFastText({kind: 'int8'}, {
      vectors: {shape: [1, 2], data: new Int8Array([4, -2])},
      scales: {shape: [1], data: new Float32Array([0.5])},
      ...head(1),
    }));
    expect([...m.hidden([0])]).toEqual([2, -1]);
    expect([...m.hidden([])]).toEqual([0, 0]);
  });

  test('PQ rows with a norm codebook decode as norm × codebook sub-vectors', () => {
    const books = new Float32Array(2 * 256 * 1);
    books[3] = 0.5; // group 0, centroid 3
    books[256 + 7] = -2; // group 1, centroid 7
    const normBook = new Float32Array(256);
    normBook[9] = 4;
    const m = LidModel.fromBuffer(tinyFastText({kind: 'optic'}, {
      books: {shape: [2, 256, 1], data: books},
      codes: {shape: [1, 2], data: new Uint8Array([3, 7])},
      norm_codes: {shape: [1], data: new Uint8Array([9])},
      norm_book: {shape: [256], data: normBook},
      ...head(1),
    }));
    expect([...m.hidden(m.features('x'))]).toEqual([2, -8]);
  });

  test('hierarchical softmax over a two-leaf tree', () => {
    // Root node 2 has children left = label 0, right = label 1, so p(b) = sigmoid(z) and p(a) = 1 - sigmoid(z).
    const m = LidModel.fromBuffer(tinyFastText({loss: 'hs'}, {
      ...vector,
      head: {shape: [2, 2], data: new Float32Array([2, 0, 0, 0])},
      left: {shape: [1], data: new Int32Array([0])},
      right: {shape: [1], data: new Int32Array([1])},
    }));
    const p = 1 / (1 + Math.exp(-2));
    const [first, second] = m.predict('x', {k: 2});
    expect(first).toEqual({language: 'b', score: expect.closeTo(p + 1e-5, 12)});
    expect(second).toEqual({language: 'a', score: expect.closeTo(1 - p + 1e-5, 12)});
  });

  test('corrupt models fail at load time with a specific error', () => {
    const valid = {...vector, ...head(1)};
    const cases: Array<[Record<string, unknown>, Record<string, never> | Record<string, unknown>, RegExp]> = [
      [{labels: ['a', 'a']}, {}, /labels or words/],
      [{kind: 'nope'}, {}, /unsupported model/],
      [{dim: 0}, {}, /dimensions/],
      [{maxn: 40}, {}, /dimensions/],
      [{}, {head: {shape: [2, 3], data: new Float32Array(6)}}, /invalid classifier/],
      [{head_kind: 'int4'}, {}, /classifier encoding/],
      [{}, {bucket_ids: {shape: [2], data: new Uint32Array([0, 0])}}, /bucket mapping/],
      [{}, {vectors: {shape: [1, 2], data: new Float32Array([Number.NaN, 0])}}, /non-finite/],
      [{}, {vectors: {shape: [2, 1], data: new Float32Array(2)}}, /invalid vectors/],
      [{kind: 'pq'}, {codes: {shape: [1, 2], data: new Uint8Array(2)}, books: {shape: [2, 16, 1], data: new Float32Array(32)}}, /codebooks/],
      [{loss: 'hs'}, {left: {shape: [1], data: new Int32Array([0])}, right: {shape: [1], data: new Int32Array([0])}}, /invalid tree/],
      [{loss: 'hs'}, {}, /invalid tree/],
      [{loss: 'hs-subset'}, {}, /subset paths/],
    ];
    for (const [meta, sections, error] of cases) {
      expect(() => LidModel.fromBuffer(tinyFastText(meta, {...valid, ...sections})), error.source).toThrow(error);
    }
  });

  test('hs-subset path tables are validated', () => {
    const paths = (offsets: number[], nodes: number[], sides: number[]) => ({
      ...vector, ...head(1),
      path_offsets: {shape: [offsets.length], data: new Uint32Array(offsets)},
      path_nodes: {shape: [nodes.length], data: new Uint32Array(nodes)},
      path_sides: {shape: [sides.length], data: new Uint8Array(sides)},
    });
    const ok = LidModel.fromBuffer(tinyFastText({loss: 'hs-subset'}, paths([0, 1, 2], [0, 0], [0, 1])));
    const [b, a] = ok.predict('x', {k: 2});
    expect(a!.score + b!.score).toBeCloseTo(1 + 2e-5, 5);
    expect(() => LidModel.fromBuffer(tinyFastText({loss: 'hs-subset'}, paths([0, 3, 2], [0, 0], [0, 1])))).toThrow(/offsets/);
    expect(() => LidModel.fromBuffer(tinyFastText({loss: 'hs-subset'}, paths([0, 1, 2], [0, 5], [0, 1])))).toThrow(/subset path/);
  });
});
