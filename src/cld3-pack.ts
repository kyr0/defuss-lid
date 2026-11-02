/**
 * Google CLD3 language identification from compact `.cld3q` packs, in Node.js, Bun and browsers.
 *
 * A pack holds only CLD3's weights (optionally product-quantized, int8-quantized and/or restricted to some output
 * labels). At load time the weights are decoded back to CLD3's native float/uint8 layout and written into a pinned,
 * parameter-stripped copy of the cld3-asm 4.0.0 WebAssembly binary (`runtime/cld3-core.bin.gz`). The original
 * feature extraction and dense kernels then run unchanged.
 *
 * Why reconstruct the WASM instead of reimplementing CLD3 in JavaScript: CLD3's feature extraction (script detection,
 * Unicode handling, n-gram features) is intricate C++; reusing the native binary keeps predictions identical to
 * upstream for the raw pack (byte-identical WASM, verified by test) and makes the compressed packs differ only by
 * their weights. The cost, stated plainly: packs shrink download size, not inference memory, because the full
 * native layout is rebuilt before instantiation.
 *
 * Copyright notes: CLD3 code and weights are Apache-2.0 (Google); the WASM build and glue derive from cld3-asm (MIT).
 * See NOTICE.md.
 *
 * VERIFIED: the raw full pack rebuilds the upstream WASM byte for byte and predicts exactly like the npm cld3-asm
 * build (tests/cld3.test.ts).
 *
 * @module
 */
import createModule from '../runtime/cld3-glue.js';
import {CLD3_LAYOUT as pinned} from '../runtime/cld3-layout.js';
import {boostWeight, checkTop1} from './boost.js';
import {type BinaryInput, type ContainerMeta, parseContainer, toBytes, type TypedArray} from './container.js';
import type {Prediction} from './index.js';

export type {BinaryInput, ContainerMeta} from './container.js';

/** A CLD3 result: top-1 language, CLD3's probability and its reliability flag. */
export interface Cld3Prediction extends Prediction {
  /**
   * CLD3's own `is_reliable` flag (computed by the native code from its probability), cleared when another language
   * fits the text's letters better (`letterSupport`), and always `false` for an answer the letter boost substituted.
   */
  reliable: boolean;
}

/** Options of a CLD3 `predict` call. */
export interface Cld3PredictOptions {
  /** CLD3 returns its top language only. */
  k?: 1;
  /** Minimum score in [0, 1] (default 0); with `boost`, it applies to the boosted score. */
  threshold?: number;
  /**
   * Letter boost (default off): the top language's score becomes `score + weight × letterSupport`, and a pack language
   * whose `weight × letterSupport` alone is higher replaces it (with `reliable: false`, since CLD3 never ranked it).
   * Several such languages with the same support replace it only when its own support is 0, taking the first in label
   * order. `true` uses `BOOST_WEIGHT`; a number sets the weight.
   */
  boost?: boolean | number;
}

/** Encoding of one stored tensor. */
export interface Cld3TensorDescriptor {
  target: string;
  shape: number[];
  encoding: 'raw' | 'int8-columns' | 'pq4' | 'pq8';
  /** raw: section name. */
  array?: string;
  /** int8-columns: section names of the int8 values and the per-column float scales. */
  quant?: string;
  scales?: string;
  /** pq4/pq8: section names of the codebooks and codes, sub-vector groups per row, centroids per group (16 | 256). */
  books?: string;
  codes?: string;
  groups?: number;
  centroids?: number;
  /** Output-subset packs store only the kept softmax columns/bias entries; `scatter` restores CLD3's 109 columns. */
  scatter?: 'columns' | 'bias';
}

/** `.cld3q` header fields. */
export interface Cld3PackMeta extends ContainerMeta {
  architecture: 'cld3-wasm-pack';
  method: string;
  labels: string[];
  /** For each label, its column in CLD3's 109-way softmax. */
  output_columns: number[];
  wasm_bytes: number;
  source_wasm_sha256: string;
  core_sha256: string;
  core_gzip_sha256: string;
  core_bytes: number;
  ranges: Array<{name: string; offset: number; bytes: number; dtype: string}>;
  tensors: Record<string, Cld3TensorDescriptor>;
}

export interface Cld3PackOptions {
  /** CLD3's minimum number of UTF-8 bytes to consider (default 0). */
  minBytes?: number;
  /** CLD3's maximum number of UTF-8 bytes to consider (default 10000); longer text is truncated by CLD3. */
  maxBytes?: number;
}

/** A loaded CLD3 pack. Owns WebAssembly memory: call `dispose()` when done. */
export interface Cld3Pack {
  readonly meta: Cld3PackMeta;
  /**
   * Top-1 language of `text`, or `[]` for blank text, CLD3's `und` and results below `threshold`. CLD3 has no k-best
   * output and no runtime language filter: use a pack built with the languages you need.
   */
  predict(text: string, options?: Cld3PredictOptions): Cld3Prediction[];
  /** Free the native model. Idempotent; `predict` throws afterwards. */
  dispose(): void;
}

/** CLD3 always has 109 output columns and a 208-unit hidden layer; packs scatter subsets back into this shape. */
const OUTPUT_COLUMNS = 109;
const HIDDEN_UNITS = 208;
/** CLD3 still emits the old ISO 639 codes `iw` and `fil`; packs and results use `he` and `tl`. */
const RENAMED: Record<string, string> = {iw: 'he', fil: 'tl'};

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function fetchBytes(url: string | URL): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** Decode one stored tensor to the dtype and element count of its native range. */
function decodeTensor(d: Cld3TensorDescriptor, count: number, arrays: Record<string, TypedArray>,
  shapes: Record<string, number[]>): Float32Array | Uint8Array | Uint16Array {
  if (d.encoding === 'raw') {
    const value = arrays[d.array!];
    if (!value || value.length !== count || JSON.stringify(shapes[d.array!]) !== JSON.stringify(d.shape)) {
      throw new Error('invalid raw tensor');
    }
    return value as Float32Array | Uint8Array | Uint16Array;
  }
  if (d.encoding === 'int8-columns') {
    // One float scale per column: dense-layer columns differ in range far more than rows do.
    const cols = d.shape[1]!, quant = arrays[d.quant!], scales = arrays[d.scales!];
    if (d.shape.length !== 2 || !(quant instanceof Int8Array) || quant.length !== count ||
      !(scales instanceof Float32Array) || scales.length !== cols) {
      throw new Error('invalid int8 tensor');
    }
    const value = new Float32Array(count);
    for (let i = 0; i < count; i++) value[i] = quant[i]! * scales[i % cols]!;
    return value;
  }
  if (d.encoding === 'pq4' || d.encoding === 'pq8') {
    // Product quantization of CLD3's uint8 embedding rows: each row is `groups` sub-vectors, each stored as the index
    // of a codebook entry. pq4 packs two 4-bit codes per byte, low nibble first.
    const [rows = 0, cols = 0] = d.shape;
    const groups = d.groups!, centroids = d.centroids!, books = arrays[d.books!], codes = arrays[d.codes!];
    const width = cols / groups;
    if (d.shape.length !== 2 || !Number.isInteger(groups) || groups < 1 || !Number.isInteger(width) ||
      !(books instanceof Uint8Array) || !(codes instanceof Uint8Array) || books.length !== groups * centroids * width ||
      (d.encoding === 'pq4' ? centroids !== 16 : centroids !== 256) ||
      codes.length !== Math.ceil((rows * groups) / (centroids === 16 ? 2 : 1))) {
      throw new Error('invalid PQ tensor');
    }
    const value = new Uint8Array(count);
    for (let row = 0; row < rows; row++) {
      for (let group = 0; group < groups; group++) {
        const i = row * groups + group;
        const code = centroids === 16 ? (codes[i >> 1]! >> ((i & 1) * 4)) & 15 : codes[i]!;
        const offset = (group * centroids + code) * width;
        value.set(books.subarray(offset, offset + width), row * cols + group * width);
      }
    }
    return value;
  }
  throw new Error('unsupported tensor encoding');
}

/**
 * Rebuild the complete CLD3 WebAssembly binary from a pack and the shared core.
 *
 * The core is the cld3-asm 4.0.0 binary with its 16 parameter ranges cut out; the pack supplies those ranges. Both
 * the pack header and the core are checked against the layout pinned in `runtime/cld3-layout.js` (and the core
 * against two SHA-256 hashes) so a pack can never be spliced into a binary it was not built for. For a raw
 * full-inventory pack the result must hash to the upstream binary, which proves the round trip lossless.
 *
 * Output-subset packs restore omitted softmax columns as zero weights with bias -1e9: their probability becomes 0,
 * so CLD3 can only return allowlisted labels, and the remaining probabilities are conditional on the allowlist.
 *
 * @param coreGzip Bytes of `runtime/cld3-core.bin.gz` (still gzip-compressed).
 */
export async function reconstructCld3(input: BinaryInput, coreGzip: BinaryInput):
Promise<{wasm: Uint8Array; meta: Cld3PackMeta}> {
  const {meta: m, arrays, shapes} = parseContainer<Cld3PackMeta>(input);
  if (m.architecture !== 'cld3-wasm-pack' || m.wasm_bytes !== pinned.wasm_bytes || m.source_wasm_sha256 !== pinned.source_wasm_sha256) {
    throw new Error('unsupported CLD3 pack');
  }
  if (!Array.isArray(m.labels) || !m.labels.length || new Set(m.labels).size !== m.labels.length ||
    !Array.isArray(m.output_columns) || m.output_columns.length !== m.labels.length ||
    new Set(m.output_columns).size !== m.output_columns.length ||
    m.output_columns.some(x => !Number.isInteger(x) || x < 0 || x >= OUTPUT_COLUMNS)) {
    throw new Error('invalid output columns');
  }
  if (m.output_columns.some((column, i) => pinned.labels[column] !== m.labels[i])) throw new Error('label/column mismatch');
  if (JSON.stringify(m.ranges) !== JSON.stringify(pinned.ranges) || m.core_sha256 !== pinned.core_sha256 ||
    m.core_gzip_sha256 !== pinned.core_gzip_sha256 || m.core_bytes !== pinned.core_bytes) {
    throw new Error('pack does not match pinned runtime layout');
  }
  const zipped = toBytes(coreGzip);
  if (await sha256Hex(zipped) !== m.core_gzip_sha256) throw new Error('CLD3 core gzip hash mismatch');
  const core = await gunzip(zipped);
  if (core.length !== m.core_bytes || await sha256Hex(core) !== m.core_sha256) throw new Error('CLD3 core hash mismatch');

  // Interleave: core bytes up to a range, then that range's decoded tensor, and so on; the tail of the core last.
  const wasm = new Uint8Array(m.wasm_bytes);
  let written = 0, consumed = 0;
  if (!Array.isArray(m.ranges) || m.ranges.length !== 16) throw new Error('invalid parameter ranges');
  for (const range of m.ranges) {
    if (!Number.isSafeInteger(range.offset) || !Number.isSafeInteger(range.bytes) || range.offset < written ||
      range.bytes < 1 || range.offset + range.bytes > wasm.length) {
      throw new Error('invalid parameter range');
    }
    const d = m.tensors[range.name];
    if (!d || d.target !== range.name || !Array.isArray(d.shape) || d.shape.some(x => !Number.isSafeInteger(x) || x < 1)) {
      throw new Error('invalid tensor descriptor');
    }
    const count = d.shape.reduce((x, y) => x * y, 1);
    if (!Number.isSafeInteger(count) || count > 1_000_000) throw new Error('invalid tensor size');
    let value = decodeTensor(d, count, arrays, shapes);
    if (value instanceof Float32Array && value.some(x => !Number.isFinite(x))) throw new Error('non-finite tensor');
    if (d.scatter === 'columns') {
      if (d.shape[0] !== HIDDEN_UNITS || d.shape[1] !== m.output_columns.length || !(value instanceof Float32Array)) {
        throw new Error('invalid classifier');
      }
      const full = new Float32Array(HIDDEN_UNITS * OUTPUT_COLUMNS), stored = value;
      for (let row = 0; row < HIDDEN_UNITS; row++) {
        m.output_columns.forEach((column, j) => {
          full[row * OUTPUT_COLUMNS + column] = stored[row * m.output_columns.length + j]!;
        });
      }
      value = full;
    } else if (d.scatter === 'bias') {
      if (value.length !== m.output_columns.length || !(value instanceof Float32Array)) throw new Error('invalid classifier bias');
      const full = new Float32Array(OUTPUT_COLUMNS).fill(-1e9), stored = value;
      m.output_columns.forEach((column, j) => {
        full[column] = stored[j]!;
      });
      value = full;
    }
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (bytes.length !== range.bytes) throw new Error('tensor byte size mismatch');
    const gap = range.offset - written;
    if (consumed + gap > core.length) throw new Error('truncated core');
    wasm.set(core.subarray(consumed, consumed + gap), written);
    consumed += gap;
    wasm.set(bytes, range.offset);
    written = range.offset + range.bytes;
  }
  if (core.length - consumed !== wasm.length - written) throw new Error('core layout mismatch');
  wasm.set(core.subarray(consumed), written);
  if (m.method === 'raw' && m.labels.length === OUTPUT_COLUMNS && await sha256Hex(wasm) !== m.source_wasm_sha256) {
    throw new Error('lossless reconstruction failed');
  }
  return {wasm, meta: m};
}

/**
 * Instantiate a CLD3 pack from bytes (works everywhere; Node.js and Bun read both files from disk).
 *
 * @param input `.cld3q` pack bytes.
 * @param options.core Bytes of `runtime/cld3-core.bin.gz`, required.
 */
export async function createCld3Pack(input: BinaryInput,
  {core, minBytes = 0, maxBytes = 10000}: Cld3PackOptions & {core?: BinaryInput} = {}): Promise<Cld3Pack> {
  if (!core) throw new Error('core gzip bytes required');
  if (!Number.isInteger(minBytes) || !Number.isInteger(maxBytes) || minBytes < 0 || maxBytes <= minBytes) {
    throw new RangeError('0 <= minBytes < maxBytes required');
  }
  const {wasm, meta} = await reconstructCld3(input, core);
  // Old Emscripten modules are self-resolving thenables: resolving a Promise with one directly makes the Promise
  // adopt it, which loops forever. Resolve with a wrapper object instead.
  const {module} = await new Promise<{module: ReturnType<typeof createModule>}>((resolve, reject) => {
    const instance = createModule({
      wasmBinary: wasm,
      onRuntimeInitialized() {
        resolve({module: instance});
      },
      onAbort: reject,
    });
  });
  const create = module.cwrap('Cld_create', 'number', ['number', 'number']);
  const destroy = module.cwrap('Cld_destroy', null, ['number']);
  const infer = module.cwrap('Cld_findLanguage', null, ['number', 'number', 'number']);
  const resultSize = module.cwrap('get_SizeLanguageResult', 'number', [])();
  const pointer = create(minBytes, maxBytes);
  let disposed = false;
  return {
    meta,
    predict(text, {k = 1, threshold = 0, languages, boost}: {k?: number; threshold?: number; languages?: unknown; boost?: boolean | number} = {}) {
      if (disposed) throw new Error('CLD3 provider has been disposed');
      if (typeof text !== 'string') throw new TypeError('text must be a string');
      if (k !== 1 || languages !== undefined) throw new RangeError('CLD3 pack supports top-1; use a build-time language allowlist');
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new RangeError('threshold must be in [0,1]');
      const weight = boostWeight(boost);
      // Same reason as the fastText runtime: allocateUTF8 would encode a lone surrogate as U+FFFD.
      for (const char of text) {
        const cp = char.codePointAt(0)!;
        if (cp >= 0xd800 && cp <= 0xdfff) throw new TypeError('unpaired Unicode surrogate');
      }
      if (!text.trim()) return [];
      const input = module.allocateUTF8(text), result = module._malloc(resultSize);
      let languagePointer = 0, ranges = 0, rangeCount = 0;
      try {
        infer(pointer, input, result);
        // Result struct (32-bit WASM): char* language @0, float probability @4, bool reliable @8,
        // int range count @16, range* ranges @20 (offset 12 is not read). The native side allocates the language string
        // and the ranges; the finally block frees them.
        languagePointer = module.getValue(result, '*');
        const raw = module.UTF8ToString(languagePointer), language = RENAMED[raw] ?? raw;
        const score = module.getValue(result + 4, 'float'), reliable = Boolean(module.getValue(result + 8, 'i8'));
        rangeCount = module.getValue(result + 16, 'i32');
        ranges = module.getValue(result + 20, '*');
        if (language === 'und' || !language) return [];
        if (!meta.labels.includes(language)) throw new Error('native result escaped model allowlist');
        const checked = checkTop1(text, meta.labels, {language, score, reliable}, weight);
        return checked.score < threshold ? [] : [checked];
      } finally {
        for (let i = 0; i < rangeCount; i++) module._free(module.getValue(ranges + i * 4, '*'));
        if (ranges) module._free(ranges);
        if (languagePointer) module._free(languagePointer);
        module._free(result);
        module._free(input);
      }
    },
    dispose() {
      if (!disposed) {
        destroy(pointer);
        disposed = true;
      }
    },
  };
}

/**
 * Fetch a `.cld3q` pack and the shared core, then instantiate it (browsers, Bun, Deno).
 *
 * The core defaults to `runtime/cld3-core.bin.gz` next to this package; pass `coreURL` when you serve assets from
 * elsewhere. Serve the `.gz` as plain bytes, without `Content-Encoding: gzip`: the loader verifies the compressed
 * file's hash before decompressing it itself.
 */
export async function loadCld3Pack(url: string | URL,
  {coreURL = new URL('../runtime/cld3-core.bin.gz', import.meta.url), ...options}: Cld3PackOptions & {coreURL?: string | URL} = {}):
Promise<Cld3Pack> {
  const [model, core] = await Promise.all([fetchBytes(url), fetchBytes(coreURL)]);
  return createCld3Pack(model, {...options, core});
}
