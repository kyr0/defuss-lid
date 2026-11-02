# v0.2 results (2 November 2026)

**Language subsets work; dense-layer int8 is the conservative CLD3 choice.**
The 130 KB PQ+int8 pack is a smaller alternative with a measurable short-text
cost. Tiny PQ is substantially weaker and remains an experimental size endpoint.

The fixed `de,en,fr,es,ru` fastText subset shrinks to 115,315 bytes after
calibration-corpus feature pruning. It achieves 99.98% FLORES accuracy and
97.69% MASSIVE accuracy on those five languages; the exact labels-only subset
achieves 100.00% and 98.45%. These five-language scores must not be compared
as equivalent tasks with the 78-/23-label full-cohort scores below.

## Full native inventory: CLD3 compression

All candidates retain CLD3's 109 native output labels. The common evaluation
cohort is 78 FLORES gold languages and 23 MASSIVE gold labels (24 locales).
Model-pack bytes exclude shared runtime assets. Accuracy and fixed-gold-label
macro-F1 are percentages. All models see identical text and no oracle label mask.

| Method | Pack bytes | FLORES accuracy | FLORES macro-F1 | FLORES 20-code-point F1 | MASSIVE accuracy | MASSIVE macro-F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| raw | 366,028 | 97.81 | 97.86 | 81.53 | 89.36 | 93.03 |
| int8 | 249,648 | 97.80 | 97.85 | 81.54 | 89.38 | 93.04 |
| pq | 246,776 | 97.74 | 97.79 | 80.71 | 89.07 | 92.82 |
| tiny-pq | 202,256 | 93.43 | 93.68 | 67.16 | 77.65 | 82.47 |
| pq-int8 | 130,404 | 97.77 | 97.83 | 80.73 | 89.09 | 92.84 |
| tiny-pq-int8 | 85,880 | 93.44 | 93.71 | 67.14 | 77.62 | 82.43 |

The **shared runtime is 164,723 bytes as supplied**, including the
already-gzipped core, Emscripten glue, pinned layout, loader and container parser.
With HTTP gzip for the JS files, their combined transfer size is approximately
**104,393 bytes**; actual server/bundler results may differ. The fixed core
itself is 85,630 bytes, included in both totals. Add this shared cost once.

| Method | Pack gzip bytes | Supplied pack + shared assets | gzip pack + gzip JS + core |
| --- | ---: | ---: | ---: |
| raw | 342,237 | 530,751 | 446,630 |
| int8 | 229,577 | 414,371 | 333,970 |
| pq | 227,128 | 411,499 | 331,521 |
| tiny-pq | 182,349 | 366,979 | 286,742 |
| pq-int8 | 114,390 | 295,127 | 218,783 |
| tiny-pq-int8 | 69,581 | 250,603 | 173,974 |

These are delivery/storage sizes, **not inference RAM**. The decoder restores
original-shaped weight arrays into a 744,144-byte WASM binary. Native CLD3
preprocessing and dense kernels are reused. The original npm Node embedded JS
file is 1,057,244 bytes (500,189 gzip), excluding its wrapper dependencies;
that is a different packaging boundary, not a model-weight count.

The `int8` candidate quantizes only the dense layers. PQ quantizes the three
large uint8 embedding tables into four groups with 256 centroids each; tiny PQ
uses two groups with 16 centroids and packed nibbles. Original embedding row
scales and small tables remain. Hybrids also quantize the dense layers.
Fitting uses pretrained coefficients only; no corpus or labels fit codebooks.

Dev selection used the same limit of at most 0.5pp macro-F1 loss on **every** full/20/80 slice
as v0.1. Only raw and int8 qualified; int8 was the smaller choice. Its held-out
accuracy difference is near zero. PQ+int8's held-out 20-code-point macro-F1
loss is about 0.80pp, so it does not meet that stricter short-text tolerance.
The tolerance is an explicit experiment choice, not a universal optimum.

## Five-language subset experiment

Allowlist: **de, en, fr, es, ru**. FLORES: 5,060 devtest texts; MASSIVE: 14,870
test utterances. Feature pruning uses only 500 separate FLORES dev texts,
100/language, fixed document frequency of at least 1 and no feature-count cap. Every
parameter choice was frozen before these held-out runs.

The two full-inventory rows show why restricting outputs alone can improve
in-scope accuracy. They are evaluated on the same five-language examples;
those rows still allow predictions outside the five-language set.

| Variant | Pack/model bytes | FLORES accuracy | FLORES 20-code-point F1 | MASSIVE accuracy | MASSIVE macro-F1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| fasttext-full | 715,612 | 100.00 | 94.98 | 97.41 | 98.07 |
| fasttext-restricted | 715,612 | 100.00 | 96.28 | 98.45 | 98.45 |
| fasttext-five-exact | 703,151 | 100.00 | 96.28 | 98.45 | 98.45 |
| fasttext-five-observed | 115,315 | 99.98 | 95.84 | 97.69 | 97.70 |
| cld3-full | 366,028 | 99.60 | 81.24 | 83.23 | 90.30 |
| cld3-five-raw | 278,208 | 99.96 | 92.04 | 96.17 | 96.17 |
| cld3-five-int8 | 226,308 | 99.96 | 92.00 | 96.16 | 96.15 |
| cld3-five-pq-int8 | 107,060 | 99.96 | 91.84 | 95.93 | 95.92 |
| cld3-five-tiny-pq-int8 | 62,540 | 98.56 | 77.87 | 87.07 | 86.97 |

Add 11,934 source bytes for the fastText JS runtime, or the CLD3 shared
runtime above. The 115,315-byte fastText model therefore requires
127,249 bytes including its JS source before HTTP compression.
All models' exact/gzip sizes and hashes are in `artifact-sizes.json`.

`fasttext-restricted` filters candidate languages at inference but loads the
full model. `fasttext-five-exact` physically removes unused output paths while
preserving selected scores. Their predictions and scores match exactly on all
30,050 evaluated slice-records. `fasttext-five-observed` additionally removes
unobserved words/buckets, causing a 0.75pp MASSIVE accuracy loss relative to the
exact subset. This measures a different-domain cost that full FLORES sentences
alone would hide.

CLD3 subsets store only retained output coefficients and reconstruct omitted
columns as zero with bias −1e9. They keep shared embedding tables. Thus a
CLD3 language allowlist is supported, but corpus-based input-feature pruning
is implemented only for fastText. Scores from CLD3 subsets are conditional on
the allowlist; exact HS subsets keep original per-language scores. Neither
method establishes reliable rejection of excluded languages.

## Paired uncertainty

Accuracy deltas in percentage points; 95% percentile intervals from 2,000
paired bootstrap draws, seed 42, resampling aligned source-sentence groups.
These intervals concern accuracy, not macro-F1.

| Comparison, full text | Accuracy delta | 95% interval |
| --- | ---: | ---: |
| flores-int8-minus-raw | -0.010 | [-0.033, +0.011] |
| flores-pq-int8-minus-raw | -0.037 | [-0.082, +0.009] |
| flores-tiny-pq-int8-minus-raw | -4.369 | [-4.568, -4.151] |
| flores-pruned-minus-exact | -0.020 | [-0.059, +0.000] |
| massive-int8-minus-raw | +0.015 | [-0.006, +0.035] |
| massive-pq-int8-minus-raw | -0.268 | [-0.380, -0.153] |
| massive-tiny-pq-int8-minus-raw | -11.742 | [-11.976, -11.498] |
| massive-pruned-minus-exact | -0.753 | [-0.955, -0.551] |

## Validation and practical limits

- Raw CLD3 reconstructs the original WASM SHA-256 exactly. Against the independent
  v0.1 npm-provider predictions, **308,184 held-out slice-records** have zero
  top-1 mismatches and zero score differences.
- Exact fastText physical subsets match restricted full-model predictions and
  scores on all 30,050 five-language slice-records. Unit tests also cover nested
  subsets, one-language subsets, conditional flat-softmax semantics, invalid
  labels, corpus coverage, and explicit test-split rejection.
- **24 Python tests; 11 Node tests; 11 Bun tests passed.** Chromium 134 tested
  all **16 bundled models × 20 fixtures**, with zero Node/browser score
  differences, plus demo interaction through both backends.
- All **12 new model artifacts rebuilt byte-for-byte** with the supplied
  reproduction script in the measured environment. NumPy/SciPy or BLAS changes
  can produce different fitted codebooks; deployed artifact hashes are supplied.
- Local execution: Linux x86-64, Python 3.12, Node, Bun 1.4.4, Chromium 134.
  macOS/Windows CI is supplied but was not executed in this environment.

FLORES full-inventory evaluation includes 78,936 devtest texts with full,
20- and 80-code-point slices. MASSIVE includes 71,376 natural utterances across
24 locales mapped to 23 labels. All original v0.1 data hashes and label mappings
remain unchanged. Artificial prefixes can end mid-word; they are diagnostic,
not a replacement for natural short text. Held-out means excluded from this
compression/selection procedure, not a claim about original pretraining overlap.

Latency/load/RSS values remain in the per-run JSON. They are exploratory single
runs on this host, not controlled multi-run performance conclusions. Models ran
sequentially, while some setup/testing also used the host. Reconstruction and
fixed kernels mean pack-size reduction should not be interpreted as an inference
speed or RAM improvement. Process RSS includes corpora and retained predictions.

Reproduce: `python scripts/reproduce_v02.py`. Model builds use no supervised
weight training. The optional fastText feature-pruning step does use labeled
calibration text to choose which pretrained feature rows survive. The default
reproduction stages write under `runs/v0.2` and leave shipped evidence intact.
