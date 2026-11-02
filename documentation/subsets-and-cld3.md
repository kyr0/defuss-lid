# Subset and compression semantics (v0.2)

## fastText: exact output restriction

The released `lid.176` classifier uses hierarchical softmax. Its head rows are
binary internal decisions, not one linear row per language. Deleting head rows
as if they were class logits, or rebuilding a smaller Huffman tree without
refitting weights, would change the classifier incorrectly.

`subset` takes the union of ancestor paths required by selected leaves. It
stores only those head rows plus CSR-like path offsets, node indices and
branch sides. Each selected label retains its original sigmoid-product score,
including fastText's 1e-5 log epsilon. Shared decisions are stored once. Common
ancestors and one-sided paths are retained; they cannot simply be collapsed
when preserving absolute scores. Labels remain in source order for tie-breaking.

An exact HS subset therefore satisfies, subject to floating-point rounding:

`subset.predict(x) = argmax_{language in allowlist} original.score(x, language)`.

It need not equal the unrestricted model's top language. Runtime `languages`
restriction applies before top-k truncation, retaining original scores. A
one-language subset is supported. Subsetting a subset is also supported.

For imported flat-softmax models, only selected classifier rows remain and
softmax renormalizes over them. This preserves their ranking but changes scores.
The model header records the applicable semantics.

## fastText: empirical feature restriction

Released hashed n-gram embeddings do not encode exclusive language ownership.
The same subword occurs in multiple languages, and unrelated n-grams can hash to
the same bucket. Therefore language selection alone cannot identify a precise
set of language-owned buckets.

With `--corpus`, the builder tokenizes allowed-language records using the
original model and counts distinct feature rows per document. It retains rows
with document frequency at least `--min-count`, always retaining EOS when
available. A nonzero `--max-features` caps the count, ordered by frequency with
stable source-row tie-breaking. Word and bucket IDs are remapped consistently
with the quantized codes, norm codes and optional row scales. Shared codebooks
remain intact. The original bucket hash space is preserved.

Removing features changes the pooling denominator on inputs that previously
used those rows. This is lossy, even though surviving coefficients are exact.
The corpus SHA-256, example counts by language, retained word/bucket counts,
threshold and row budget are stored in `feature_selection`.

Calibration input must contain a nonempty text example for every requested
language. Explicit test/devtest records are rejected. This guard does not prove
that unlabeled split metadata is truthful: callers must keep evaluation data
separate. The bundled five-language experiment uses 100 FLORES dev sentences
per language; all quality numbers use distinct devtest or MASSIVE test records.

Neither kind of allowlist proves that input belongs to the allowed languages.
HS scores preserve their original scale; a CLD3 or flat-softmax subset instead
has conditional scores, which can be confidently wrong on excluded languages.
Thresholds and unsupported-language rejection require separate calibration.

## CLD3: preserve the feature extractor

The pinned `cld3-asm@4.0.0` WASM contains the same 16 parameter arrays extracted
from upstream `lang_id_nn_params.cc`. Each array must have exactly one byte-for-
byte match before a build proceeds. Removing those ranges yields a shared
384,678-byte template, stored as an 85,630-byte gzip file. The original WASM
hash and exact array layout are pinned in generated `runtime/cld3-layout.js`.

At load time, the JS decoder validates the layout and core hashes, reconstructs
all array bytes, reinserts them, and instantiates the original WASM code. The
raw full-inventory pack must reconstruct the original SHA-256 exactly. The
loader uses a supplied byte buffer and an ESM conversion of the upstream
browser glue; it requires neither native modules nor an installed npm provider.

This is **storage/transfer compression**. The loaded WASM retains its original
dimensions and dense kernels. It does not run PQ lookups during inference or
reduce inference RAM. Temporary reconstruction buffers also exist during load.
The core, glue and loaders are shared by all packs; report their bytes alongside
each model pack. Comparing a pack alone to a complete upstream JS/WASM bundle
would be misleading.

## CLD3 methods

| Method | Large embedding tables | Dense layers |
| --- | --- | --- |
| `raw` | Original uint8 values and scale bits | Original FP32 |
| `int8` | Original | Symmetric int8, one FP32 scale per output neuron |
| `pq` | 4 subspaces × 256 byte-valued centroids | Original FP32 |
| `tiny-pq` | 2 subspaces × 16 centroids; packed 4-bit codes | Original FP32 |
| `pq-int8` | Ordinary PQ | Per-output-neuron int8 |
| `tiny-pq-int8` | Tiny PQ | Per-output-neuron int8 |

PQ fits the 1000×16, 5000×16 and 5000×16 tables. The small script/unigram tables
and all embedding row scales are preserved. It operates on native uint8 rows,
rounds centroids to uint8, then reassigns nearest byte-valued centers. Native
row scales remain separate. This is ordinary PQ in the native normalized-byte
space, not a reconstruction objective weighted by downstream language loss.
The metadata MSE uses each tensor's native coefficient units; those values
should not be compared across uint8 embeddings and FP32 dense layers.

The type called `float16` upstream uses the high 16 bits of FP32 (bfloat16
layout), not IEEE FP16. Scale arrays retain those bits exactly. Dense int8
values are dequantized into FP32 before WASM loads. Biases remain FP32.
Fits use released weights only, 20 k-means iterations and seed 42.

## CLD3 output allowlists

The builder stores only selected softmax columns and bias entries. On loading,
excluded columns become zero and their biases −1e9 in the fixed 109-column
native layout. For normal finite logits, excluded probabilities underflow to
zero and the returned language belongs to the allowlist. The wrapper checks
this invariant. Full conditional probability is recalculated by native CLD3;
this is not filtering a previously selected top-1 result.

Embedding tables remain shared and are not corpus-pruned by this CLD3 builder.
The template still contains native metadata and all class-name strings.
This version does not claim a physically smaller compiled network or feature
pipeline; only the stored output coefficients are reduced.

Canonical labels follow upstream ordering, with `iw` renamed to `he` and `fil` to `tl`.
Script-specific variants are explicit labels (`ru` and `ru-Latn` are different).
Duplicates, unknown codes and empty lists are errors.

## Verification

See `reports/v0.2/`: raw CLD3 parity against the independent npm provider,
bit-exact WASM reconstruction, full held-out prediction parity, exact fastText
restricted-argmax equivalence, build reproducibility, Node/Bun tests, and
browser parity for all 16 bundled models. Platform CI definitions are provided;
local execution covers Linux x86-64, not macOS/Windows.

Sources: [CLD3 parameters](https://github.com/google/cld3/blob/master/src/lang_id_nn_params.cc),
[embedding network](https://github.com/google/cld3/blob/master/src/embedding_network.cc),
[float16 encoding](https://github.com/google/cld3/blob/master/src/float16.h),
[label inventory](https://github.com/google/cld3/blob/master/src/task_context_params.cc),
[WASM wrapper](https://github.com/kwonoj/cld3-asm).
