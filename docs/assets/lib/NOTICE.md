# Attribution and licensing

The new runtime, compression implementation, tests, and scripts are MIT licensed.
The bundled `.dlid` model files are adaptations of Meta/Facebook's released fastText
`lid.176.bin` or `lid.176.ftz` and retain **CC BY-SA 3.0**. The MIT code license
does not relicense these weights. See `licenses/CC-BY-SA-3.0.txt`.

Original models and attribution: [fastText language identification](https://fasttext.cc/docs/en/language-identification.html),
Armand Joulin, Edouard Grave, Piotr Bojanowski, Tomas Mikolov and the fastText team.
Relevant papers: *Bag of Tricks for Efficient Text Classification* (2016) and
*FastText.zip: Compressing text classification models* (2016).

Changes to the model files are recorded in each DLID header: dictionary
bookkeeping removal, bucket sorting, portable serialization; and, for the
experimental variants, feature pruning and weight quantization/refitting.
Source SHA-256 digests are retained. The v0.3 files (`models/v0.3/`) used no
labeled examples to optimize their coefficients; validation data selected a
deployment candidate.
The observed-feature subset additionally uses allowed-language calibration
examples to select retained words and hashed n-gram buckets. Their hash and
counts are recorded in its header; test/devtest records are rejected.

fastText signed-byte hashing, n-gram boundaries, stream tokenization, Huffman
construction, and inference equations are ported from the MIT-licensed
[facebookresearch/fastText](https://github.com/facebookresearch/fastText).
Copyright (c) 2016-present, Facebook, Inc. All rights reserved.
The upstream license is included as `licenses/fastText-MIT.txt`.

The optional `cld3-asm` dependency is MIT licensed; its embedded Google CLD3
code and model are Apache-2.0 licensed. Copyright 2016 Google Inc.
See [google/cld3](https://github.com/google/cld3),
[kwonoj/cld3-asm](https://github.com/kwonoj/cld3-asm), and
`licenses/CLD3-Apache-2.0.txt`. The legacy optional provider is installed from npm.
The v0.2 `runtime/` contains a parameter-stripped copy of the hash-verified
cld3-asm 4.0.0 WASM and its browser Emscripten glue, converted to ESM with
explicit in-memory binary loading. Native feature extraction is unchanged.
The `.cld3q` files adapt Google's Apache-2.0 weights through packaging,
optional product quantization/int8 dense layers, and output-column selection.
All modifications are recorded in their headers. Upstream wrapper copyright:
Copyright (c) 2017 OJ Kwon; see `licenses/cld3-asm-MIT.txt`.
`inspection/cld3-parameters.npz` is an extracted copy of Google's released
parameter arrays, with the same Apache-2.0 license, for inspection only.

The DNO-PQ packs in `models/fastText-pq-dno/` (fastText, CC BY-SA 3.0) and
`models/cld3-pq-dno/` (CLD3, Apache-2.0) were refitted on labeled held-out text:
FLORES-200 dev (CC BY-SA 4.0), MASSIVE 1.1 train and dev (CC BY 4.0), Tatoeba
(CC BY 2.0 FR), and Wikinews (CC BY 2.5 and CC BY 4.0, French also CC BY-SA 4.0)
for fastText or synthetic romanized text for CLD3. That text is not
redistributed. Each folder's `NOTICE.md` lists the edit data, their licenses and
the test data no pack was fitted on.

The output-aware VQ experiment is inspired by Liu et al., *Extreme Compression
of Per-Layer Embeddings via Cross-Layer Latent Vector Quantization*,
[arXiv:2610.31309](https://arxiv.org/abs/2610.31309), 22 October 2026;
[VILA-Lab/optic](https://github.com/VILA-Lab/optic), Apache-2.0.
This is an independent single-table adaptation. It neither reproduces Gemma's
cross-layer compression nor claims the paper's compression/accuracy numbers.

Benchmark data are downloaded separately. FLORES-200: CC BY-SA 4.0, Meta NLLB
team. MASSIVE 1.1: CC BY 4.0, Amazon Science and contributors. See the respective
dataset manifests and source URLs. Benchmark result files retain labels,
source IDs and model predictions, not the input corpora.
