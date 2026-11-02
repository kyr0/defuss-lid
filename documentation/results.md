# Measured results (1 November 2026)

**No universally best model emerged.** CLD3 has the highest full-sentence
FLORES accuracy and macro-F1. Uncompressed fastText has the highest accuracy
and macro-F1 on the natural short utterances in MASSIVE. Among the compact
baselines, fastText FTZ wins MASSIVE accuracy while CLD3 wins macro-F1.

For the pure-JS fastText backend, the default is the exact FTZ coefficient
repack, 715,612 bytes. It was the smallest evaluated model meeting the chosen
validation tolerance of at most **0.5 percentage-point macro-F1 loss on every
FLORES dev slice** relative to the released FTZ. That tolerance is an engineering
choice for this experiment, not a user-supplied requirement or universal optimum.
CLD3 is a separate optional backend and was not assigned a misleading
model-only size in that selection rule.

## Held-out accuracy and macro-F1

Percentages. F1 is averaged over the declared gold label set (78 FLORES labels;
23 MASSIVE labels). Predictions outside the gold cohort count as errors, and
no model receives an oracle restriction to the evaluation languages. A high
fixed-label macro-F1 can coexist with lower accuracy; inspect both.

| Model | FLORES accuracy | FLORES macro-F1 | MASSIVE accuracy | MASSIVE macro-F1 |
| --- | ---: | ---: | ---: | ---: |
| CLD3 (WASM) | 97.81 | 97.86 | 89.36 | 93.03 |
| fastText uncompressed | 95.31 | 95.01 | 93.69 | 93.92 |
| fastText FTZ repack | 93.11 | 92.48 | 91.61 | 92.20 |
| Ordinary PQ, 50k / 4 groups | 93.15 | 93.43 | 88.22 | 89.95 |
| OPTIC-inspired, 50k / 4 groups | 93.05 | 93.17 | 87.17 | 89.41 |
| Tiny PQ, 10k / 2 groups | 84.65 | 85.30 | 75.72 | 81.93 |

## Artificial short-text slices

FLORES macro-F1, percent. Prefixes are Unicode code points, not bytes or words;
they can end mid-word. These are diagnostic crops of the same sentences, not
independent short-text examples. MASSIVE above is the natural short-text test.

| Model | Full | First 80 code points | First 20 code points |
| --- | ---: | ---: | ---: |
| CLD3 (WASM) | 97.86 | 97.27 | 81.53 |
| fastText uncompressed | 95.01 | 93.57 | 79.56 |
| fastText FTZ repack | 92.48 | 90.56 | 73.66 |
| Ordinary PQ, 50k / 4 groups | 93.43 | 90.49 | 69.38 |
| OPTIC-inspired, 50k / 4 groups | 93.17 | 90.24 | 69.34 |
| Tiny PQ, 10k / 2 groups | 85.30 | 80.73 | 57.65 |

## Size and runtime

Decimal bytes. Gzip numbers are transfer sizes; models must be decompressed
before loading. JS source/runtime dependencies are excluded from model-only
sizes. The CLD3 rows include runtime code and therefore are not weight-only
comparisons. The uncompressed fastText DLID export is larger than its source
because it materializes explicit bucket IDs; it is a diagnostic reference.

| Artifact | Raw bytes | gzip -9 bytes | Contents |
| --- | ---: | ---: | --- |
| `compact-pq-176.dlid` | 464,676 | 320,310 | DLID model only |
| `fasttext-176.dlid` | 715,612 | 579,822 | DLID model only |
| `optic-176.dlid` | 464,756 | 322,539 | DLID model only |
| `tiny-pq-176.dlid` | 100,924 | 77,610 | DLID model only |
| `cld3-asm-4.0.0-node-embedded.js` | 1,057,244 | 500,189 | Runtime + base64 WASM; excludes wrapper modules |

Official input files: `lid.176.bin` **131,266,198 bytes**;
`lid.176.ftz` **938,013 bytes**. The diagnostic uncompressed DLID export is
138,985,332 bytes. The repacked FTZ saves 222,401 bytes (23.71%), retaining the
source quantized codes, codebooks, norm quantizer and classifier coefficients.

CLD3's decoded embedded WASM is **744,144 bytes**. Its source parameter arrays
sum to **359,466 bytes**, excluding feature extraction, labels and runtime code.
Embedding values are already uint8 with 16-bit truncated-FP32 row scales (bfloat16 layout); the dense head is
FP32. `scripts/inspect_cld3.py` can reproduce this count and extract the arrays.
`inspection/cld3-parameters.npz` contains those arrays for inspection, not a
standalone deployable LID model.

Latency below is one sequential run per model, after 100 warmup calls, in Node
on this Linux CPU. It measures the supplied JS implementation versus compiled
CLD3 WASM, not native fastText C++ versus native CLD3. Dataset loading and output
serialization are excluded from per-call timing. Peak process RSS in the JSON
includes the dataset and retained prediction rows, so it is not model RAM.
Caches persist across slices. No repeated-run uncertainty or device-general
speed claim is made.

| Model | FLORES full p50 / p95 (ms) | MASSIVE p50 / p95 (ms) |
| --- | ---: | ---: |
| CLD3 (WASM) | 0.106 / 0.184 | 0.049 / 0.102 |
| fastText uncompressed | 0.247 / 0.511 | 0.077 / 0.190 |
| fastText FTZ repack | 0.160 / 0.375 | 0.053 / 0.121 |
| Ordinary PQ, 50k / 4 groups | 0.156 / 0.352 | 0.052 / 0.116 |
| OPTIC-inspired, 50k / 4 groups | 0.149 / 0.342 | 0.051 / 0.104 |
| Tiny PQ, 10k / 2 groups | 0.133 / 0.328 | 0.048 / 0.116 |

## Paired uncertainty

Accuracy deltas in percentage points, with 95% percentile bootstrap intervals.
2,000 draws, seed 42. Resampling uses aligned source-sentence groups, preserving
translations together. These are accuracy intervals, not macro-F1 intervals,
and do not quantify training-domain contamination or deployment shift.

| Cohort, full text | First − second | Accuracy delta | 95% interval |
| --- | --- | ---: | ---: |
| FLORES | CLD3 (WASM) − fastText uncompressed | +2.505 | [+2.347, +2.653] |
| FLORES | CLD3 (WASM) − fastText FTZ repack | +4.699 | [+4.512, +4.885] |
| FLORES | Ordinary PQ, 50k / 4 groups − OPTIC-inspired, 50k / 4 groups | +0.108 | [-0.027, +0.226] |
| MASSIVE | CLD3 (WASM) − fastText uncompressed | -4.331 | [-4.632, -4.052] |
| MASSIVE | CLD3 (WASM) − fastText FTZ repack | -2.246 | [-2.526, -1.981] |
| MASSIVE | Ordinary PQ, 50k / 4 groups − OPTIC-inspired, 50k / 4 groups | +1.054 | [+0.881, +1.229] |

Ordinary PQ's small full-FLORES accuracy lead over OPTIC is not separated from
zero by this interval. On MASSIVE, PQ's lead is about one percentage point.
The evidence supports **no demonstrated OPTIC gain in this grid**, not a claim
that the original OPTIC method can never help LID.

## Protocol and selection

- FLORES-200: explicit 78-label shared-language mapping, 100 evenly spaced dev
  sentences per language (7,800 total), then all 1,012 devtest sentences per
  language (78,936). Full, 20-code-point and 80-code-point slices share examples.
- MASSIVE 1.1: official test split only, 2,974 utterances for each of the 24
  locales from LinguAlchemy Table 12: 71,376 records. Chinese simplified and
  traditional locales map to the same `zh` label, yielding 23 labels. Both
  per-locale accuracy and per-language F1 are retained in the JSON reports.
- All candidates use the same data, label normalization and text API. CLD3 uses
  minBytes=0 and maxBytes=10000. CLD3's `iw` and `fil` are renamed to `he` and `tl`.
- No training examples or labels fit model coefficients. A fixed data-free grid
  starts from the released uncompressed fastText weights: retained rows
  10k/25k/50k; per-row int8, ordinary PQ, output-aware transformed PQ, and
  OPTIC-inspired fitting; PQ groups 2/4, 256 centroids, 15 k-means iterations,
  two OPTIC alternations, seed 42. All variants use row-norm pruning.
- The 21 candidates plus pretrained baselines are measured on dev. The FTZ
  default is selected before test using the 0.5pp-every-slice rule. The large
  reference, CLD3, one 465 KB PQ/OPTIC ablation and the 101 KB size endpoint are
  fixed before held-out runs; see `reports/test-lock.json`.
- Each final model runs in a separate process, sequentially. Validation timing
  is exploratory because some early work overlapped fitting; only final
  sequential-run timing is presented here.

No custom candidate satisfies the selected tolerance on all validation slices.
The 465 KB ordinary PQ has better held-out full-FLORES macro-F1 than FTZ, but
worse 20-character macro-F1 and MASSIVE quality. The 101 KB candidate loses
substantial accuracy. This is a size/quality frontier, not a universal winner.

## What OPTIC contributes here

The upstream OPTIC paper targets repeated per-layer embedding tables in a
Gemma architecture. Released fastText has one shallow, 16-dimensional input
table and a hierarchical-softmax head. Cross-layer redundancy and the paper's
compression factors do not transfer automatically.

The independent adaptation whitens by the output metric, rotates dimensions,
fits product codebooks, then alternates affine decoder fitting, centroid
fitting and conditional discrete reassignment against original **node logits**.
The inverse/decoder transform is folded into the classifier. This requires
weight optimization, but no text corpus or supervised LID training.

For the 50k-row / 4-group candidate, mean squared node-logit reconstruction
error decreases from 95.3220 to 94.7046. This does not translate into a better
LID result than ordinary PQ. Local table MSE does not preserve document-level
class margins, and pruning changes feature averaging.

## Verification and limits

- Python: 15 tests passed, including container round trips, objective behavior,
  algebraic folding, features, metrics, and paired-cohort rejection.
- Node and Bun: 5 tests each passed, including independent native fixtures and
  optional CLD3 lifecycle behavior.
- Native fastText C++ differential check: 1,020 cases each for `.bin` and `.ftz`,
  zero top-1 mismatches. Largest top-score errors were 1.23e-6 and 3.89e-7,
  respectively. This check exercises the Python importer/inference; JS is
  independently checked against 20 native fixtures.
- Chromium 134: 4 bundled models × 20 fixtures, identical labels and scores
  against Node, plus a working demo interaction. Only Linux x86-64 was executed
  locally. macOS/Windows CI definitions are provided, not claimed to have run.

Held-out means unused by this compression/selection process; pretrained corpus
overlap was not audited. These datasets do not establish quality on mixed
languages, noisy web pages, unsupported languages or arbitrary language
inventories. Source models have different native output inventories, retained
unchanged here. Thresholds are not calibrated across providers.

All raw final predictions, per-language/per-locale metrics, source/dataset
hashes, model hashes, runtime information and selection results accompany this
report. See `scripts/reproduce.py`, `scripts/compare.py`, and `README.md`.
