# defuss-lid

[![CI](https://github.com/kyr0/defuss-lid/actions/workflows/verify.yml/badge.svg)](https://github.com/kyr0/defuss-lid/actions/workflows/verify.yml)
[![npm](https://img.shields.io/npm/v/defuss-lid)](https://www.npmjs.com/package/defuss-lid)
[![Models](https://img.shields.io/badge/%F0%9F%A4%97%20models-kyr0%2Fdefuss--lid--1.0-yellow)](https://huggingface.co/kyr0/defuss-lid-1.0)
[![License](https://img.shields.io/badge/license-MIT%20%7C%20CC%20BY--SA%203.0%20%7C%20Apache--2.0-blue)](NOTICE.md)

Language identification in 78 kB: pretrained fastText and CLD3 models, compressed into language packs, with a dependency-free TypeScript runtime for Node.js, Bun and browsers.

Your text never leaves the process: a pack is a small binary file, the runtime is plain JavaScript (fastText) or a hash-verified WebAssembly core (CLD3), and there is no inference service. The project site in [`docs/`](docs/) runs every pack live in the browser.

## TL;DR

You don't need a 900 kB model or a server to tell German from English. Pick the pack that covers your languages, `load()` it and call `predict(text)`. The four recommended packs reuse the released fastText `lid.176` and Google CLD3 coefficients (nothing was trained from scratch), keep only the outputs you need, prune input features that a separate calibration corpus never used, and quantize what remains. On held-out FLORES sentences the 78 kB `der_3` pack is 100.00% accurate for German, English and Russian; the 130 kB `full` pack keeps all 109 CLD3 labels and scores 97.77% on the 78 FLORES languages the benchmark shares with it. The [measured results](documentation/results-v0.3.md) list every trade-off.

Features:
- 📦 Four ready packs: `der_3` (de, en, ru), `deferi_6` (+ fr, es, it), `major_20` (20 major languages) and `full` (109 languages), from 78 to 130 kB
- 🧮 Pure TypeScript fastText inference: n-gram hashing, product-quantized embeddings, int8 classifier, hierarchical softmax, within 3e-5 of native fastText scores
- 🧩 CLD3 from compact packs: weights are decoded into the original cld3-asm WebAssembly, so CLD3's own feature extraction runs unchanged; the raw pack rebuilds the upstream binary byte for byte
- 🌐 Node.js, Bun and browsers: each pack has a disk loader (`node` export condition) and a fetch loader; bundlers emit the model file through `new URL(…, import.meta.url)`
- 🔒 Verified bytes: the CLD3 core is SHA-256-checked before it is instantiated, every model file is validated before inference, and the released files are pinned by hash in `models.lock.json`
- 🎯 Language allowlists: build-time packs for both runtimes, and `predict(text, {languages})` for any fastText model
- 🛠️ Python tools to build your own packs from the released weights: subset, prune, quantize, inspect
- 🧪 Vitest on Node.js and Bun, Playwright in Chromium, Firefox and WebKit, and every code example on this page executed by the e2e suite

## Quick, CDN-based setup in the browser

The runtime from jsDelivr, a pack from the [Hugging Face release](https://huggingface.co/kyr0/defuss-lid-1.0):

```html browser
<script type="module">
  import {loadModel} from 'https://cdn.jsdelivr.net/npm/defuss-lid@0.3.0/dist/index.js';

  // der_3: German, English and Russian in 78 kB, pinned to a release revision
  const lid = await loadModel('https://huggingface.co/kyr0/defuss-lid-1.0/resolve/24d27e5b42d002d69fded6301607160919151370/der_3.dlid');
  console.log(lid.predict('Guten Morgen, wie geht es dir?')[0].language); // de
</script>
```

CLD3 packs work the same way and cover more scripts. They own WebAssembly memory, so dispose of them when you are done:

```html browser
<script type="module">
  import {loadCld3Pack} from 'https://cdn.jsdelivr.net/npm/defuss-lid@0.3.0/dist/cld3-pack.js';

  // 20 languages in 110 kB; the shared CLD3 core loads from next to cld3-pack.js
  const lid = await loadCld3Pack('https://huggingface.co/kyr0/defuss-lid-1.0/resolve/24d27e5b42d002d69fded6301607160919151370/major_20.cld3q');
  console.log(lid.predict('これは日本語の文章です。')[0].language); // ja
  lid.dispose();
</script>
```

- **Good for:** prototypes, demos and pages without a build step.
- **Drawbacks:** two third-party hosts at runtime, no offline use, no bundler optimizations.

## Quick, non-CDN setup

Copy `dist/` and `runtime/cld3-core.bin.gz` from the npm package and the pack files you need from Hugging Face next to your page, keeping the package layout so `dist/cld3-pack.js` finds `../runtime/cld3-core.bin.gz`:

```text
project/
├── defuss-lid/
│   ├── dist/                  ← from the npm package
│   └── runtime/cld3-core.bin.gz
├── models/der_3.dlid          ← from Hugging Face
└── index.html
```

Then import the local files: `import {loadModel} from './defuss-lid/dist/index.js'` and `await loadModel('./models/der_3.dlid')`. Serve `.gz` files as plain bytes, without `Content-Encoding: gzip`: the loader checks the hash of the compressed file before decompressing it itself.

- **Good for:** offline and air-gapped use, pinning the exact files you ship.
- **Drawbacks:** manual updates.

## For production: install via package manager

The npm package contains the runtime and the four packs (plus every other v0.3 model file under `models/v0.3/`), so nothing is downloaded at runtime:

```sh install
bun add defuss-lid
# or: npm install defuss-lid
```

Then, in Node.js, Bun or a bundled browser app, load a pack by name. Under Node.js and Bun the `node` export condition reads the file from disk; in browsers the fetch loader requests it, and Vite, webpack 5 or Parcel emit it as an asset:

```js node bun browser
import {load} from 'defuss-lid/packs/deferi_6';

const lid = await load();
console.log(lid.predict('Bonjour tout le monde.')[0].language); // fr
console.log(lid.predict('Buenos días, ¿cómo estás?')[0].language); // es
```

CLD3 packs return CLD3's reliability flag too and must be disposed:

```js node bun browser
import {load} from 'defuss-lid/packs/major_20';

const lid = await load();
const [result] = lid.predict('Das ist ein deutscher Satz.');
console.log(result.language, result.reliable); // de true
lid.dispose();
```

Any `.dlid` file loads with `LidModel.fromBuffer`, here the deferi_6 file the package ships. Ask for the `k` best labels, or restrict the ranking to the languages you expect:

```js node bun
import {readFileSync} from 'node:fs';
import {LidModel} from 'defuss-lid';

const file = new URL(import.meta.resolve('defuss-lid/models/v0.3/deferi_6.dlid'));
const lid = LidModel.fromBuffer(readFileSync(file));
const [best, second] = lid.predict('la casa', {k: 2});
console.log(best.language, best.score.toFixed(2)); // es 0.60
console.log(second.language); // it
console.log(lid.predict('la casa', {languages: ['it', 'fr']})[0].language); // it
```

`predict(text, {k = 1, threshold = 0, languages})` returns `[{language, score}]`, best first, and `[]` for text without words (only spaces, tabs, line breaks or NUL, the separators fastText reads), for text without known features, and when nothing reaches `threshold`. The registry `defuss-lid/packs` lists every pack without loading one:

```js node bun browser
import {PACKS} from 'defuss-lid/packs';

console.log(PACKS.der_3.bytes, PACKS.der_3.languages.join(',')); // 78048 en,ru,de
console.log(PACKS.major_20.kind); // cld3-pack
```

| Import | Contents |
| --- | --- |
| `defuss-lid` (or `defuss-lid/fasttext`) | fastText runtime: `LidModel`, `loadModel`, `parseContainer` |
| `defuss-lid/cld3-pack` | CLD3 pack runtime: `loadCld3Pack`, `createCld3Pack`, `reconstructCld3` |
| `defuss-lid/cld3` | the unmodified npm `cld3-asm@4.0.0` as an optional reference provider (install it yourself) |
| `defuss-lid/packs` | registry: names, languages, bytes and SHA-256 of the four packs |
| `defuss-lid/packs/{der_3,deferi_6,major_20,full}` | `load()`, `meta`, `labels`, `url` of one pack |
| `defuss-lid/models/*`, `defuss-lid/runtime/*` | the model files and the CLD3 core, for your own loader or bundler |

## Packs

<!-- packs:start -->
| Pack | Languages | Method | Pack | All-in | All-in gzipped | FLORES sentences | FLORES first 20 code points | MASSIVE utterances |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `der_3` | de, en, ru | fastText native PQ + int8 | 78.0 kB | 95.4 kB | 77.5 kB | 100.00% | 98.42% | 98.54% |
| `deferi_6` | de, en, es, fr, it, ru | fastText native PQ + int8 | 127.5 kB | 144.8 kB | 119.8 kB | 99.97% | 93.74% | 96.92% |
| `major_20` | ar, bn, de, en, es, fr, hi, id, it, ja, ko, nl, pl, pt, ru, th, tr, ur, vi, zh | CLD3 PQ + int8 | 110.4 kB | 284.0 kB | 202.6 kB | 99.65% | 91.39% | 95.03% |
| `full` | 109 CLD3 labels | CLD3 PQ + int8 | 130.4 kB | 304.0 kB | 218.7 kB | 97.77% | 78.80% | 88.60% |

The same languages on the other runtime, measured in the same run but not shipped as packs:

| Languages of | Method | Pack | All-in | All-in gzipped | FLORES sentences | FLORES first 20 code points | MASSIVE utterances |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `der_3` | CLD3 PQ + int8 | 106.6 kB | 280.2 kB | 199.4 kB | 99.97% | 94.99% | 97.19% |
| `deferi_6` | CLD3 PQ + int8 | 107.3 kB | 280.9 kB | 199.9 kB | 99.93% | 89.25% | 94.84% |
| `major_20` | fastText native PQ + int8 | 241.8 kB | 259.1 kB | 214.1 kB | 99.70% | 92.82% | 91.94% |
| `full` | fastText native PQ + int8 | 708.1 kB | 725.4 kB | 581.1 kB | 93.14% | 73.61% | 87.17% |
<!-- packs:end -->

kB = 1,000 bytes. **All-in** is what an application downloads to identify text: the pack plus its runtime, the fastText JavaScript or the CLD3 JavaScript and its WebAssembly core (see [Size](#size)); exact byte counts are in `defuss-lid/packs` (`PACKS.der_3.bytes`). Top-1 accuracy on held-out FLORES-200 devtest sentences (and their first 20 code points) and MASSIVE 1.1 test utterances, measured on 2026-11-02; the full pack is evaluated on the 78 FLORES and 51 MASSIVE labels it shares with the benchmarks, not on all 109. For 3 languages the fastText pack is smaller and more accurate than CLD3; for 6 languages it is a larger file than its CLD3 counterpart, yet more accurate and, with the much smaller runtime, smaller all-in. For 20 languages the measurements are mixed: CLD3 is more accurate on MASSIVE utterances and smaller all-in once gzipped, fastText more accurate on FLORES sentences and their prefixes and smaller all-in uncompressed. For all languages CLD3 is both smaller and more accurate. [results-v0.3.md](documentation/results-v0.3.md) has the remaining candidates, exact-subset baselines, paired bootstrap intervals and per-language failures (pruning hurts Chinese most).

Every file of the release, including the per-set candidates and baselines, is on Hugging Face at [kyr0/defuss-lid-1.0](https://huggingface.co/kyr0/defuss-lid-1.0); `models.lock.json` pins its revision and the SHA-256 of each file.

## Size

<!-- sizes:start -->
| File | Size | Gzipped | What |
| --- | ---: | ---: | --- |
| `dist/index.js` (+ shared chunk) | 17.3 kB | 6.3 kB | fastText runtime: `LidModel`, `loadModel` |
| `dist/cld3-pack.js` (+ shared chunk) | 87.9 kB | 17.8 kB | CLD3 pack runtime with the Emscripten glue |
| `runtime/cld3-core.bin.gz` | 85.6 kB | 85.6 kB | shared CLD3 WebAssembly core, stored gzip-compressed; once per app |
| `der_3` | 78.0 kB | 71.2 kB | 3 languages, fastText pack |
| `deferi_6` | 127.5 kB | 113.4 kB | 6 languages, fastText pack |
| `major_20` | 110.4 kB | 99.2 kB | 20 languages, CLD3 pack |
| `full` | 130.4 kB | 115.3 kB | 109 languages, CLD3 pack |
<!-- sizes:end -->

kB = 1,000 bytes. A page that uses one fastText pack loads the fastText runtime and the pack; a CLD3 page loads the CLD3 runtime and the core once, plus each pack. `scripts/verify.mjs` recomputes this table from the built files and fails when it differs. Gzipped sizes come from fflate at level 9, which gives the same bytes on every machine; Node.js zlib at the same level changes with the Node.js release and came out up to 2.7 % smaller for these files (2026-11-02).

## Build your own pack

The Python tools in `defuss_lid/` turn the released weights into new packs. From a checkout with [uv](https://docs.astral.sh/uv/) and the release files (`make setup` fetches them):

```sh run
uv run defuss-lid subset models/v0.3/full/fasttext-native-exact.dlid tmp/de-en.dlid --languages de,en
uv run defuss-lid quantize-head tmp/de-en.dlid tmp/de-en-int8.dlid
uv run defuss-lid predict tmp/de-en-int8.dlid 'Guten Morgen, wie geht es dir?'
```

`subset` keeps only the output paths of the listed labels; HS scores of the kept labels do not change. Add `--corpus` with a JSONL calibration set to also drop input features that set never uses, which is where most of the size goes, and evaluate on a different corpus afterwards. These steps need the downloaded FLORES data or the uncompressed `lid.176.bin`:

```sh cli
uv run python scripts/reproduce_v02.py --stage prepare
uv run defuss-lid subset models/v0.3/full/fasttext-native-exact.dlid tmp/de-en-small.dlid --languages de,en --corpus data/flores-dev.jsonl
uv run defuss-lid compress data/lid.176.bin tmp/pq-int8.dlid --method pq-int8 --cutoff 50000 --groups 4 --iterations 20 --seed 42
uv run python scripts/build_cld3.py --languages de,en,fr,es,ru --methods raw,int8,pq-int8 --output tmp/my-cld3
```

`uv run python scripts/reproduce_v03.py` rebuilds every v0.3 artifact and benchmark from SHA-256-pinned downloads; see [the report](documentation/results-v0.3.md#build-procedure-and-evidence) for stages and hardware notes.

## Website

[`docs/index.html`](docs/index.html) is the project site, built on [defuss-shadcn](https://shadcn.defuss.org/) and served as-is by GitHub Pages: a live demo of all packs, a card per pack with its all-in size next to the other runtime, how both runtimes work, the accuracy table and the setups above. Its size and accuracy figures, like the tables in this README, are generated by `scripts/sizes.mjs`. It loads the runtime from `docs/assets/lib/` (a copy of `dist/`, refreshed by `bun run docs` and checked by `scripts/verify.mjs`) and the models from the pinned Hugging Face revision. Run it locally with `bun run serve` and open <http://127.0.0.1:8080/docs/>.

## Two things to know

**A score is not a probability of being right.** fastText scores are class probabilities plus fastText's 1e-5 epsilon (they can slightly exceed 1); CLD3 scores are its softmax output. Both are confident on text far from their training data. Short text is hard: accuracy on the first 20 characters of a sentence is several points lower than on the full sentence.

**An allowlisted pack always answers with one of its languages.** `der_3` labels French text as English (score 0.37), because it knows nothing else. Use `full`, or a threshold tuned on your own data, when other languages can occur. CLD3 packs shrink the download, not memory: the full native WebAssembly layout is rebuilt before instantiation.

## Development

```sh cli
make setup
make verify
```

`make setup` installs the pinned toolchain (mise), the locked JavaScript and Python dependencies, the release models from Hugging Face (hash-checked), the Playwright browsers and the git hooks. `make verify` runs, cheapest first: oxlint, strict TypeScript, ruff and the structural checks (`scripts/verify.mjs`); Vitest on Node.js and on Bun plus pytest; coverage, which also fails when the coverage figures on the website differ from the measurement (`scripts/coverage.mjs`); and the e2e suite, which packs the npm tarball and the Python wheel, installs them into a clean consumer, runs every code example of this README, the guides and the website in Node.js, Bun, Chromium, Firefox and WebKit, and drives every section of the website. [ARCH.md](ARCH.md) explains the design; [documentation/](documentation/) holds the guides and measured results.

## Citation

If you use defuss-lid in research or want to reference it, cite it as:

```bibtex
@misc{homberg2026defusslid,
  author       = {Homberg, Aron},
  affiliation  = {Independent Researcher},
  title        = {defuss-lid: compressed pretrained language identification packs with a portable runtime},
  year         = {2026},
  version      = {0.3.0},
  howpublished = {\url{https://github.com/kyr0/defuss-lid}},
  note         = {Models: \url{https://huggingface.co/kyr0/defuss-lid-1.0}}
}
```

## License

Code: [MIT](LICENSE). The model files keep the licenses of the weights they adapt: fastText-derived `.dlid` files are CC BY-SA 3.0 (Facebook/Meta fastText team), CLD3-derived `.cld3q` packs and the CLD3 core are Apache-2.0 (Google). Attribution, the list of changes and all license texts are in [NOTICE.md](NOTICE.md) and [`licenses/`](licenses/).
