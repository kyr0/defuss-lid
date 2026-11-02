# Benchmark evidence checked 2026-11-01

## Published results

- **LinguAlchemy, EMNLP Findings 2024, Table 12** reports average LID accuracy
  93.89% for LID-fastText and 89.57% for CLD3 on its 24 MASSIVE locales. Language
  results differ: German 97.70 vs 88.59; Javanese 24.75 vs 68.10; Icelandic
  89.93 vs 92.64. This supports domain-specific comparison, not a universal
  fastText win. https://aclanthology.org/2024.findings-emnlp.225.pdf
- **GlotLID, EMNLP Findings 2023** emphasizes label granularity, shared-language
  intersections, open-set false positives and threshold choices. It separately
  compares GlotLID with CLD3, FT176, OpenLID and NLLB; different intersection
  columns are not a direct CLD3-vs-FT176 leaderboard.
  https://aclanthology.org/2023.findings-emnlp.410/
- **CommonLID, arXiv:2601.18026 (2026)** reports combined core-language F1
  77.7 for its fastText baseline and 61.6 for CLD3. Crucially, its fastText
  baseline is **NLLB's 218-label model**, not `lid.176.bin` or `.ftz`. Its
  throughput table also uses different hardware for CLD3, so it cannot establish
  a clean speed comparison. https://arxiv.org/html/2601.18026v1
- **What Language is This? Ask Your Tokenizer**, ICML 2026, compares CLD3 with
  a fastText model trained on GlotLID-C. Do not attach those scores to Meta's
  released FT176 checkpoint. https://proceedings.mlr.press/v306/meister26a.html
- Sobrier (2026) reports CLD3 beating released fastText on several benchmarks,
  but describes model-specific language coverage alignment. Different covered
  cohorts should not be read as an identical-test-set comparison. Its tables
  reinforce the need to rerun the same cohort rather than pool headline scores.
  https://jhss.scholasticahq.com/article/160011.pdf

## Model facts

The official fastText page lists 176 languages, 126 MB for `.bin` and 917 kB for
`.ftz`; downloaded exact sizes are 131,266,198 and 938,013 bytes respectively.
These are released CC BY-SA 3.0 models, distinct from fastText library licensing
and the newer NLLB models. https://fasttext.cc/docs/en/language-identification.html

CLD3's archived source uses six embedding tables with uint8 values centered at
128 and per-row 16-bit truncated-FP32 scales (bfloat16 layout). Shapes are 1000×16, 5000×16, 12×8, 103×8,
5000×16 and 100×16. The hidden layer is 80×208; the final head is 208×109,
including script-specific output variants. Its released embedding tables are
already quantized. https://github.com/google/cld3/blob/master/src/lang_id_nn_params.cc

OPTIC shares token codes across Gemma decoder layers and fits an output-path
reconstruction objective. A shallow 16-D LID model has no equivalent stack of
per-layer embedding tables. Its published 100×–1000× ratios are not forecasts
for LID compression. https://arxiv.org/abs/2610.31309

## What this package measures

See `results.md`, `reports/final/`, and `reports/validation-selection.json`.
All compared systems receive identical text and retain their native output
inventories. FLORES mappings are explicit in `scripts/prepare_flores.py`.
FLORES dev is used only to select a size/quality operating point; codebook
fitting never sees text. The untouched devtest split and MASSIVE test split
are then evaluated. Shared translated sentence IDs are retained for paired,
grouped bootstrap comparisons. Cropped FLORES sentences are identified as
artificial short-text slices; MASSIVE supplies natural short utterances.
