# Documentation

Guides explain how the runtime and the tools work; reports record measurements and are dated snapshots: they describe the artifacts and code of their run and are not rewritten afterwards.

| Page | Kind | What it covers |
| --- | --- | --- |
| [architecture.md](architecture.md) | guide | DLID import from fastText, feature hashing, compression methods, runtime behaviour and limits |
| [subsets-and-cld3.md](subsets-and-cld3.md) | guide | label subsets, corpus feature pruning, CLD3 packs and their allowlist semantics |
| [benchmark-research.md](benchmark-research.md) | guide | published language-identification benchmarks and how they compare |
| [results-dno-pq.md](results-dno-pq.md) | report, 3 November 2026 | the CLD3 DNO-PQ packs `major_20` and `full`, the shipped CLD3 packs since then, against Google's original CLD3; every pack's accuracy with the default letter boost |
| [results-v0.3.md](results-v0.3.md) | report, 2 November 2026 | the four packs of v0.3: accuracy, sizes, baselines, paired intervals |
| [results-v0.2.md](results-v0.2.md) | report | CLD3 compression and the five-language subsets |
| [results.md](results.md) | report, 1 November 2026 | the first experiments: repacked fastText, PQ and OPTIC-inspired codebooks |

The v0.1 and v0.2 experimental model files (`compact-pq-176.dlid`, `optic-176.dlid`, `tiny-pq-176.dlid`, the `cld3/` and `cld3-five/` packs and the five-language subsets) are not part of the release; `scripts/reproduce.py` and `scripts/reproduce_v02.py` rebuild them. The release on [Hugging Face](https://huggingface.co/kyr0/defuss-lid-1.0) contains the v0.3 files, including byte-identical copies of the repacked fastText model (`full/fasttext-native-exact.dlid`) and the raw and PQ + int8 full CLD3 packs. The CLD3 DNO-PQ packs are on [Hugging Face](https://huggingface.co/kyr0/cld3-pq-dno) with their model card.

[ARCH.md](../ARCH.md) describes the repository's design; the [README](../README.md) shows how to use the package.
