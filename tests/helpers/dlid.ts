/**
 * Test helpers: read the hash-locked model files and write synthetic DLID containers.
 *
 * Why synthetic containers: no released model uses fp32/int8 embedding rows, a flat softmax, PQ norm codebooks or
 * 4-bit CLD3 codes, yet the runtime supports them. Writing small containers with the same layout as
 * `defuss_lid/format.py` (`save`) lets the tests exercise those paths with hand-computable expected values.
 */
import {readFileSync} from 'node:fs';
import type {TypedArray} from '../../src/container.js';

export const root = new URL('../../', import.meta.url);
// A plain Uint8Array copy: Node's Buffer#slice returns a view, which would let one test mutate another's input.
export const read = (path: string): Uint8Array => new Uint8Array(readFileSync(new URL(path, root)));
export const model = (path: string): Uint8Array => read(`models/v0.3/${path}`);

const DTYPES = new Map<Function, string>([
  [Float32Array, 'f4'], [Uint32Array, 'u4'], [Int32Array, 'i4'], [Uint16Array, 'u2'], [Uint8Array, 'u1'], [Int8Array, 'i1'],
]);

export interface Section {
  shape: number[];
  data: TypedArray;
}

/** Serialize `meta` + sections exactly like format.py: 4-byte aligned sections, padded JSON header. */
export function writeContainer(meta: Record<string, unknown>, sections: Record<string, Section>,
  magic: 'DLID0001' | 'DLID0002' = meta.head_kind === 'int8' ? 'DLID0002' : 'DLID0001'): Uint8Array {
  const described: Record<string, {offset: number; dtype: string; shape: number[]}> = {};
  const chunks: Uint8Array[] = [];
  let offset = 0;
  for (const [name, {shape, data}] of Object.entries(sections)) {
    const padding = (4 - (offset % 4)) % 4;
    chunks.push(new Uint8Array(padding));
    offset += padding;
    described[name] = {offset, dtype: DTYPES.get(data.constructor)!, shape};
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    chunks.push(bytes);
    offset += bytes.length;
  }
  const header = new TextEncoder().encode(JSON.stringify({
    ...meta, format: 'defuss-lid', version: magic === 'DLID0002' ? 2 : 1, sections: described, payload_bytes: offset,
  }));
  const out = new Uint8Array(12 + header.length + ((4 - (header.length % 4)) % 4) + offset);
  out.set(new TextEncoder().encode(magic), 0);
  new DataView(out.buffer).setUint32(8, header.length, true);
  out.set(header, 12);
  let position = 12 + header.length + ((4 - (header.length % 4)) % 4);
  for (const chunk of chunks) {
    out.set(chunk, position);
    position += chunk.length;
  }
  return out;
}

/** A one-word fastText model: vocabulary `["x"]`, no n-grams, so `predict("x")` uses exactly row 0. */
export function tinyFastText(overrides: Record<string, unknown>, sections: Record<string, Section>): Uint8Array {
  return writeContainer({
    labels: ['a', 'b'], words: ['x'], dim: 2, minn: 0, maxn: 0, bucket: 1, kind: 'fp32', loss: 'softmax', ...overrides,
  }, {bucket_ids: {shape: [0], data: new Uint32Array(0)}, ...sections});
}
