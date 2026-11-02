# Architecture and boundaries

## Reuse before fitting

`native.py` reads the actual fastText v12 binary format, including its pruned
dictionary, product quantizers, optional norm codebook, and classifier.
The released LID model has 16-dimensional embeddings, character n-grams 2–4,
2,000,000 original buckets, wordNgrams=1 and hierarchical softmax. Its output
matrix contains internal binary-tree decisions; treating those rows as
per-language softmax logits would be incorrect.

The importer reconstructs the Huffman tree from the ordered label counts.
Counts can then be discarded. Bucket IDs are sorted; quantized rows follow the
same permutation. The JS runtime uses binary search over a Uint32Array rather
than allocating a bucket Map. Original quantized codes, norm codes, codebooks
and head coefficients are retained by `export`.

The importer supports supervised v12 models using hierarchical or flat softmax,
wordNgrams=1 and uniform PQ group widths. Unsupported versions, losses and
nonuniform PQ groups raise explicit errors. Generic pretrained model licenses
must be supplied by their publishers; only the two hash-verified official
lid.176 files receive the known CC BY-SA attribution automatically.

## Features

Hashing reproduces fastText's historical **signed-byte** FNV-1a variant. Ordinary
unsigned-byte FNV-1a fails on non-ASCII text. Character n-gram lengths count
Unicode code points, while hashing uses UTF-8 bytes. Boundary markers `<` and
`>` and EOS `</s>` match the upstream conventions.

No case folding, NFC/NFKC, accent stripping, or generalized Unicode whitespace
splitting is added. The document API replaces newline with a space and appends
EOS. ASCII stream separators retain upstream behavior. Explicit EOS terminates
the input; tokens beginning `__label__` are treated as labels rather than text.
Unpaired UTF-16 surrogates are rejected in JS and Python. Empty input abstains.

Pruning removes both selected word rows and bucket rows from feature averaging.
It changes the averaging denominator as native fastText pruning does. These
models therefore preserve the original hash space and sparse retained-ID map;
they are not newly trained dense small-bucket models. The earlier hypothetical
92-KiB dense-hash architecture cannot be obtained by silently rehashing released
weights into fewer buckets.

## Compression

1. `fp32`: retained source rows without weight quantization; isolates pruning.
2. `int8`: symmetric per-row quantization, FP32 scales, original classifier.
3. `pq`: Euclidean product quantization, 256 centroids/group, original basis.
4. `task-pq`: output-metric whitening, PCA rotation, variance-balanced groups,
   then PQ; inverse transform folded into the classifier.
5. `optic`: initialize as task-pq, then alternate affine decoder least squares,
   centroid least squares, and conditional discrete reassignment. The target is
   the original table's **node-logit vectors**, not label probabilities.

For row vectors X and output head W, the uncompressed targets are X Wᵀ. A
transformation T gives Z=X T and an equivalent full-rank head
W'=W(T⁻¹)ᵀ. The code implements this folding and optionally truncates rank with
a pseudoinverse. No nonlinear activation lies between pooling and these node
logits. Hierarchical sigmoid/tree traversal remains after the folded head.

OPTIC fitting minimizes mean squared error of reconstructed node logits. With
latent Z and decoder B, conditional reassignment uses A=B Bᵀ and the exact
quadratic objective for each codebook group. Updates that increase the fitted
objective are rolled back. This local objective is not equivalent to document
cross-entropy, macro-F1, or downstream classification error. In the measured
grid, lower reconstruction error did not establish a better LID frontier.

Fitting operates only on released parameters. It requires neither the original
training corpus nor labeled calibration examples. It is nevertheless parameter
optimization; call it data-free post-training compression, not 'zero training'
if that phrase would imply no optimization at all.

## Runtime

The runtime is TypeScript (`src/`), built by pkgroll into ES modules with
declarations (`dist/`). The fastText path uses TextEncoder/TextDecoder, typed
arrays, Map, fetch and arithmetic; no npm runtime dependencies, native modules,
WASM, WebGPU or ONNX are required. Node/Bun load bytes with their file APIs (the
pack loaders' `node` export condition); browsers load via fetch. A bounded
2048-word FIFO feature cache is enabled by default and can be disabled.

Reference Python inference uses NumPy. SciPy is used only by codebook fitting.
Native fastText is an optional independent verification dependency, not needed
to parse, compress or run a DLID model. `src/cld3.ts` (`defuss-lid/cld3`) is a
separate optional provider around the existing pretrained CLD3 WASM package; the
test suite uses it as the independent reference for the CLD3 packs.

fastText's prediction code adds 1e-5 inside log computations; inherited
scores can slightly exceed one. A threshold applies to the class probability
before that offset, as in fastText's `Loss::findKBest` and
`HierarchicalSoftmaxLoss::dfs`, and labels below probability 1e-5 are never
reported. Scores are deliberately named `score`
rather than calibrated probabilities. Differences from native FP32 arithmetic
are bounded by differential tests, not claimed bit-for-bit equivalent.

## Limits

Single dominant-language classification only. No token-level code switching,
OOD guarantee, calibrated abstention model or transliteration adaptation.
Build-time language allowlists and empirical corpus pruning are supported in
v0.2; see `subsets-and-cld3.md`. Thresholds are explicit application
choices; empty input is the only automatic abstention added by this runtime.
Model file bytes, compressed transfer bytes and process RSS are separate metrics.
CLD3's WASM embeds a runtime, preprocessing tables and model coefficients, so its
WASM size is not a model-only size. CI runs the unit tests on Node.js 22, 24
and 26 and on Bun (Linux, macOS, Windows), the packed-tarball examples on
Node.js 20 as well, and the browser suite in Chromium, Firefox and WebKit.

## v0.3 classifier encoding

`compress --method pq-int8` fits ordinary PQ and quantizes classifier rows.
`quantize-head` preserves existing input coefficients/codebooks and changes
only the head. Symmetric int8 uses per-row max-absolute-value / 127 and FP32
scales; both runtimes multiply each dot product by that row's scale. HS rows
remain internal tree decisions, including shared ancestors for label subsets.

New int8-head files use the DLID0002 magic and metadata version 2, with the
same aligned-array container layout. This forces v0.1/v0.2 loaders to reject
them. The current readers accept versions 1 and 2 and validate that the magic
and metadata version agree. CLD3 packs and FP32-head fastText models remain v1.
The `head_kind` field selects the head interpretation independently of input
embedding encoding. Classifier scales follow output row/path pruning.
