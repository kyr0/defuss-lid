# Results: the CLD3 DNO-PQ packs and the default letter boost

Report of 3 November 2026. Since this date the CLD3 packs `major_20` and `full` are the DNO-PQ packs from the Hugging Face repository [kyr0/cld3-pq-dno](https://huggingface.co/kyr0/cld3-pq-dno), pinned in `models.lock.json` at revision `a186ded69dae2e46b329af8568e5b2c0fa29cee5`. The CLD3 core and every other candidate stay as in [results-v0.3.md](results-v0.3.md); since release 0.5.0 the fastText packs `der_3` and `deferi_6` are the DNO-PQ packs of [results-fasttext-dno-pq.md](results-fasttext-dno-pq.md).

## What changed

DNO-PQ (Direct Neural Optimization - Product Quantization) keeps the v0.3 packs' product-quantized embeddings byte for byte. It refits the hidden and softmax layers of CLD3 on held-out text, starting from Google's weights, and stores them as int8. The fit and selection text came from the FLORES-200 dev split, MASSIVE train and dev, Tatoeba and synthetic romanized text; no benchmark text below was used to fit or select the edit. The packs run on the same unmodified CLD3 WebAssembly core as before. The [model card](https://huggingface.co/kyr0/cld3-pq-dno) documents the method, its data and the per-language losses.

| Pack | Labels | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `major_20` | 20 | 110,576 | `03503bf3e896d64a7276eb23172669b253e9e62b5a0b2e7b9a8bd3a46d004a24` |
| `full` | 109 | 130,548 | `1c468715f981034d1bde0fc0191f6fc357dca36944e2aaf6853a76e23c43339f` |

## Compression results

VERIFIED: measured on 2026-11-03 with `node scripts/boost_eval.mjs` on the v0.3 benchmark cohorts (FLORES-200 devtest sentences, their first 20 code points, MASSIVE 1.1 test utterances), without the letter boost, so the rows compare with the CLD3 rows of [results-v0.3.md](results-v0.3.md#compression-results). The same harness reproduced those v0.3 rows exactly. kB = 1,000 bytes; the pack size excludes the shared runtime.

| Set | Method | Pack kB | FLORES sentences % | FLORES first 20 code points % | MASSIVE utterances % |
| --- | --- | ---: | ---: | ---: | ---: |
| 20 | CLD3 DNO-PQ | 110.58 | 99.91 | 94.10 | 97.54 |
| full | CLD3 DNO-PQ | 130.55 | 98.13 | 82.63 | 92.02 |

## Against Google's original CLD3

"Google original" is Google's released CLD3 weights restricted to the same labels (`20/cld3-raw.cld3q`, `full/cld3-raw.cld3q` of the v0.3 release), run in the same WebAssembly build. "Errors" is the relative change in the number of wrong answers. VERIFIED: measured on 2026-11-03 on the same rows as above, by the edit's evaluation tool in the real WebAssembly build; its DNO-PQ figures equal the `boost_eval.mjs` figures. The default-boost columns use CLD3's default weight of 20 (see [Letter boost](#letter-boost)), measured again in the same build.

| Set | Slice | Rows | Google original % | DNO-PQ, `boost: false` % | Errors | DNO-PQ, default boost % | Errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | FLORES sentences | 20,240 | 99.64 | 99.91 | −75.0% | 99.94 | −83.3% |
| 20 | FLORES first 20 code points | 20,240 | 91.77 | 94.10 | −28.3% | 94.37 | −31.6% |
| 20 | MASSIVE utterances | 62,454 | 95.20 | 97.54 | −48.7% | 97.66 | −51.3% |
| full | FLORES sentences | 78,936 | 97.81 | 98.13 | −14.5% | 98.16 | −16.0% |
| full | FLORES first 20 code points | 78,936 | 79.62 | 82.63 | −14.8% | 83.30 | −18.0% |
| full | MASSIVE utterances | 154,648 | 89.09 | 92.02 | −26.8% | 92.21 | −28.6% |

The packs are 62.0% (`major_20`, against 290,876 bytes) and 64.3% (`full`, against 366,028 bytes) smaller than Google's original weights in the same container.

The model card adds two-word starts and held-out text beyond the benchmark. On two-word starts with the default boost, errors fall by 51% (`major_20`) and 21% (`full`) on the benchmark sentences, by 62% and 26% on the Tatoeba test split and by 35% and 17% on NTREX-128 news (at weight 1: 49% and 19%, 61% and 24%, 33% and 14%). `full` loses more than 1 point on some languages. The largest losses are Serbian (−9.6 points on NTREX sentences that mix Latin look-alike letters into Cyrillic words), then Croatian, Malay and Norwegian, which CLD3 confuses with Bosnian and Serbian, Indonesian and Danish. No `major_20` language loses more than 0.9 points on any slice.

## Default results

What an application gets by default, with the letter boost on, for the CLD3 packs, the v0.3 fastText packs (shipped until 0.4.0) and the same-language files on the other runtime that the website's pack cards compare against (from [results-v0.3.md](results-v0.3.md)). VERIFIED: measured on 2026-11-03 with `node scripts/boost_eval.mjs 0,1,default --alternatives`, at each runtime's default weight (1 for fastText, 20 for CLD3); its weight-0 column reproduced every row of both reports' "Compression results" tables. The website shows these figures; the README's pack table shows the model's own, `boost: false`.

| Set | Method | Pack kB | FLORES sentences % | FLORES first 20 code points % | MASSIVE utterances % |
| --- | --- | ---: | ---: | ---: | ---: |
| 3 | fastText native PQ + int8 | 78.05 | 100.00 | 98.55 | 98.63 |
| 3 | CLD3 PQ + int8 | 106.61 | 99.97 | 95.92 | 97.50 |
| 6 | fastText native PQ + int8 | 127.49 | 99.97 | 93.84 | 96.97 |
| 6 | CLD3 PQ + int8 | 107.29 | 99.93 | 90.22 | 95.17 |
| 20 | CLD3 DNO-PQ | 110.58 | 99.94 | 94.37 | 97.66 |
| 20 | fastText native PQ + int8 | 241.81 | 99.75 | 93.29 | 96.02 |
| full | CLD3 DNO-PQ | 130.55 | 98.16 | 83.30 | 92.21 |
| full | fastText native PQ + int8 | 708.07 | 93.29 | 74.14 | 87.55 |

The boost helps the fastText alternative for 20 languages most: MASSIVE utterances rise from 91.94% to 96.02%, still below `major_20`'s 97.66%.

## Letter boost

Each runtime has its own default weight: 1 for fastText (`BOOST_WEIGHT`) and 20 for CLD3 (`CLD3_BOOST_WEIGHT`). Both were tuned on held-out selection text of the DNO-PQ work, never on the benchmark (`src/boost.ts` documents the runs). From weight 1, accuracy of the CLD3 packs kept rising with the weight up to 20 and then stayed flat, with almost nothing lost (`full`: 1,513 selection texts fixed, 12 broken). For fastText, weight 1 was the best tried or within noise of it for `der_3` and both fastText DNO-PQ packs, and higher weights cost them; only `deferi_6` gained from more.

VERIFIED: `node scripts/boost_eval.mjs 0,1,default` on 2026-11-03, measured once after the weights were chosen:

| Pack | FLORES sentences, `boost: false` | weight 1 | default (20) | FLORES first 20 code points, `boost: false` | weight 1 | default (20) | MASSIVE utterances, `boost: false` | weight 1 | default (20) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `major_20` | 99.91% | 99.94% | 99.94% | 94.10% | 94.14% | 94.37% | 97.54% | 97.58% | 97.66% |
| `full` | 98.13% | 98.15% | 98.16% | 82.63% | 82.70% | 83.30% | 92.02% | 92.07% | 92.21% |

At weight 20 the boost adds up to 0.67 points to the DNO-PQ packs (`full`, first 20 code points; up to 0.07 at weight 1), and up to 0.97 to the v0.3 CLD3 files (`6/cld3-pq-int8.cld3q`, first 20 code points: 89.25% to 90.22%).
