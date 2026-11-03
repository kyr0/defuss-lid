import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';
import {createCld3Pack, loadCld3Pack, reconstructCld3} from '../src/cld3-pack.js';
import {loadCld3} from '../src/cld3.js';
import {parseContainer} from '../src/container.js';
import {model, read, writeContainer, type Section} from './helpers/dlid.js';

const core = read('runtime/cld3-core.bin.gz');
const texts: string[] = JSON.parse(readFileSync(new URL('./native-fixtures.json', import.meta.url), 'utf8')).map((r: {text: string}) => r.text);
const UPSTREAM_WASM_SHA256 = 'fbbc082e3b310b7e25749866ab47e4537f653a85c8d0957bb38a90a150e76641';

describe('CLD3 pack reconstruction', () => {
  test('the raw full pack rebuilds the upstream cld3-asm WASM byte for byte', async () => {
    const {wasm} = await reconstructCld3(model('full/cld3-raw.cld3q'), core);
    expect(createHash('sha256').update(wasm).digest('hex')).toBe(UPSTREAM_WASM_SHA256);
  });

  test('a tampered core is rejected before decompression', async () => {
    const bad = Uint8Array.from(core);
    bad[20]! ^= 1;
    await expect(reconstructCld3(model('full/cld3-raw.cld3q'), bad)).rejects.toThrow(/hash/);
  });

  test('a pack whose labels do not match the pinned columns is rejected', async () => {
    const {meta, arrays, shapes} = parseContainer(model('3/cld3-raw.cld3q'));
    const swapped = {...meta, labels: [...(meta.labels as string[])].reverse()};
    await expect(reconstructCld3(rewrite(swapped, arrays, shapes), core)).rejects.toThrow(/label\/column/);
    await expect(reconstructCld3(rewrite({...meta, architecture: 'other'}, arrays, shapes), core)).rejects.toThrow(/unsupported/);
  });

  test('4-bit PQ codes decode low nibble first', async () => {
    // Re-encode one uint8 embedding table as pq4: 4 groups of 4 dims; centroid c of group g = sub-vector g of row c.
    // Row r uses code r % 16 in every group, so the decoded table must repeat the first 16 rows.
    const {meta, arrays, shapes} = parseContainer(model('full/cld3-raw.cld3q'));
    const name = 'kEmbeddingsWeights0', [rows, cols] = [1000, 16], groups = 4, width = cols / groups;
    const original = arrays[name] as Uint8Array;
    const books = new Uint8Array(groups * 16 * width);
    for (let g = 0; g < groups; g++) for (let c = 0; c < 16; c++) {
      books.set(original.subarray(c * cols + g * width, c * cols + (g + 1) * width), (g * 16 + c) * width);
    }
    const codes = new Uint8Array((rows * groups) / 2);
    for (let i = 0; i < rows * groups; i++) codes[i >> 1]! |= ((Math.floor(i / groups) % 16) << ((i & 1) * 4));
    const tensors = {...(meta.tensors as object), [name]: {target: name, shape: [rows, cols], encoding: 'pq4', groups, centroids: 16, books: 'b4', codes: 'c4'}};
    const packed = rewrite({...meta, method: 'pq4-test', tensors}, {...arrays, b4: books, c4: codes},
      {...shapes, b4: [groups, 16, width], c4: [codes.length]});
    const {wasm} = await reconstructCld3(packed, core);
    const range = (meta.ranges as Array<{name: string; offset: number}>).find(r => r.name === name)!;
    const decoded = wasm.subarray(range.offset, range.offset + rows * cols);
    for (let r = 0; r < rows; r++) expect([...decoded.subarray(r * cols, (r + 1) * cols)], `row ${r}`).toEqual([...original.subarray((r % 16) * cols, (r % 16 + 1) * cols)]);
    const pack = await createCld3Pack(packed, {core});
    try {
      expect(pack.predict('Das ist ein deutscher Satz.')).toHaveLength(1);
    } finally {
      pack.dispose();
    }
  });
});

describe('CLD3 pack inference', () => {
  test('the raw full pack equals the independent npm cld3-asm provider', async () => {
    const actual = await createCld3Pack(model('full/cld3-raw.cld3q'), {core});
    const expected = await loadCld3();
    try {
      for (const text of texts) expect(actual.predict(text), text).toEqual(expected.predict(text));
    } finally {
      actual.dispose();
      expected.dispose();
    }
  });

  test('every v0.3 CLD3 pack predicts within its allowlist', async () => {
    for (const set of ['3', '6', '20', 'full']) {
      for (const name of ['cld3-raw', 'cld3-pq-int8']) {
        const pack = await createCld3Pack(model(`${set}/${name}.cld3q`), {core});
        try {
          expect(pack.predict('Das ist ein deutscher Satz.')[0]!.language).toBe('de');
          for (const text of texts) {
            const [p] = pack.predict(text);
            if (p) {
              expect(pack.meta.labels).toContain(p.language);
              expect(typeof p.reliable).toBe('boolean');
            }
          }
        } finally {
          pack.dispose();
        }
      }
    }
  });

  test('options, errors and lifecycle', async () => {
    const pack = await createCld3Pack(model('20/cld3-pq-int8.cld3q'), {core});
    expect(pack.predict('')).toEqual([]);
    expect(pack.predict('Das ist ein deutscher Satz.', {threshold: 1, boost: false})[0]!.score).toBe(1);
    // An allowlisted pack renormalizes over its labels, so take the threshold from the observed score.
    const ambiguous = pack.predict('Hallo', {boost: false})[0]!.score;
    expect(ambiguous).toBeLessThan(1);
    expect(pack.predict('Hallo', {threshold: ambiguous + (1 - ambiguous) / 2, boost: false})).toEqual([]);
    expect(() => pack.predict('x', {k: 2 as 1})).toThrow(/top-1/);
    expect(() => pack.predict('x', {languages: ['de']} as never)).toThrow(/allowlist/);
    expect(() => pack.predict('x', {threshold: -1})).toThrow(RangeError);
    expect(() => pack.predict('\ud800')).toThrow(/surrogate/);
    expect(() => pack.predict(1 as unknown as string)).toThrow(TypeError);
    pack.dispose();
    pack.dispose();
    expect(() => pack.predict('hello')).toThrow(/disposed/);
    await expect(createCld3Pack(model('20/cld3-pq-int8.cld3q'), {core, minBytes: 20, maxBytes: 20})).rejects.toThrow(/minBytes/);
    await expect(createCld3Pack(model('20/cld3-pq-int8.cld3q'))).rejects.toThrow(/core/);
  });

  test('loadCld3Pack fetches the pack and the core over HTTP', async () => {
    const {createServer} = await import('node:http');
    const files: Record<string, Uint8Array> = {'/pack.cld3q': model('3/cld3-pq-int8.cld3q'), '/core.gz': core};
    const server = createServer((request, response) => {
      const body = files[request.url ?? ''];
      if (body) response.end(body);
      else response.writeHead(404).end();
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
    try {
      const pack = await loadCld3Pack(`${base}/pack.cld3q`, {coreURL: `${base}/core.gz`});
      expect(pack.predict('Как у тебя дела?')[0]!.language).toBe('ru');
      pack.dispose();
      await expect(loadCld3Pack(`${base}/missing`, {coreURL: `${base}/core.gz`})).rejects.toThrow(/404/);
    } finally {
      server.close();
    }
  });

  test('the npm provider validates its options and lifecycle', async () => {
    await expect(loadCld3({minBytes: 5, maxBytes: 5})).rejects.toThrow(RangeError);
    const provider = await loadCld3();
    expect(provider.predict('Das ist ein deutscher Satz.')[0]!.language).toBe('de');
    expect(provider.predict('  ')).toEqual([]);
    expect(provider.predict('ok', {boost: false})[0]!.score).toBeLessThan(0.99);
    expect(provider.predict('ok', {threshold: 0.99, boost: false})).toEqual([]);
    expect(() => provider.predict('hello', {k: 2 as 1})).toThrow(RangeError);
    expect(() => provider.predict('hello', {languages: ['de']} as never)).toThrow(RangeError);
    expect(() => provider.predict('hello', {threshold: 2})).toThrow(RangeError);
    expect(() => provider.predict(1 as unknown as string)).toThrow(TypeError);
    provider.dispose();
    provider.dispose();
    expect(() => provider.predict('hello')).toThrow(/disposed/);
  });
});

/** Write a container from parsed parts, keeping every array's dtype. */
function rewrite(meta: Record<string, unknown>, arrays: Record<string, unknown>, shapes: Record<string, number[]>): Uint8Array {
  const sections: Record<string, Section> = {};
  for (const [name, data] of Object.entries(arrays)) sections[name] = {shape: shapes[name]!, data: data as Section['data']};
  const {format: _format, version: _version, sections: _sections, payload_bytes: _payload, ...rest} = meta;
  return writeContainer(rest, sections);
}
