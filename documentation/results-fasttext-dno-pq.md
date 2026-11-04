# Results: the fastText DNO-PQ packs

Report of 4 November 2026. Since release 0.5.0 the fastText packs `der_3` and `deferi_6` are the DNO-PQ packs from the Hugging Face repository [kyr0/fastText-pq-dno](https://huggingface.co/kyr0/fastText-pq-dno), pinned in `models.lock.json` at revision `0e4d9d937ec3a01ea5e149ad103b9a3d12c19ddb`. The CLD3 packs are those of [results-dno-pq.md](results-dno-pq.md); the v0.3 fastText packs stay on Hugging Face in [kyr0/defuss-lid-1.0](https://huggingface.co/kyr0/defuss-lid-1.0).

## What changed

DNO-PQ (Direct Neural Optimization - Product Quantization) starts from Meta's `lid.176.ftz` restricted to the pack's languages. It re-encodes the table rows into 4 product-quantization codes instead of 8, stores bucket ids as 2-byte gaps, chooses the rows anew by what each one is worth on held-out text, exchanges them once by exact gain, and refits the shared codebooks, the norms and the int8 hierarchical-softmax rows. A bucket row takes 7 bytes instead of 13, so 74% to 78% more rows fit the same file size. No benchmark or test text was used to choose rows, fit or select. The [model card](https://huggingface.co/kyr0/fastText-pq-dno) documents the method, its data and the per-language losses.

The packs store bucket ids as gaps (`bucket_gaps`, [architecture.md](architecture.md)), so they need defuss-lid 0.5.0 or newer; 0.4.0 rejects them.

| Pack | Labels | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `der_3` | 3 | 77,952 | `6119405a387d85683bf33b13403229d5b41759b6ded9c413850f053e0e74ff4d` |
| `deferi_6` | 6 | 127,424 | `edd01aadbaeb4daf74877036021836fd965279991dbc770b1d6ddf0032482e81` |

## Compression results

VERIFIED: measured on 2026-11-04 with `node scripts/boost_eval.mjs 0,default` on the v0.3 benchmark cohorts (FLORES-200 devtest sentences, their first 20 code points, MASSIVE 1.1 test utterances), without the letter boost, so the rows compare with the fastText rows of [results-v0.3.md](results-v0.3.md#compression-results). kB = 1,000 bytes; the pack size excludes the runtime.

| Set | Method | Pack kB | FLORES sentences % | FLORES first 20 code points % | MASSIVE utterances % |
| --- | --- | ---: | ---: | ---: | ---: |
| 3 | fastText DNO-PQ | 77.95 | 100.00 | 98.98 | 99.39 |
| 6 | fastText DNO-PQ | 127.42 | 99.97 | 95.73 | 98.56 |

Against the v0.3 packs they replace (78.05 and 127.49 kB), first-20-code-point accuracy rises from 98.42% to 98.98% (`der_3`) and from 93.74% to 95.73% (`deferi_6`), and MASSIVE from 98.54% to 99.39% and from 96.92% to 98.56%, at slightly fewer bytes.

## Against lid.176

"lid.176" is `lid.176.ftz` restricted to the same labels (`3/fasttext-native-exact.dlid` and `6/fasttext-native-exact.dlid` of the v0.3 release, 703 kB each), both run in the same runtime with the default letter boost. VERIFIED: measured on 2026-11-03 by the edit's evaluation tool (`dnp-tools/fastText/eval.mjs`); its DNO-PQ figures equal the `boost_eval.mjs` figures above.

| Set | Slice | Rows | lid.176 % | DNO-PQ % | Errors |
| --- | --- | ---: | ---: | ---: | ---: |
| 3 | FLORES sentences | 3,036 | 100.00 | 100.00 | 0 against 0 |
| 3 | FLORES first 20 code points | 3,036 | 98.62 | 99.04 | −31.0% |
| 3 | MASSIVE utterances | 8,922 | 99.16 | 99.44 | −33.3% |
| 6 | FLORES sentences | 6,072 | 100.00 | 99.97 | 2 against 0 |
| 6 | FLORES first 20 code points | 6,072 | 94.60 | 95.75 | −21.3% |
| 6 | MASSIVE utterances | 17,844 | 97.88 | 98.58 | −32.8% |

The packs are 89% (`der_3`) and 82% (`deferi_6`) smaller than lid.176 in the same container. The model card adds two-word starts, the Tatoeba test split and NTREX-128 news: over those ten slices the packs make about 20% fewer errors than lid.176 (`der_3` 496 against 624, `deferi_6` 3,232 against 4,017). They trail it on three slices by a few texts: `der_3` on Tatoeba sentences (8 errors against 7) and NTREX two-word starts (126 against 122), `deferi_6` on FLORES sentences (2 against none).

## Default results

What an application gets by default, with the letter boost on (weight 1, `BOOST_WEIGHT`). VERIFIED: measured on 2026-11-04 with `node scripts/boost_eval.mjs 0,default --alternatives`. The website shows these figures, next to the CLD3 alternatives of [results-dno-pq.md](results-dno-pq.md#default-results).

| Set | Method | Pack kB | FLORES sentences % | FLORES first 20 code points % | MASSIVE utterances % |
| --- | --- | ---: | ---: | ---: | ---: |
| 3 | fastText DNO-PQ | 77.95 | 100.00 | 99.04 | 99.44 |
| 6 | fastText DNO-PQ | 127.42 | 99.97 | 95.75 | 98.58 |
