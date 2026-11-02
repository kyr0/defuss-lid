import {describe, expect, test} from 'vitest';
import {parseContainer} from '../src/container.js';
import {writeContainer} from './helpers/dlid.js';

const sections = {
  a: {shape: [3], data: new Float32Array([1, 2, 3])},
  b: {shape: [2, 2], data: new Int8Array([-1, 2, -3, 4])},
};

describe('DLID container', () => {
  test('round-trips the layout written by defuss_lid/format.py', () => {
    const {meta, arrays, shapes} = parseContainer(writeContainer({note: 'ü'}, sections));
    expect(meta.note).toBe('ü');
    expect([...arrays.a!]).toEqual([1, 2, 3]);
    expect(arrays.b).toBeInstanceOf(Int8Array);
    expect([...arrays.b!]).toEqual([-1, 2, -3, 4]);
    expect(shapes).toEqual({a: [3], b: [2, 2]});
  });

  test('aligned sections are views, unaligned input is copied', () => {
    const bytes = writeContainer({}, sections);
    expect(parseContainer(bytes).arrays.a!.buffer).toBe(bytes.buffer);
    const shifted = new Uint8Array(bytes.length + 1);
    shifted.set(bytes, 1);
    const copied = parseContainer(shifted.subarray(1)).arrays.a!;
    expect(copied.buffer).not.toBe(shifted.buffer);
    expect([...copied]).toEqual([1, 2, 3]);
  });

  test('the magic must match the declared version', () => {
    const v2 = writeContainer({}, sections, 'DLID0002');
    expect(parseContainer(v2).meta.version).toBe(2);
    v2.set(new TextEncoder().encode('DLID0001'), 0);
    expect(() => parseContainer(v2)).toThrow(/format or payload/);
  });

  test('malformed files fail with specific errors', () => {
    const valid = writeContainer({}, sections);
    const header = (mutate: (meta: Record<string, any>) => void) => {
      const length = new DataView(valid.buffer).getUint32(8, true);
      const meta = JSON.parse(new TextDecoder().decode(valid.subarray(12, 12 + length)));
      mutate(meta);
      const payload = valid.subarray(12 + length + ((4 - (length % 4)) % 4));
      return writeRaw(meta, payload);
    };
    expect(() => parseContainer(new Uint8Array(10))).toThrow(/not a DLID/);
    expect(() => parseContainer(new TextEncoder().encode('NOTDLID!\0\0\0\0'))).toThrow(/not a DLID/);
    const truncatedHeader = valid.slice(0, 20);
    expect(() => parseContainer(truncatedHeader)).toThrow(/truncated/);
    expect(() => parseContainer(valid.subarray(0, valid.length - 1))).toThrow(/payload size/);
    expect(() => parseContainer(header(m => { m.format = 'other'; }))).toThrow(/format/);
    expect(() => parseContainer(header(m => { m.sections.a.dtype = 'f8'; }))).toThrow(/invalid section/);
    expect(() => parseContainer(header(m => { m.sections.a.offset = 2; }))).toThrow(/invalid section/);
    expect(() => parseContainer(header(m => { m.sections.a.shape = [-1]; }))).toThrow(/invalid section/);
    expect(() => parseContainer(header(m => { m.sections.a.shape = [1000]; }))).toThrow(/out of bounds/);
    expect(() => parseContainer(header(m => { m.sections.b.offset = 4; }))).toThrow(/overlapping/);
    // Header shapes that are valid JSON but not a DLID header (the Python loader rejects the same five cases).
    expect(() => parseContainer(writeRaw([] as never, new Uint8Array(0)))).toThrow(/format/);
    expect(() => parseContainer(header(m => { delete m.sections; }))).toThrow(/format/);
    expect(() => parseContainer(header(m => { m.sections = [m.sections.a]; }))).toThrow(/format/);
    expect(() => parseContainer(header(m => { m.sections.a = null; }))).toThrow(/invalid section/);
    expect(() => parseContainer(header(m => { m.sections.a.shape = 3; }))).toThrow(/invalid section/);
    const badUtf8 = valid.slice();
    badUtf8[13] = 0xff;
    expect(() => parseContainer(badUtf8)).toThrow();
  });
});

/** Re-serialize an edited header in front of an unchanged payload (bypasses the writer's own bookkeeping). */
function writeRaw(meta: Record<string, unknown>, payload: Uint8Array): Uint8Array {
  const header = new TextEncoder().encode(JSON.stringify(meta));
  const pad = (4 - (header.length % 4)) % 4;
  const out = new Uint8Array(12 + header.length + pad + payload.length);
  out.set(new TextEncoder().encode(meta.version === 2 ? 'DLID0002' : 'DLID0001'));
  new DataView(out.buffer).setUint32(8, header.length, true);
  out.set(header, 12);
  out.set(payload, 12 + header.length + pad);
  return out;
}
