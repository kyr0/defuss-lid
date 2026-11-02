/**
 * DLID container parser: the numeric file format shared by fastText `.dlid` models and CLD3 `.cld3q` packs.
 *
 * Layout: 8-byte ASCII magic (`DLID0001` or `DLID0002`), a little-endian uint32 header length, a UTF-8 JSON header,
 * zero padding to a 4-byte boundary, then one payload of typed sections described by `header.sections`
 * (`{dtype, shape, offset}` each, offsets relative to the payload start).
 *
 * Why this format instead of fastText's `.ftz` or ONNX: a JSON header plus raw little-endian arrays maps onto typed
 * arrays with zero copies in every JavaScript engine and in NumPy, needs no parser dependency, and records provenance
 * (source hashes, changes, license) next to the weights. The format knows nothing about inference; the runtimes in
 * `index.ts` and `cld3-pack.ts` interpret the sections.
 *
 * Every field is validated before use because model bytes are untrusted input (fetched over the network, possibly
 * truncated or tampered with): a bad file must fail here with a clear error instead of producing out-of-range reads
 * (`undefined` → NaN scores) later in an inference loop.
 *
 * VERIFIED: files written by defuss_lid/format.py load here unchanged; malformed headers fail with format errors
 * (tests/container.test.ts).
 *
 * @module
 */

/** Typed arrays a section can decode to. */
export type TypedArray = Float32Array | Uint32Array | Int32Array | Uint16Array | Uint8Array | Int8Array;

/** Section descriptor in the JSON header. */
export interface SectionDescriptor {
  /** NumPy `dtype.str` without the byte-order prefix: `f4`, `u4`, `i4`, `u2`, `u1` or `i1`. */
  dtype: string;
  shape: number[];
  /** Byte offset from the start of the payload; a multiple of 4. */
  offset: number;
}

/** Fields every container header carries; runtimes extend it with their own metadata. */
export interface ContainerMeta {
  format: 'defuss-lid';
  version: 1 | 2;
  payload_bytes: number;
  sections: Record<string, SectionDescriptor>;
  [key: string]: unknown;
}

/** A parsed container: its header plus one typed-array view (or copy) and shape per section. */
export interface Container<Meta extends ContainerMeta = ContainerMeta> {
  meta: Meta;
  arrays: Record<string, TypedArray>;
  shapes: Record<string, number[]>;
}

/** Bytes as accepted by every loader: an `ArrayBuffer` or any view of one (Node `Buffer`, `Uint8Array`, …). */
export type BinaryInput = ArrayBuffer | ArrayBufferView;

// fatal: a header that is not valid UTF-8 is a corrupt file, not something to repair with U+FFFD.
const decoder = new TextDecoder('utf-8', {fatal: true});

type TypedArrayConstructor =
  | Float32ArrayConstructor | Uint32ArrayConstructor | Int32ArrayConstructor
  | Uint16ArrayConstructor | Uint8ArrayConstructor | Int8ArrayConstructor;

const TYPES: Record<string, TypedArrayConstructor> = {
  f4: Float32Array, u4: Uint32Array, i4: Int32Array, u2: Uint16Array, u1: Uint8Array, i1: Int8Array,
};

/** Magic → the header `version` it must declare. DLID0002 adds int8 classifier rows with per-row scales. */
const VERSIONS: Record<string, 1 | 2> = {DLID0001: 1, DLID0002: 2};

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** View any binary input as bytes without copying. */
export function toBytes(input: BinaryInput): Uint8Array {
  return input instanceof ArrayBuffer
    ? new Uint8Array(input)
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

/**
 * Parse a DLID container into its JSON header and typed arrays.
 *
 * Sections are views into the input buffer whenever their absolute byte position is aligned for the element type, so
 * loading a 700 kB model allocates almost nothing. Unaligned sections are copied, because typed arrays cannot start at
 * unaligned offsets (this happens with Node `Buffer`s carved from a shared pool or taken with `subarray`).
 *
 * @throws Error on a wrong magic, a truncated header, a version or payload size mismatch, an unknown dtype, a section
 *   outside the payload, overlapping sections, or a big-endian host.
 */
export function parseContainer<Meta extends ContainerMeta = ContainerMeta>(input: BinaryInput): Container<Meta> {
  const bytes = toBytes(input);
  if (bytes.length < 12) throw new Error('not a DLID v1/v2 model');
  const magic = String.fromCharCode(...bytes.subarray(0, 8));
  const expectedVersion = VERSIONS[magic];
  if (expectedVersion === undefined) throw new Error('not a DLID v1/v2 model');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = view.getUint32(8, true);
  if (length > bytes.length - 12) throw new Error('truncated model header');
  const meta = JSON.parse(decoder.decode(bytes.subarray(12, 12 + length))) as Meta;
  // A header must be a JSON object with an object of sections; anything else would surface later as a TypeError.
  if (!isRecord(meta) || !isRecord(meta.sections)) throw new Error('invalid model format or payload size');
  const start = 12 + length + ((4 - (length % 4)) % 4);
  // payload_bytes doubles as a truncation check: a partially downloaded model fails here, not mid-inference.
  if (meta.format !== 'defuss-lid' || meta.version !== expectedVersion || meta.payload_bytes !== bytes.length - start) {
    throw new Error('invalid model format or payload size');
  }

  // Sections are stored little-endian; typed arrays use host byte order. Every current JS engine is little-endian,
  // so refusing big-endian hosts is cheaper and safer than byte-swapping every section.
  if (new Uint8Array(new Uint32Array([1]).buffer)[0] !== 1) throw new Error('big-endian JavaScript host is unsupported');

  const arrays: Record<string, TypedArray> = {};
  const shapes: Record<string, number[]> = {};
  const ranges: Array<[number, number]> = [];
  for (const [name, section] of Object.entries(meta.sections)) {
    const Type = isRecord(section) ? TYPES[section.dtype] : undefined;
    if (!Type || !Array.isArray(section.shape) || !section.shape.every(n => Number.isSafeInteger(n) && n >= 0) ||
      !Number.isSafeInteger(section.offset) || section.offset < 0 || section.offset % 4) {
      throw new Error('invalid section');
    }
    const count = section.shape.reduce((a, b) => a * b, 1);
    const end = section.offset + count * Type.BYTES_PER_ELEMENT;
    if (!Number.isSafeInteger(count) || end > meta.payload_bytes) throw new Error('section out of bounds');
    const position = bytes.byteOffset + start + section.offset;
    arrays[name] = position % Type.BYTES_PER_ELEMENT === 0
      ? new Type(bytes.buffer as ArrayBuffer, position, count)
      : new Type(bytes.slice(start + section.offset, start + end).buffer);
    shapes[name] = section.shape;
    if (end > section.offset) ranges.push([section.offset, end]);
  }
  // Overlapping sections would let one tensor silently alias another; legitimate writers never produce them.
  ranges.sort((a, b) => a[0] - b[0]);
  if (ranges.some((range, i) => i > 0 && ranges[i - 1]![1] > range[0])) throw new Error('overlapping sections');
  return {meta, arrays, shapes};
}
