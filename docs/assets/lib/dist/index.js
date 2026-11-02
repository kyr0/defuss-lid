import { b as boostWeight, l as letterSupport } from './boost-Bsc1WEV_.js';
export { B as BOOST_WEIGHT } from './boost-Bsc1WEV_.js';
import { p as parseContainer } from './container-sM-fBKLB.js';

const encoder = new TextEncoder();
const EPSILON = 1e-5;
function fnvStep(hash, byte) {
  return Math.imul(hash ^ (byte < 128 ? byte : byte - 256), 16777619) >>> 0;
}
function hashBytes(bytes) {
  let hash = 2166136261;
  for (const byte of bytes) hash = fnvStep(hash, byte);
  return hash;
}
function bucketIds(word, minn, maxn, bucket) {
  if (word === "</s>" || maxn === 0) return [];
  const chars = ["<", ...word, ">"].map((char) => encoder.encode(char));
  const ids = [];
  for (let i = 0; i < chars.length; i++) {
    let hash = 2166136261;
    for (let j = i; j < Math.min(i + maxn, chars.length); j++) {
      for (const byte of chars[j]) hash = fnvStep(hash, byte);
      const n = j - i + 1;
      if (n >= minn && !(n === 1 && (i === 0 || j === chars.length - 1))) ids.push(hash % bucket);
    }
  }
  return ids;
}
function binarySearch(sorted, value) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = lo + hi >>> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return sorted[lo] === value ? lo : -1;
}
function assertText(text) {
  if (typeof text !== "string") throw new TypeError("text must be a string");
  for (const char of text) {
    const cp = char.codePointAt(0);
    if (cp >= 55296 && cp <= 57343) throw new TypeError("unpaired Unicode surrogate");
  }
}
const WORD_CHARACTER = /[^ \t\n\r\v\f\0]/;
function sigmoid(z) {
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}
const shapeIs = (shape, expected) => JSON.stringify(shape) === JSON.stringify(expected);
class LidModel {
  meta;
  arrays;
  shapes;
  /** Dictionary word → row index; rows of retained hash buckets follow after all words. */
  words;
  cache = /* @__PURE__ */ new Map();
  cacheSize;
  constructor(meta, arrays, shapes, { cacheSize = 2048 } = {}) {
    if (!Number.isInteger(cacheSize) || cacheSize < 0) throw new RangeError("invalid cache size");
    this.meta = meta;
    this.arrays = arrays;
    this.shapes = shapes;
    this.words = new Map(meta.words.map((word, i) => [word, i]));
    this.cacheSize = cacheSize;
    this.validate();
  }
  /** Parse and validate model bytes (`.dlid`, DLID0001 or DLID0002). */
  static fromBuffer(input, options) {
    const { meta, arrays, shapes } = parseContainer(input);
    return new LidModel(meta, arrays, shapes, options);
  }
  /**
   * Check every invariant inference relies on: label/word uniqueness, supported kinds, dimensions, array types and
   * shapes, sorted in-range bucket ids, positive int8 scales, finite weights, and a complete Huffman tree (or valid
   * subset paths). Called by the constructor; throws `Error` on the first violation.
   */
  validate() {
    const m = this.meta, a = this.arrays, d = m.dim, l = m.labels.length;
    if (l < 1 || new Set(m.labels).size !== l || this.words.size !== m.words.length) throw new Error("invalid labels or words");
    if (!["fp32", "int8", "pq", "task-pq", "optic"].includes(m.kind) || !["hs", "hs-subset", "softmax"].includes(m.loss)) {
      throw new Error("unsupported model");
    }
    if (![d, m.minn, m.maxn, m.bucket].every(Number.isInteger) || d < 1 || d > 4096 || m.minn < 0 || m.maxn < m.minn || m.maxn > 32 || m.bucket < 1) {
      throw new Error("invalid dimensions");
    }
    const ids = a.bucket_ids, head = this.shapes.head;
    if (!(ids instanceof Uint32Array) || head?.length !== 2 || head[1] !== d || m.loss !== "hs-subset" && !shapeIs(head, [l, d])) {
      throw new Error("invalid classifier");
    }
    if (m.head_kind === "int8") {
      const scales = a.head_scales;
      if (!(a.head instanceof Int8Array) || !(scales instanceof Float32Array) || !shapeIs(this.shapes.head_scales, [head[0]]) || scales.some((x) => x <= 0)) {
        throw new Error("invalid int8 classifier/scales");
      }
    } else if (m.head_kind !== void 0 && m.head_kind !== "fp32" || !(a.head instanceof Float32Array) || a.head_scales) {
      throw new Error("invalid classifier encoding");
    }
    if (m.loss === "hs-subset") {
      const { path_offsets: offsets, path_nodes: nodes, path_sides: sides } = a;
      if (!(offsets instanceof Uint32Array) || !(nodes instanceof Uint32Array) || !(sides instanceof Uint8Array) || offsets.length !== l + 1 || offsets[0] !== 0 || offsets[l] !== nodes.length || sides.length !== nodes.length) {
        throw new Error("invalid subset paths");
      }
      for (let i = 1; i < offsets.length; i++) if (offsets[i] < offsets[i - 1]) throw new Error("invalid subset offsets");
      for (let i = 0; i < nodes.length; i++) if (nodes[i] >= head[0] || sides[i] > 1) throw new Error("invalid subset path");
    }
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] >= m.bucket || i > 0 && ids[i] <= ids[i - 1]) throw new Error("invalid bucket mapping");
    }
    const rows = this.words.size + ids.length;
    if (m.kind === "fp32" || m.kind === "int8") {
      if (!shapeIs(this.shapes.vectors, [rows, d]) || m.kind === "int8" && !shapeIs(this.shapes.scales, [rows])) {
        throw new Error("invalid vectors");
      }
    } else {
      const [groups = 0, count, width = 0] = this.shapes.books ?? [];
      if (groups * width !== d || count !== 256 || !shapeIs(this.shapes.codes, [rows, groups]) || !(a.codes instanceof Uint8Array)) {
        throw new Error("invalid codebooks");
      }
      if (a.norm_codes && (!shapeIs(this.shapes.norm_codes, [rows]) || !shapeIs(this.shapes.norm_book, [256]))) {
        throw new Error("invalid norm quantizer");
      }
    }
    for (const value of Object.values(a)) {
      if (value instanceof Float32Array && value.some((x) => !Number.isFinite(x))) throw new Error("non-finite weights");
    }
    if (m.loss === "hs") {
      if (!shapeIs(this.shapes.left, [l - 1]) || !shapeIs(this.shapes.right, [l - 1])) throw new Error("invalid tree");
      const left = a.left, right = a.right;
      const visited = /* @__PURE__ */ new Set(), stack = [2 * l - 2];
      while (stack.length) {
        const node = stack.pop();
        if (!Number.isInteger(node) || node < 0 || node >= 2 * l - 1 || visited.has(node)) throw new Error("invalid tree");
        visited.add(node);
        if (node >= l) stack.push(left[node - l], right[node - l]);
      }
      if (visited.size !== 2 * l - 1) throw new Error("incomplete tree");
    }
  }
  /**
   * Embedding rows of one word: its dictionary row (if any) plus one row per retained n-gram bucket.
   *
   * Pruned models keep only some buckets; `bucket_ids` lists them sorted, and a bucket that is absent simply
   * contributes nothing, exactly as if its row had been zero. Results are memoized in a FIFO cache because real text
   * repeats words; FIFO (not LRU) keeps lookups free of bookkeeping writes.
   */
  wordFeatures(word) {
    const cached = this.cache.get(word);
    if (cached) return cached;
    const ids = [], m = this.meta;
    const row = this.words.get(word);
    if (row !== void 0) ids.push(row);
    const bucketRows = this.arrays.bucket_ids;
    for (const id of bucketIds(word, m.minn, m.maxn, m.bucket)) {
      const index = binarySearch(bucketRows, id);
      if (index >= 0) ids.push(this.words.size + index);
    }
    if (this.cacheSize) {
      if (this.cache.size >= this.cacheSize) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(word, ids);
    }
    return ids;
  }
  /**
   * Embedding row ids of a text, in fastText's order.
   *
   * Tokenization follows fastText's stream reader: words are split on ASCII space, tab, CR, VT, FF and NUL; tokens
   * starting with `__label__` are skipped; a literal `</s>` ends the input; one `</s>` is appended otherwise. A newline
   * counts as a space, deliberately: fastText would stop at the first newline, but a caller passing a paragraph wants
   * one prediction for all of it. No case folding or Unicode normalization is added, because the released model was
   * trained without it.
   */
  features(text) {
    assertText(text);
    const result = [];
    let ended = false;
    for (const word of text.replaceAll("\n", " ").split(/[ \t\r\v\f\0]+/)) {
      if (!word) continue;
      if (!word.startsWith("__label__")) for (const id of this.wordFeatures(word)) result.push(id);
      if (word === "</s>") {
        ended = true;
        break;
      }
    }
    if (!ended) for (const id of this.wordFeatures("</s>")) result.push(id);
    return result;
  }
  /**
   * The text vector: the mean of the given embedding rows (fastText's `computeHidden`).
   *
   * Product-quantized rows are decoded on the fly (codebook sub-vectors, times the row's quantized norm when the model
   * stores one), so a compressed model is never expanded in memory. Accumulation is float64 for stability.
   */
  hidden(ids) {
    const m = this.meta, a = this.arrays, d = m.dim, result = new Float64Array(d);
    if (m.kind === "fp32" || m.kind === "int8") {
      const vectors = a.vectors, scales = a.scales;
      for (const id of ids) {
        const scale = m.kind === "int8" ? scales[id] : 1;
        for (let j = 0; j < d; j++) result[j] += vectors[id * d + j] * scale;
      }
    } else {
      const [groups = 0, , width = 0] = this.shapes.books;
      const codes = a.codes, books = a.books, normCodes = a.norm_codes, normBook = a.norm_book;
      for (const id of ids) {
        const norm = normCodes ? normBook[normCodes[id]] : 1;
        for (let g = 0; g < groups; g++) {
          const base = (g * 256 + codes[id * groups + g]) * width;
          for (let j = 0; j < width; j++) result[g * width + j] += norm * books[base + j];
        }
      }
    }
    if (ids.length) for (let j = 0; j < d; j++) result[j] /= ids.length;
    return result;
  }
  /**
   * Per-label scores for a text vector, in label order.
   *
   * - `hs`: hierarchical softmax over the Huffman tree; a label's score is the product of branch probabilities on its
   *   path, each with fastText's +1e-5 inside the log.
   * - `hs-subset`: the same products, but only along the stored paths of the retained labels. Why this works: a
   *   label's HS score depends only on the nodes of its own path, so dropping other labels changes no retained score.
   * - `softmax`: flat softmax plus 1e-5, as fastText reports it.
   *
   * int8 heads multiply the integer dot product by the row scale once, which equals dequantizing the row first.
   */
  scoresFromHidden(hidden) {
    const m = this.meta, a = this.arrays, d = m.dim, l = m.labels.length;
    const head = a.head, headScales = a.head_scales, int8 = m.head_kind === "int8";
    const dot = (row) => {
      let value = 0;
      for (let j = 0; j < d; j++) value += head[row * d + j] * hidden[j];
      return int8 ? value * headScales[row] : value;
    };
    const scores = new Float64Array(l);
    if (m.loss === "hs-subset") {
      const probability = new Float64Array(this.shapes.head[0]);
      for (let i = 0; i < probability.length; i++) probability[i] = sigmoid(dot(i));
      const offsets = a.path_offsets, nodes = a.path_nodes, sides = a.path_sides;
      for (let i = 0; i < l; i++) {
        let log = 0;
        for (let j = offsets[i]; j < offsets[i + 1]; j++) {
          const p = probability[nodes[j]];
          log += Math.log((sides[j] ? p : 1 - p) + EPSILON);
        }
        scores[i] = Math.exp(log);
      }
    } else if (m.loss === "softmax") {
      for (let i = 0; i < l; i++) scores[i] = dot(i);
      const max = Math.max(...scores);
      let sum = 0;
      for (let i = 0; i < l; i++) {
        scores[i] = Math.exp(scores[i] - max);
        sum += scores[i];
      }
      for (let i = 0; i < l; i++) scores[i] = scores[i] / sum + EPSILON;
    } else {
      const left = a.left, right = a.right;
      const stack = [[2 * l - 2, 0]];
      while (stack.length) {
        const [node, score] = stack.pop();
        if (node < l) {
          scores[node] = Math.exp(score);
          continue;
        }
        const index = node - l, p = sigmoid(dot(index));
        stack.push([left[index], score + Math.log(1 - p + EPSILON)], [right[index], score + Math.log(p + EPSILON)]);
      }
    }
    return scores;
  }
  /**
   * Rank the model's labels for `text`.
   *
   * Returns `[]` for text without words (only spaces, tabs, line breaks or NUL: fastText's separators), for text
   * without any known feature, and when no label reaches the threshold. The threshold applies to the class probability before fastText's +1e-5 score offset, exactly like
   * fastText's `predict` (`Loss::findKBest`, `HierarchicalSoftmaxLoss::dfs`). Ties keep label order. With `boost`,
   * ranking and threshold use the boosted score instead.
   *
   * @throws RangeError for k < 1, a threshold outside [0, 1], `languages` that are empty, duplicated or unknown, or
   * a negative or non-finite boost.
   * @throws TypeError for a non-string or a lone UTF-16 surrogate.
   */
  predict(text, { k = 1, threshold = 0, languages, boost } = {}) {
    if (!Number.isInteger(k) || k < 1 || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      throw new RangeError("k >= 1 and threshold in [0,1] required");
    }
    if (languages !== void 0 && (!Array.isArray(languages) || !languages.length || new Set(languages).size !== languages.length || languages.some((x) => !this.meta.labels.includes(x)))) {
      throw new RangeError("languages must be nonempty, unique, known labels");
    }
    const weight = boostWeight(boost);
    const allowed = languages === void 0 ? null : new Set(languages);
    const ids = this.features(text);
    if (!WORD_CHARACTER.test(text) || !ids.length) return [];
    const scores = this.scoresFromHidden(this.hidden(ids));
    const labels = this.meta.labels;
    if (weight) {
      const support = letterSupport(text, labels);
      for (let i = 0; i < scores.length; i++) scores[i] += weight * support.get(labels[i]);
    }
    const cutoff = threshold + EPSILON;
    if (k === 1) {
      let best = -1;
      for (let i = 0; i < scores.length; i++) {
        if ((!allowed || allowed.has(labels[i])) && (best < 0 || scores[i] > scores[best])) best = i;
      }
      return scores[best] >= cutoff ? [{ language: labels[best], score: scores[best] }] : [];
    }
    return Array.from(scores, (score, i) => ({ language: labels[i], score, i })).filter((x) => !allowed || allowed.has(x.language)).sort((a, b) => b.score - a.score || a.i - b.i).slice(0, k).filter((x) => x.score >= cutoff).map(({ language, score }) => ({ language, score }));
  }
}
async function loadModel(url, options) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`model fetch failed: ${response.status}`);
  return LidModel.fromBuffer(await response.arrayBuffer(), options);
}

export { LidModel, bucketIds, hashBytes, letterSupport, loadModel, parseContainer };
