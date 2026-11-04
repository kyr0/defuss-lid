# defuss-lid

[![CI](https://github.com/kyr0/defuss-lid/actions/workflows/verify.yml/badge.svg)](https://github.com/kyr0/defuss-lid/actions/workflows/verify.yml)
[![npm](https://img.shields.io/npm/v/defuss-lid)](https://www.npmjs.com/package/defuss-lid)
[![Models](https://img.shields.io/badge/%F0%9F%A4%97%20models-kyr0%2Fdefuss--lid--1.0-yellow)](https://huggingface.co/kyr0/defuss-lid-1.0)
[![fastText DNO-PQ](https://img.shields.io/badge/%F0%9F%A4%97%20fastText-kyr0%2FfastText--pq--dno-yellow)](https://huggingface.co/kyr0/fastText-pq-dno)
[![CLD3 DNO-PQ](https://img.shields.io/badge/%F0%9F%A4%97%20CLD3-kyr0%2Fcld3--pq--dno-yellow)](https://huggingface.co/kyr0/cld3-pq-dno)
[![License](https://img.shields.io/badge/license-MIT%20%7C%20CC%20BY--SA%203.0%20%7C%20Apache--2.0-blue)](NOTICE.md)

Language identification in 78 kB: pretrained fastText and CLD3 models, compressed into language packs, with a dependency-free TypeScript runtime for Node.js, Bun and browsers.

Your text never leaves the process: a pack is a small binary file, the runtime is plain JavaScript (fastText) or a hash-verified WebAssembly core (CLD3), and there is no inference service. The project site in [`docs/`](docs/) runs every pack live in the browser.

## TL;DR

You don't need a 900 kB model or a server to tell German from English. Pick the pack that covers your languages, `load()` it and call `predict(text)`. The four recommended packs reuse the released fastText `lid.176` and Google CLD3 coefficients (nothing was trained from scratch), keep only the outputs you need, drop the input features they do not need, and quantize what remains. All four are DNO-PQ packs, refitted on held-out text: the fastText packs chose their rows anew and refitted their codebooks and classifier, so they make about 20% fewer errors than `lid.176` restricted to the same languages at 11% to 18% of its size; the CLD3 packs refitted their dense layers and make fewer errors than Google's original CLD3 at 36% to 38% of its size. On held-out FLORES sentences the 78 kB `der_3` pack is 100.00% accurate for German, English and Russian; the 130 kB `full` pack keeps all 109 CLD3 labels and scores 98.13% on the 78 FLORES languages the benchmark shares with it, against 97.81% for Google's original weights. The measured results ([v0.3](documentation/results-v0.3.md), [fastText DNO-PQ](documentation/results-fasttext-dno-pq.md), [CLD3 DNO-PQ](documentation/results-dno-pq.md)) list every trade-off.

Features:
- 📦 Four ready packs: `der_3` (de, en, ru), `deferi_6` (+ fr, es, it), `major_20` (20 major languages) and `full` (109 languages), from 78 to 130 kB
- 🧮 Pure TypeScript fastText inference: n-gram hashing, product-quantized embeddings, int8 classifier, hierarchical softmax, within 3e-5 of native fastText scores
- 🧩 CLD3 from compact packs: weights are decoded into the original cld3-asm WebAssembly, so CLD3's own feature extraction runs unchanged; the raw pack rebuilds the upstream binary byte for byte
- fastText DNO-PQ (Direct Neural Optimization - Product Quantization): `der_3` and `deferi_6` make about 20% fewer errors than `lid.176` restricted to the same languages over ten test slices and are 82% to 89% smaller ([report](documentation/results-fasttext-dno-pq.md), [model card](https://huggingface.co/kyr0/fastText-pq-dno))
- CLD3 DNO-PQ: `major_20` and `full` make 16% to 83% fewer errors than Google's original CLD3 on the benchmark (with the default letter boost) and are 62% to 64% smaller ([report](documentation/results-dno-pq.md), [model card](https://huggingface.co/kyr0/cld3-pq-dno))
- 🌐 Node.js, Bun and browsers: each pack has a disk loader (`node` export condition) and a fetch loader; bundlers emit the model file through `new URL(…, import.meta.url)`
- 🔒 Verified bytes: the CLD3 core is SHA-256-checked before it is instantiated, every model file is validated before inference, and the released files are pinned by hash in `models.lock.json`
- 🎯 Language allowlists: build-time packs for both runtimes, and `predict(text, {languages})` for any fastText model
- Letter boost, on by default: `predict(text)` adds how well the text's letters fit each language's alphabet to the model score, so the Vietnamese "Kể từ" comes out Vietnamese instead of Hindi; CLD3's `reliable` flag is cleared when the letters fit another language better
- 🛠️ Python tools to build your own packs from the released weights: subset, prune, quantize, inspect
- 🧪 Vitest on Node.js and Bun, Playwright in Chromium, Firefox and WebKit, and every code example on this page executed by the e2e suite

## Quick, CDN-based setup in the browser

The runtime from jsDelivr, a pack from Hugging Face ([kyr0/fastText-pq-dno](https://huggingface.co/kyr0/fastText-pq-dno) for fastText, [kyr0/cld3-pq-dno](https://huggingface.co/kyr0/cld3-pq-dno) for CLD3):

```html browser
<script type="module">
  import {loadModel} from 'https://cdn.jsdelivr.net/npm/defuss-lid@0.5.0/dist/index.js';

  // der_3: German, English and Russian in 78 kB, pinned to a release revision
  const lid = await loadModel('https://huggingface.co/kyr0/fastText-pq-dno/resolve/0e4d9d937ec3a01ea5e149ad103b9a3d12c19ddb/der_3.dlid');
  console.log(lid.predict('Guten Morgen, wie geht es dir?')[0].language); // de
</script>
```

CLD3 packs work the same way and cover more scripts. They own WebAssembly memory, so dispose of them when you are done:

```html browser
<script type="module">
  import {loadCld3Pack} from 'https://cdn.jsdelivr.net/npm/defuss-lid@0.5.0/dist/cld3-pack.js';

  // 20 languages in 110 kB; the shared CLD3 core loads from next to cld3-pack.js
  const lid = await loadCld3Pack('https://huggingface.co/kyr0/cld3-pq-dno/resolve/a186ded69dae2e46b329af8568e5b2c0fa29cee5/major_20.cld3q');
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

The npm package contains the runtime and the four pack files (`models/fastText-pq-dno/der_3.dlid`, `deferi_6.dlid` and `models/cld3-pq-dno/major_20.cld3q`, `full.cld3q`), so nothing is downloaded at runtime; every other model file stays on Hugging Face:

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

CLD3 packs return a reliability flag too, CLD3's own, cleared when the text's letters fit another language better. They must be disposed:

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

const file = new URL(import.meta.resolve('defuss-lid/models/fastText-pq-dno/deferi_6.dlid'));
const lid = LidModel.fromBuffer(readFileSync(file));
const [best, second] = lid.predict('la casa', {k: 2});
console.log(best.language, best.score.toFixed(2)); // it 1.55
console.log(second.language); // es
console.log(lid.predict('la casa', {languages: ['es', 'fr']})[0].language); // es
```

`predict(text, {k = 1, threshold = 0, languages, boost = true})` returns `[{language, score}]`, best first, and `[]` for text without words (only spaces, tabs, line breaks or NUL, the separators fastText reads), for text without known features, and when nothing reaches `threshold`.

### Letter boost

A short text can come out in a language whose alphabet it does not use: `major_20` calls the Vietnamese "Kể từ" ("since") Hindi. The writing system is hard evidence, and `letterSupport(text, languages)` measures it: the share of the text's letters that each language's alphabet explains. Cyrillic letters fit every Cyrillic-script language alike, ß fits German, ї fits Ukrainian and not Russian. By default `predict` adds this support to every language's model score before ranking; `boost: false` gives the model's own scores:

```js node bun browser
import {load} from 'defuss-lid/packs/major_20';
import {letterSupport} from 'defuss-lid';

const lid = await load();
console.log(lid.predict('Kể từ')[0].language); // vi
console.log(lid.predict('Kể từ', {boost: false})[0].language, lid.predict('Kể từ', {boost: false})[0].reliable); // hi false
console.log(letterSupport('гроза', ['ru', 'uk', 'pt']).get('uk')); // 1
lid.dispose();
```

The default weight is 1 for fastText (`BOOST_WEIGHT`) and 20 for CLD3 (`CLD3_BOOST_WEIGHT`, from `defuss-lid/cld3-pack`); `boost: true` uses it, a number sets another weight, and `false` or 0 turns the boost off. Both defaults were tuned on held-out selection text, never on the benchmark: CLD3 gained up to weight 20, while higher fastText weights cost `der_3` and both fastText DNO-PQ packs ([results](documentation/results-dno-pq.md#letter-boost)). Boosted scores can exceed 1 (up to 21 for CLD3) and `threshold` applies to them, so to abstain on the model's own confidence, combine `threshold` with `boost: false`. Why on by default: the boost improved or kept the accuracy of every pack on every measured slice. CLD3 returns only its top language, so there the other languages have no model score: a language replaces the answer when its weighted support alone beats the answer's boosted score (when several tie, only if the answer's own support is 0), and the result is never `reliable`. The `reliable` flag is checked with or without the boost.

`node scripts/boost_eval.mjs 0,default` measured the boost on the benchmark cohorts (fastText DNO-PQ packs on 2026-11-04, CLD3 DNO-PQ packs at weight 20 on 2026-11-03); the figures without the boost (`boost: false`) are those of the [pack table](#packs). At weight 20 the boost adds up to 0.67 points to the CLD3 DNO-PQ packs:

| Pack | FLORES sentences, `boost: false` | default (boost) | FLORES first 20 code points, `boost: false` | default (boost) | MASSIVE utterances, `boost: false` | default (boost) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `der_3` | 100.00% | 100.00% | 98.98% | 99.04% | 99.39% | 99.44% |
| `deferi_6` | 99.97% | 99.97% | 95.73% | 95.75% | 98.56% | 98.58% |
| `major_20` | 99.91% | 99.94% | 94.10% | 94.37% | 97.54% | 97.66% |
| `full` | 98.13% | 98.16% | 82.63% | 83.30% | 92.02% | 92.21% |

The letter table (`src/charsets.ts`) has one line per language, `<code> <letters>`: the letters outside ASCII a–z for Latin-script languages (`de äöüß`), and for other scripts the letters only some of its languages use plus one letter per script (`ru аийцщъыьэюяё`, `el α`). It covers the 176 fastText and the 109 CLD3 labels; the [size table](#size) counts it in the runtime. The Python runtime has no boost.

The registry `defuss-lid/packs` lists every pack without loading one:

```js node bun browser
import {PACKS} from 'defuss-lid/packs';

console.log(PACKS.der_3.bytes, PACKS.der_3.languages.join(',')); // 77952 en,ru,de
console.log(PACKS.major_20.kind); // cld3-pack
```

| Import | Contents |
| --- | --- |
| `defuss-lid` (or `defuss-lid/fasttext`) | fastText runtime: `LidModel`, `loadModel`, `parseContainer`; `letterSupport`, `BOOST_WEIGHT` |
| `defuss-lid/cld3-pack` | CLD3 pack runtime: `loadCld3Pack`, `createCld3Pack`, `reconstructCld3`, `CLD3_BOOST_WEIGHT` |
| `defuss-lid/cld3` | the unmodified npm `cld3-asm@4.0.0` as an optional reference provider (install it yourself) |
| `defuss-lid/packs` | registry: names, languages, bytes and SHA-256 of the four packs |
| `defuss-lid/packs/{der_3,deferi_6,major_20,full}` | `load()`, `meta`, `labels`, `url` of one pack |
| `defuss-lid/models/*`, `defuss-lid/runtime/*` | the four pack files and the CLD3 core, for your own loader or bundler |

## Packs

<!-- packs:start -->
| Pack | Languages | Method | Pack | All-in | All-in gzipped | FLORES sentences | FLORES first 20 code points | MASSIVE utterances |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `der_3` | de, en, ru | fastText DNO-PQ | 78.0 kB | 111.3 kB | 81.8 kB | 100.00% | 98.98% | 99.39% |
| `deferi_6` | de, en, es, fr, it, ru | fastText DNO-PQ | 127.4 kB | 160.8 kB | 122.4 kB | 99.97% | 95.73% | 98.56% |
| `major_20` | ar, bn, de, en, es, fr, hi, id, it, ja, ko, nl, pl, pt, ru, th, tr, ur, vi, zh | CLD3 DNO-PQ | 110.6 kB | 299.3 kB | 208.2 kB | 99.91% | 94.10% | 97.54% |
| `full` | 109 CLD3 labels | CLD3 DNO-PQ | 130.5 kB | 319.2 kB | 224.9 kB | 98.13% | 82.63% | 92.02% |

The same languages on the other runtime, measured in the same run but not shipped as packs:

| Languages of | Method | Pack | All-in | All-in gzipped | FLORES sentences | FLORES first 20 code points | MASSIVE utterances |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `der_3` | CLD3 PQ + int8 | 106.6 kB | 295.3 kB | 204.2 kB | 99.97% | 94.99% | 97.19% |
| `deferi_6` | CLD3 PQ + int8 | 107.3 kB | 296.0 kB | 204.8 kB | 99.93% | 89.25% | 94.84% |
| `major_20` | fastText native PQ + int8 | 241.8 kB | 275.2 kB | 219.2 kB | 99.70% | 92.82% | 91.94% |
| `full` | fastText native PQ + int8 | 708.1 kB | 741.4 kB | 586.1 kB | 93.14% | 73.61% | 87.17% |
<!-- packs:end -->

kB = 1,000 bytes. **All-in** is what an application downloads to identify text: the pack plus its runtime, the fastText JavaScript or the CLD3 JavaScript and its WebAssembly core (see [Size](#size)); exact byte counts are in `defuss-lid/packs` (`PACKS.der_3.bytes`). Top-1 accuracy without the letter boost (`boost: false`; the default boost raises it, see [Letter boost](#letter-boost)) on held-out FLORES-200 devtest sentences (and their first 20 code points) and MASSIVE 1.1 test utterances, measured on 2026-11-02 (CLD3 DNO-PQ packs on 2026-11-03, fastText DNO-PQ packs on 2026-11-04); the full pack is evaluated on the 78 FLORES and 51 MASSIVE labels it shares with the benchmarks, not on all 109. For 3 languages the fastText pack is smaller and more accurate than CLD3; for 6 languages it is a larger file than its CLD3 counterpart, yet more accurate and, with the much smaller runtime, smaller all-in. For 20 languages the CLD3 DNO-PQ pack is more accurate on all three slices and smaller all-in once gzipped; fastText is smaller all-in uncompressed. For all languages CLD3 is both smaller and more accurate. The CLD3 alternatives for 3 and 6 languages are v0.3 PQ + int8 packs, which DNO-PQ did not refit. [results-v0.3.md](documentation/results-v0.3.md) has the remaining candidates, exact-subset baselines, paired bootstrap intervals and per-language failures (pruning hurts Chinese most); [results-fasttext-dno-pq.md](documentation/results-fasttext-dno-pq.md) compares the fastText DNO-PQ packs with `lid.176`, and [results-dno-pq.md](documentation/results-dno-pq.md) the CLD3 DNO-PQ packs with Google's original CLD3.

Every file of the v0.3 release, including the per-set candidates and baselines, is on Hugging Face at [kyr0/defuss-lid-1.0](https://huggingface.co/kyr0/defuss-lid-1.0), the fastText DNO-PQ packs with their model card at [kyr0/fastText-pq-dno](https://huggingface.co/kyr0/fastText-pq-dno), and the CLD3 DNO-PQ packs at [kyr0/cld3-pq-dno](https://huggingface.co/kyr0/cld3-pq-dno); `models.lock.json` pins all three revisions and the SHA-256 of each file.

## Size

<!-- sizes:start -->
| File | Size | Gzipped | What |
| --- | ---: | ---: | --- |
| `dist/index.js` (+ shared chunks) | 33.3 kB | 11.4 kB | fastText runtime: `LidModel`, `loadModel`, `letterSupport` |
| `dist/cld3-pack.js` (+ shared chunks) | 103.1 kB | 22.7 kB | CLD3 pack runtime with the Emscripten glue |
| `runtime/cld3-core.bin.gz` | 85.6 kB | 85.6 kB | shared CLD3 WebAssembly core, stored gzip-compressed; once per app |
| `der_3` | 78.0 kB | 70.5 kB | 3 languages, fastText pack |
| `deferi_6` | 127.4 kB | 111.0 kB | 6 languages, fastText pack |
| `major_20` | 110.6 kB | 99.9 kB | 20 languages, CLD3 pack |
| `full` | 130.5 kB | 116.6 kB | 109 languages, CLD3 pack |
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

[`docs/index.html`](docs/index.html) is the project site, built on [defuss-shadcn](https://shadcn.defuss.org/) and served as-is by GitHub Pages: a live demo of all packs with a letter-boost switch, a card per pack with its all-in size next to the other runtime, how both runtimes and the letter boost work, the accuracy table and the setups above. The demo opens with `major_20`, with one sample sentence per language. Its size and accuracy figures, like the tables in this README, are generated by `scripts/sizes.mjs`; the site shows accuracy with the default letter boost on both sides of every comparison ([Default results](documentation/results-dno-pq.md#default-results)), this README without it. It loads the runtime from `docs/assets/lib/` (a copy of `dist/`, refreshed by `bun run docs` and checked by `scripts/verify.mjs`) and the models from the pinned Hugging Face revisions. Run it locally with `bun run serve` and open <http://127.0.0.1:8080/docs/>.

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
  version      = {0.5.0},
  howpublished = {\url{https://github.com/kyr0/defuss-lid}},
  note         = {Models: \url{https://huggingface.co/kyr0/defuss-lid-1.0}}
}
```

## License

Code: [MIT](LICENSE). The model files keep the licenses of the weights they adapt: fastText-derived `.dlid` files are CC BY-SA 3.0 (Facebook/Meta fastText team), CLD3-derived `.cld3q` packs and the CLD3 core are Apache-2.0 (Google). Attribution, the list of changes and all license texts are in [NOTICE.md](NOTICE.md) and [`licenses/`](licenses/).
