# v0.3: language packs with PQ + int8

Measured on 2026-11-02. These are held-out **top-1 accuracy percentages**, not model confidence scores. All candidate settings were fixed before evaluation; no LID model was trained from scratch. Old v0.1/v0.2 evidence remains in its own report folders.

The useful compact choices in this run are native-PQ fastText + int8 for the 3- and 6-language sets, and CLD3 PQ + int8 for the 20-language and full-inventory configurations. Ordinary-PQ fastText gives smaller 3/6-language packs with weaker short-text accuracy. This is an observed tradeoff, not proof of a universal smallest/best model.

## Requested language inventories

| Set | Labels |
| --- | --- |
| 3 | `de, en, ru` |
| 6 | `de, en, fr, es, ru, it` |
| 20 | `en, de, fr, it, ru, id, es, pt, nl, ur, vi, th, zh, ja, pl, tr, ar, ko, bn, hi` |
| full | `CLD3: 109 labels; fastText: 176 labels` |

The user's Snowball/segmenter/trigram annotations and pasted percentages were not used as LID targets, training inputs, or expected scores. The 20 language names determine the allowlist.

## Compression results

kB = 1,000 bytes. Pack size includes tensor data, codebooks, sparse feature IDs/dictionary, and container metadata; it excludes shared runtime files. Each row pair for a given set uses exactly the same examples and preprocessing.

| Set | Method | Pack kB | FLORES sentences % | FLORES first 20 code points % | MASSIVE utterances % |
| --- | --- | ---: | ---: | ---: | ---: |
| 3 | CLD3 PQ + int8 | 106.61 | 99.97 | 94.99 | 97.19 |
| 3 | fastText ordinary PQ + int8 | 55.32 | 100.00 | 95.42 | 97.16 |
| 3 | fastText native PQ + int8 | 78.05 | 100.00 | 98.42 | 98.54 |
| 6 | CLD3 PQ + int8 | 107.29 | 99.93 | 89.25 | 94.84 |
| 6 | fastText ordinary PQ + int8 | 86.63 | 99.92 | 87.96 | 94.06 |
| 6 | fastText native PQ + int8 | 127.49 | 99.97 | 93.74 | 96.92 |
| 20 | CLD3 PQ + int8 | 110.43 | 99.65 | 91.39 | 95.03 |
| 20 | fastText ordinary PQ + int8 | 158.19 | 99.84 | 89.37 | 90.00 |
| 20 | fastText native PQ + int8 | 241.81 | 99.70 | 92.82 | 91.94 |
| full | CLD3 PQ + int8 | 130.40 | 97.77 | 78.80 | 88.60 |
| full | fastText ordinary PQ + int8 | 457.13 | 93.26 | 69.53 | 84.05 |
| full | fastText native PQ + int8 | 708.07 | 93.14 | 73.61 | 87.17 |

Small differences, such as the 3-language CLD3 versus ordinary-PQ fastText MASSIVE result, should not be treated as a robust quality advantage. Paired bootstrap intervals are recorded below.

## Baselines for the same output inventories

CLD3 original weights are physically output-subsetted but not newly quantized. fastText exact subsets preserve the released `.ftz` input PQ and FP32 classifier coefficients and all input features. They isolate the loss introduced by extra quantization and feature pruning.

| Set | Baseline | Pack kB | FLORES % | MASSIVE % |
| --- | --- | ---: | ---: | ---: |
| 3 | CLD3 original weights | 276.52 | 99.97 | 97.34 |
| 3 | fastText native PQ, exact output subset | 702.89 | 100.00 | 99.07 |
| 6 | CLD3 original weights | 279.05 | 99.95 | 95.27 |
| 6 | fastText native PQ, exact output subset | 703.32 | 100.00 | 97.84 |
| 20 | CLD3 original weights | 290.88 | 99.64 | 95.20 |
| 20 | fastText native PQ, exact output subset | 705.79 | 99.83 | 96.08 |
| full | CLD3 original weights | 366.03 | 97.81 | 89.09 |
| full | fastText native PQ, exact output subset | 715.61 | 93.11 | 87.17 |

For 20 languages, the observed-feature native fastText pack loses about 4 percentage points on MASSIVE relative to its exact subset. The FLORES dev calibration corpus does not fully cover conversational features. This is why reduced feature coverage must be evaluated on a separate domain. CLD3 keeps its shared feature tables. Chinese is the largest observed pruning failure: native-PQ fastText falls from 88.70%/85.24% to 60.49%/44.92% on zh-CN/zh-TW. The compact pack is not a replacement for the exact baseline when that coverage matters.

## Deployment footprint

The current shared CLD3 runtime is **164,801 bytes**; fastText JS is **12,482 bytes**. Add it once per application, not once per pack. This includes the gzip-stored CLD3 core and the required JS modules, but excludes the host JS/WASM engine. CLD3 packs reconstruct the fixed native WASM layout; these savings do **not** imply reduced inference RAM.

| Set | Method | Pack bytes | Gzip pack bytes | Pack + runtime bytes | Gzip assets total bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| 3 | CLD3 PQ + int8 | 106,612 | 95,407 | 271,413 | 199,838 |
| 3 | fastText ordinary PQ + int8 | 55,316 | 47,560 | 67,798 | 51,992 |
| 3 | fastText native PQ + int8 | 78,048 | 70,341 | 90,530 | 74,773 |
| 6 | CLD3 PQ + int8 | 107,288 | 95,931 | 272,089 | 200,362 |
| 6 | fastText ordinary PQ + int8 | 86,628 | 71,701 | 99,110 | 76,133 |
| 6 | fastText native PQ + int8 | 127,488 | 113,081 | 139,970 | 117,513 |
| 20 | CLD3 PQ + int8 | 110,428 | 98,622 | 275,229 | 203,053 |
| 20 | fastText ordinary PQ + int8 | 158,192 | 121,190 | 170,674 | 125,622 |
| 20 | fastText native PQ + int8 | 241,808 | 207,503 | 254,290 | 211,935 |
| full | CLD3 PQ + int8 | 130,404 | 114,390 | 295,205 | 218,821 |
| full | fastText ordinary PQ + int8 | 457,132 | 312,902 | 469,614 | 317,334 |
| full | fastText native PQ + int8 | 708,068 | 572,890 | 720,550 | 577,322 |

Gzip assets total compresses each non-gzip asset separately at level 9 with mtime=0; already compressed core bytes are counted once. No bundler/minifier is assumed. Benchmark JSON retains runtime byte counts at the time each measurement ran; this deployment table measures the final release files.

## Cohorts and limitations

| Set | FLORES devtest records / labels | MASSIVE test records / labels / locales |
| --- | ---: | ---: |
| 3 | 3,036 / 3 | 8,922 / 3 / 3 |
| 6 | 6,072 / 6 | 17,844 / 6 / 6 |
| 20 | 20,240 / 20 | 62,454 / 20 / 21 |
| full | 78,936 / 78 | 154,648 / 51 / 52 |

FLORES uses 1,012 aligned held-out sentences per language. The first 20/80 code-point slices are artificial crops, not independent natural short-text data. MASSIVE uses 2,974 held-out utterances per locale. Both Chinese locales map to `zh`, so Chinese has double weight in MASSIVE micro accuracy; `nb-NO` maps to model label `no`. Per-language macro-F1 is also reported. The v0.3 full MASSIVE cohort expands v0.2 from 24 to 52 locales, so those headline percentages are not a direct version-to-version regression comparison.

**Full means full native model inventory, not full benchmark coverage.** FLORES evaluates 78 common labels; MASSIVE evaluates 51 common labels. We did not measure all 109 CLD3 labels or all 176 fastText labels. Full models compete against their complete native output inventories; output inventory sizes differ. No per-record oracle candidate filtering is used. The fixed smaller allowlists define separate closed-set tasks; scores across different sets are not directly comparable.

fastText cannot represent these 17 CLD3 labels without new model work: `bg-Latn, el-Latn, ha, haw, hi-Latn, hmn, ig, ja-Latn, mi, ny, ru-Latn, sm, sn, st, xh, zh-Latn, zu`. An exact 109-label fastText counterpart is therefore not supplied. `he` and `tl` normalize upstream CLD3 `iw` and `fil`. No unsupported-language rejection or mixed-language accuracy is claimed.

## Macro-F1 and longer crops

| Set | Method | FLORES full F1 % | FLORES 20 F1 % | FLORES 80 accuracy % | MASSIVE F1 % |
| --- | --- | ---: | ---: | ---: | ---: |
| 3 | CLD3 PQ + int8 | 99.97 | 94.97 | 99.84 | 97.18 |
| 3 | fastText ordinary PQ + int8 | 100.00 | 95.53 | 99.93 | 97.22 |
| 3 | fastText native PQ + int8 | 100.00 | 98.42 | 99.97 | 98.54 |
| 6 | CLD3 PQ + int8 | 99.93 | 89.22 | 99.70 | 94.83 |
| 6 | fastText ordinary PQ + int8 | 99.92 | 88.04 | 99.80 | 94.12 |
| 6 | fastText native PQ + int8 | 99.97 | 93.75 | 99.93 | 96.93 |
| 20 | CLD3 PQ + int8 | 99.66 | 91.34 | 99.51 | 94.98 |
| 20 | fastText ordinary PQ + int8 | 99.84 | 89.38 | 99.62 | 91.15 |
| 20 | fastText native PQ + int8 | 99.70 | 92.96 | 99.59 | 93.29 |
| full | CLD3 PQ + int8 | 97.83 | 80.73 | 96.99 | 91.06 |
| full | fastText ordinary PQ + int8 | 93.56 | 69.48 | 90.23 | 85.13 |
| full | fastText native PQ + int8 | 92.50 | 73.66 | 91.10 | 87.55 |

## Twenty-language MASSIVE accuracy by language

| Language | CLD3 PQ + int8 % | fastText ordinary PQ + int8 % | fastText native PQ + int8 % | fastText exact baseline % |
| --- | ---: | ---: | ---: | ---: |
| en | 87.16 | 87.69 | 98.42 | 98.02 |
| de | 94.55 | 94.35 | 95.73 | 97.48 |
| fr | 90.79 | 93.17 | 96.94 | 97.68 |
| it | 92.33 | 90.82 | 93.31 | 95.83 |
| ru | 98.22 | 99.70 | 99.93 | 99.87 |
| id | 94.86 | 81.81 | 89.51 | 90.48 |
| es | 88.43 | 92.74 | 96.00 | 96.74 |
| pt | 92.23 | 82.78 | 85.14 | 89.21 |
| nl | 92.67 | 90.35 | 94.08 | 94.89 |
| ur | 97.95 | 98.18 | 98.69 | 98.69 |
| vi | 98.05 | 96.03 | 96.87 | 96.91 |
| th | 97.01 | 99.83 | 99.83 | 99.83 |
| zh | 97.09 | 52.84 | 52.71 | 86.97 |
| ja | 98.69 | 93.34 | 93.54 | 98.96 |
| pl | 96.33 | 95.06 | 96.84 | 97.58 |
| tr | 95.73 | 94.86 | 96.20 | 97.14 |
| ar | 93.44 | 95.90 | 96.33 | 96.33 |
| ko | 98.89 | 98.66 | 98.59 | 98.62 |
| bn | 97.48 | 99.87 | 99.90 | 99.90 |
| hi | 96.74 | 99.23 | 99.56 | 99.60 |

Per-language accuracy equals recall on that language's gold examples. It differs from precision and F1. Full confusion evidence is retained as predictions, with IDs and gold labels but no source utterance text.

## Paired uncertainty

CLD3 PQ + int8 accuracy minus each fastText candidate, in percentage points. 95% percentile intervals from 2,000 paired bootstrap draws, seed 42, over aligned source groups. This preserves translated-example dependence and is descriptive, not a multiple-comparison-corrected selection test.

| Set | Dataset | Comparator | Delta pp | 95% interval pp |
| --- | --- | --- | ---: | --- |
| 3 | flores | fastText ordinary PQ + int8 | -0.03 | [-0.10, +0.00] |
| 3 | flores | fastText native PQ + int8 | -0.03 | [-0.10, +0.00] |
| 3 | massive | fastText ordinary PQ + int8 | +0.02 | [-0.38, +0.46] |
| 3 | massive | fastText native PQ + int8 | -1.36 | [-1.75, -0.99] |
| 6 | flores | fastText ordinary PQ + int8 | +0.02 | [-0.08, +0.12] |
| 6 | flores | fastText native PQ + int8 | -0.03 | [-0.12, +0.05] |
| 6 | massive | fastText ordinary PQ + int8 | +0.78 | [+0.38, +1.19] |
| 6 | massive | fastText native PQ + int8 | -2.08 | [-2.42, -1.74] |
| 20 | flores | fastText ordinary PQ + int8 | -0.18 | [-0.29, -0.08] |
| 20 | flores | fastText native PQ + int8 | -0.04 | [-0.16, +0.07] |
| 20 | massive | fastText ordinary PQ + int8 | +5.03 | [+4.78, +5.27] |
| 20 | massive | fastText native PQ + int8 | +3.09 | [+2.85, +3.33] |
| full | flores | fastText ordinary PQ + int8 | +4.52 | [+4.33, +4.70] |
| full | flores | fastText native PQ + int8 | +4.63 | [+4.45, +4.82] |
| full | massive | fastText ordinary PQ + int8 | +4.55 | [+4.33, +4.76] |
| full | massive | fastText native PQ + int8 | +1.43 | [+1.21, +1.65] |

## Build procedure and evidence

- **CLD3:** ordinary PQ, 4 groups × 256 centroids on its three large embeddings; preserve native per-row bfloat16 scales. Per-output-neuron int8 for hidden and retained output weights, FP32 bias/scales. Retain only requested output columns; embeddings are shared and remain intact.
- **fastText ordinary PQ:** start with released uncompressed `lid.176.bin`, retain 50,000 input rows by norm (EOS retained), then restrict outputs and observed features for smaller sets. Fit 4 groups × 256 centroids, 20 iterations, seed 42; quantize classifier rows to int8.
- **fastText native PQ:** reuse released `lid.176.ftz` 8-group norm-PQ without refitting it; restrict output paths and observed features for smaller sets; quantize classifier rows to int8.
- **Feature calibration:** only 100 FLORES dev sentences per requested language, document frequency at least 1, no extra row cap. Test/devtest data is rejected by the pruning API. Full models do not use corpus pruning; all native labels are retained. Hashed buckets are shared/colliding and have no exclusive language ownership.
- **Int8 head format:** DLID0002 makes older loaders reject new heads; v0.3 reads DLID0001 and DLID0002. The Python and JS kernels apply the per-row scale to the classifier dot product. Recompression and further output subsetting preserve the encoding correctly.
- **Runtime checks:** 32 Python tests; 12 Node and 12 Bun tests; Chromium/Node exact score and ranking agreement on 36 models × 20 fixtures. CI is provided for Linux/macOS/Windows; only Linux execution is claimed here.
- **Evidence:** `reports/v0.3/build-lock.json`, dataset manifests, artifact sizes, 40 benchmark reports and their raw prediction files, per-language metrics, paired intervals, and environment versions. File hashes are verified before benchmarking and before generating this report. Timing/RSS are host-dependent and include dataset/prediction process overhead; they are not isolated model memory measurements.

```sh cli
bun install
bun run build
uv sync
uv run python scripts/reproduce_v03.py
uv run python scripts/report_v03.py
```

Use `--data`, `--models`, and `--reports` to place a rebuild elsewhere. Stages are `prepare`, `build`, `benchmark`, `summarize`; `--only` selects benchmark cases for a partial rerun. The report script accepts `--reports` and `--output`. Source downloads are SHA-256 pinned. Numerical library versions can affect fitted codebooks; the release records the measured versions.
