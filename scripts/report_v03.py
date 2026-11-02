"""Render v0.3 benchmark tables, artifact sizes and paired uncertainty.

Reads the build lock, dataset manifests, benchmark summaries and raw prediction
files under --reports, checks every model hash against the build lock and the
benchmark reports before using a number, and writes the Markdown report to
--output. Also writes artifact-sizes.json and paired-comparisons.json into
--reports. Runtime sizes are measured on the built JS runtime in dist/ (run
`bun run build` first) and the gzip-stored CLD3 core in runtime/.

VERIFIED: on 2026-11-02 its output differed from the previous version only in the reproduce block and the
dist/ notes.
"""

import argparse
import gzip
import hashlib
import json
from pathlib import Path

from defuss_lid.evaluate import paired_accuracy_ci

NAMES = {
    "cld3-pq-int8": "CLD3 PQ + int8",
    "fasttext-pq-int8": "fastText ordinary PQ + int8",
    "fasttext-native-pq-int8": "fastText native PQ + int8",
    "cld3-raw": "CLD3 original weights",
    "fasttext-native-exact": "fastText native PQ, exact output subset",
}
# The first three cases are compression candidates; the last two are baselines.
CANDIDATES = list(NAMES)[:3]
LABELS = {
    "3": "de, en, ru",
    "6": "de, en, fr, es, ru, it",
    "20": "en, de, fr, it, ru, id, es, pt, nl, ur, vi, th, zh, ja, pl, tr, ar, ko, bn, hi",
    "full": "CLD3: 109 labels; fastText: 176 labels",
}


def shared_runtime_files():
    """Return the runtime files an application ships once per pack kind.

    The pkgroll build puts the shared container parser in a content-hashed
    chunk (dist/container-<hash>.js), so it is globbed rather than named.
    """
    chunks = [p.as_posix() for p in sorted(Path("dist").glob("container-*.js"))]
    if not chunks:
        raise SystemExit("dist/container-*.js not found: build the JS runtime first (bun run build)")
    return {
        "cld3-pack": ["runtime/cld3-core.bin.gz", "dist/cld3-pack.js", *chunks],
        "dlid": ["dist/index.js", *chunks],
    }


def full_slice_predictions(reports, key, dataset, case):
    """Return the full-text prediction rows of one benchmark case."""
    lines = (reports / key / f"{dataset}-{case}.predictions.jsonl").read_text().splitlines()
    return [r for r in map(json.loads, lines) if r["slice"] == "full"]


def main():
    """Verify the evidence files and write the v0.3 results report."""
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--reports", default="reports/v0.3", help="benchmark evidence directory (default: %(default)s)")
    p.add_argument(
        "--output", default="documentation/results-v0.3.md", help="Markdown report to write (default: %(default)s)"
    )
    a = p.parse_args()
    reports = Path(a.reports)
    summary = json.loads((reports / "summary.json").read_text())["results"]
    lookup = {(r["set"], r["benchmark"], r["case"]): r for r in summary}
    runtime_files = shared_runtime_files()
    runtime = {kind: sum(Path(f).stat().st_size for f in files) for kind, files in runtime_files.items()}
    # The CLD3 core is stored gzipped already; count those bytes as they are.
    runtime_gz = {
        kind: sum(
            Path(f).stat().st_size
            if f.endswith(".gz")
            else len(gzip.compress(Path(f).read_bytes(), mtime=0, compresslevel=9))
            for f in files
        )
        for kind, files in runtime_files.items()
    }
    lock = json.loads((reports / "build-lock.json").read_text())
    sizes = []
    for model in lock["models"]:
        raw = Path(model["path"]).read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        # Every reported number must come from the exact bytes in the build lock.
        assert digest == model["sha256"]
        for dataset in ["flores", "massive"]:
            r = lookup[(model["set"], dataset, model["case"])]
            assert r["model_sha256"] == digest
            cohort = json.loads((reports / f"{dataset}-{model['set']}.manifest.json").read_text())
            assert r["dataset_sha256"] == cohort["sha256"] and r["metrics"]["full"]["n"] == cohort["records"]
            assert set(cohort["labels"]) <= set(model["labels"])
        sizes.append(
            {
                **model,
                "gzip9_bytes": len(gzip.compress(raw, mtime=0, compresslevel=9)),
                "shared_runtime_bytes": runtime[model["kind"]],
                "pack_plus_runtime_bytes": len(raw) + runtime[model["kind"]],
                "gzip_pack_plus_runtime_bytes": len(gzip.compress(raw, mtime=0, compresslevel=9))
                + runtime_gz[model["kind"]],
            }
        )
    (reports / "artifact-sizes.json").write_text(
        json.dumps(
            {
                "models": sizes,
                "runtime_files": runtime_files,
                "runtime_bytes": runtime,
                "runtime_gzip_bytes": runtime_gz,
            },
            indent=2,
        )
        + "\n"
    )
    lines = [
        "# v0.3: language packs with PQ + int8",
        "",
        "Measured on 2026-11-02. These are held-out **top-1 accuracy percentages**, not model confidence scores. "
        "All candidate settings were fixed before evaluation; no LID model was trained from scratch. "
        "Old v0.1/v0.2 evidence remains in its own report folders.",
        "",
        "The useful compact choices in this run are native-PQ fastText + int8 for the 3- and 6-language sets, "
        "and CLD3 PQ + int8 for the 20-language and full-inventory configurations. "
        "Ordinary-PQ fastText gives smaller 3/6-language packs with weaker short-text accuracy. "
        "This is an observed tradeoff, not proof of a universal smallest/best model.",
        "",
        "## Requested language inventories",
        "",
        "| Set | Labels |",
        "| --- | --- |",
    ]
    for key, value in LABELS.items():
        lines.append(f"| {key} | `{value}` |")
    lines += [
        "",
        "The user’s Snowball/segmenter/trigram annotations and pasted percentages were not used as LID targets, "
        "training inputs, or expected scores. The 20 language names determine the allowlist.",
        "",
        "## Compression results",
        "",
        "kB = 1,000 bytes. Pack size includes tensor data, codebooks, sparse feature IDs/dictionary, "
        "and container metadata; it excludes shared runtime files. "
        "Each row pair for a given set uses exactly the same examples and preprocessing.",
        "",
        "| Set | Method | Pack kB | FLORES sentences % | FLORES first 20 code points % | MASSIVE utterances % |",
        "| --- | --- | ---: | ---: | ---: | ---: |",
    ]
    for key in LABELS:
        for case in CANDIDATES:
            f = lookup[key, "flores", case]
            m = lookup[key, "massive", case]
            lines.append(
                f"| {key} | {NAMES[case]} | {f['model_bytes'] / 1000:.2f} "
                f"| {100 * f['metrics']['full']['accuracy']:.2f} "
                f"| {100 * f['metrics']['prefix-20']['accuracy']:.2f} "
                f"| {100 * m['metrics']['full']['accuracy']:.2f} |"
            )
    lines += [
        "",
        "Small differences, such as the 3-language CLD3 versus ordinary-PQ fastText MASSIVE result, "
        "should not be treated as a robust quality advantage. Paired bootstrap intervals are recorded below.",
        "",
        "## Baselines for the same output inventories",
        "",
        "CLD3 original weights are physically output-subsetted but not newly quantized. "
        "fastText exact subsets preserve the released `.ftz` input PQ and FP32 classifier coefficients "
        "and all input features. They isolate the loss introduced by extra quantization and feature pruning.",
        "",
        "| Set | Baseline | Pack kB | FLORES % | MASSIVE % |",
        "| --- | --- | ---: | ---: | ---: |",
    ]
    for key in LABELS:
        for case in list(NAMES)[3:]:
            f = lookup[key, "flores", case]
            m = lookup[key, "massive", case]
            lines.append(
                f"| {key} | {NAMES[case]} | {f['model_bytes'] / 1000:.2f} "
                f"| {100 * f['metrics']['full']['accuracy']:.2f} | {100 * m['metrics']['full']['accuracy']:.2f} |"
            )
    lines += [
        "",
        "For 20 languages, the observed-feature native fastText pack loses about 4 percentage points on MASSIVE "
        "relative to its exact subset. The FLORES dev calibration corpus does not fully cover conversational "
        "features. This is why reduced feature coverage must be evaluated on a separate domain. "
        "CLD3 keeps its shared feature tables. Chinese is the largest observed pruning failure: "
        "native-PQ fastText falls from 88.70%/85.24% to 60.49%/44.92% on zh-CN/zh-TW. "
        "The compact pack is not a replacement for the exact baseline when that coverage matters.",
        "",
        "## Deployment footprint",
        "",
        f"The current shared CLD3 runtime is **{runtime['cld3-pack']:,} bytes**; "
        f"fastText JS is **{runtime['dlid']:,} bytes**. Add it once per application, not once per pack. "
        "This includes the gzip-stored CLD3 core and the built JS modules in `dist/` that the runtime loads, "
        "but excludes the host JS/WASM engine. CLD3 packs reconstruct the fixed native WASM layout; "
        "these savings do **not** imply reduced inference RAM.",
        "",
        "| Set | Method | Pack bytes | Gzip pack bytes | Pack + runtime bytes | Gzip assets total bytes |",
        "| --- | --- | ---: | ---: | ---: | ---: |",
    ]
    for s in sizes:
        if s["case"] in CANDIDATES:
            lines.append(
                f"| {s['set']} | {NAMES[s['case']]} | {s['bytes']:,} | {s['gzip9_bytes']:,} "
                f"| {s['pack_plus_runtime_bytes']:,} | {s['gzip_pack_plus_runtime_bytes']:,} |"
            )
    lines += [
        "",
        "Gzip assets total compresses each non-gzip asset separately at level 9 with mtime=0; "
        "already compressed core bytes are counted once. Runtime sizes are the unminified pkgroll build in "
        "`dist/`. Benchmark JSON retains runtime byte counts at the time each measurement ran; "
        "this deployment table measures the final release files.",
        "",
        "## Cohorts and limitations",
        "",
        "| Set | FLORES devtest records / labels | MASSIVE test records / labels / locales |",
        "| --- | ---: | ---: |",
    ]
    for key in LABELS:
        f = json.loads((reports / f"flores-{key}.manifest.json").read_text())
        m = json.loads((reports / f"massive-{key}.manifest.json").read_text())
        lines.append(
            f"| {key} | {f['records']:,} / {len(f['labels'])} "
            f"| {m['records']:,} / {len(m['labels'])} / {len(m['locales'])} |"
        )
    lines += [
        "",
        "FLORES uses 1,012 aligned held-out sentences per language. The first 20/80 code-point slices are "
        "artificial crops, not independent natural short-text data. MASSIVE uses 2,974 held-out utterances "
        "per locale. Both Chinese locales map to `zh`, so Chinese has double weight in MASSIVE micro accuracy; "
        "`nb-NO` maps to model label `no`. Per-language macro-F1 is also reported. "
        "The v0.3 full MASSIVE cohort expands v0.2 from 24 to 52 locales, so those headline percentages "
        "are not a direct version-to-version regression comparison.",
        "",
        "**Full means full native model inventory, not full benchmark coverage.** "
        "FLORES evaluates 78 common labels; MASSIVE evaluates 51 common labels. "
        "We did not measure all 109 CLD3 labels or all 176 fastText labels. "
        "Full models compete against their complete native output inventories; output inventory sizes differ. "
        "No per-record oracle candidate filtering is used. The fixed smaller allowlists define separate "
        "closed-set tasks; scores across different sets are not directly comparable.",
        "",
        "fastText cannot represent these 17 CLD3 labels without new model work: `"
        + ", ".join(lock["cld3_not_in_fasttext"])
        + "`. An exact 109-label fastText counterpart is therefore not supplied. "
        "`he` and `tl` normalize upstream CLD3 `iw` and `fil`. "
        "No unsupported-language rejection or mixed-language accuracy is claimed.",
        "",
        "## Macro-F1 and longer crops",
        "",
        "| Set | Method | FLORES full F1 % | FLORES 20 F1 % | FLORES 80 accuracy % | MASSIVE F1 % |",
        "| --- | --- | ---: | ---: | ---: | ---: |",
    ]
    for key in LABELS:
        for case in CANDIDATES:
            f = lookup[key, "flores", case]["metrics"]
            m = lookup[key, "massive", case]["metrics"]
            lines.append(
                f"| {key} | {NAMES[case]} | {100 * f['full']['macro_f1']:.2f} "
                f"| {100 * f['prefix-20']['macro_f1']:.2f} | {100 * f['prefix-80']['accuracy']:.2f} "
                f"| {100 * m['full']['macro_f1']:.2f} |"
            )
    lines += [
        "",
        "## Twenty-language MASSIVE accuracy by language",
        "",
        "| Language | CLD3 PQ + int8 % | fastText ordinary PQ + int8 % | fastText native PQ + int8 % "
        "| fastText exact baseline % |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    per = [
        lookup["20", "massive", case]["metrics"]["full"]["per_language"]
        for case in CANDIDATES + ["fasttext-native-exact"]
    ]
    for label in LABELS["20"].split(", "):
        lines.append("| " + label + " | " + " | ".join(f"{100 * p[label]['recall']:.2f}" for p in per) + " |")
    lines += [
        "",
        "Per-language accuracy equals recall on that language’s gold examples. It differs from precision and F1. "
        "Full confusion evidence is retained as predictions, with IDs and gold labels but no source utterance text.",
        "",
        "## Paired uncertainty",
        "",
        "CLD3 PQ + int8 accuracy minus each fastText candidate, in percentage points. "
        "95% percentile intervals from 2,000 paired bootstrap draws, seed 42, over aligned source groups. "
        "This preserves translated-example dependence and is descriptive, "
        "not a multiple-comparison-corrected selection test.",
        "",
        "| Set | Dataset | Comparator | Delta pp | 95% interval pp |",
        "| --- | --- | --- | ---: | --- |",
    ]
    comparisons = []
    for key in LABELS:
        for dataset in ["flores", "massive"]:
            left = full_slice_predictions(reports, key, dataset, "cld3-pq-int8")
            for case in CANDIDATES[1:]:
                ci = paired_accuracy_ci(left, full_slice_predictions(reports, key, dataset, case))
                comparisons.append({"set": key, "dataset": dataset, "a": "cld3-pq-int8", "b": case, **ci})
                lines.append(
                    f"| {key} | {dataset} | {NAMES[case]} | {100 * ci['accuracy_delta']:+.2f} "
                    f"| [{100 * ci['ci95'][0]:+.2f}, {100 * ci['ci95'][1]:+.2f}] |"
                )
    (reports / "paired-comparisons.json").write_text(json.dumps(comparisons, indent=2) + "\n")
    lines += [
        "",
        "## Build procedure and evidence",
        "",
        "- **CLD3:** ordinary PQ, 4 groups × 256 centroids on its three large embeddings; "
        "preserve native per-row bfloat16 scales. Per-output-neuron int8 for hidden and retained output weights, "
        "FP32 bias/scales. Retain only requested output columns; embeddings are shared and remain intact.",
        "- **fastText ordinary PQ:** start with released uncompressed `lid.176.bin`, retain 50,000 input rows "
        "by norm (EOS retained), then restrict outputs and observed features for smaller sets. "
        "Fit 4 groups × 256 centroids, 20 iterations, seed 42; quantize classifier rows to int8.",
        "- **fastText native PQ:** reuse released `lid.176.ftz` 8-group norm-PQ without refitting it; "
        "restrict output paths and observed features for smaller sets; quantize classifier rows to int8.",
        "- **Feature calibration:** only 100 FLORES dev sentences per requested language, "
        "document frequency at least 1, no extra row cap. Test/devtest data is rejected by the pruning API. "
        "Full models do not use corpus pruning; all native labels are retained. "
        "Hashed buckets are shared/colliding and have no exclusive language ownership.",
        "- **Int8 head format:** DLID0002 makes older loaders reject new heads; v0.3 reads DLID0001 and DLID0002. "
        "The Python and JS kernels apply the per-row scale to the classifier dot product. "
        "Recompression and further output subsetting preserve the encoding correctly.",
        "- **Runtime checks:** 32 Python tests; 12 Node and 12 Bun tests; Chromium/Node exact score and ranking "
        "agreement on 36 models × 20 fixtures. CI is provided for Linux/macOS/Windows; "
        "only Linux execution is claimed here.",
        "- **Evidence:** `reports/v0.3/build-lock.json`, dataset manifests, artifact sizes, 40 benchmark reports "
        "and their raw prediction files, per-language metrics, paired intervals, and environment versions. "
        "File hashes are verified before benchmarking and before generating this report. Timing/RSS are "
        "host-dependent and include dataset/prediction process overhead; "
        "they are not isolated model memory measurements.",
        "",
        "```sh cli",
        "bun install",
        "bun run build",
        "uv sync",
        "uv run python scripts/reproduce_v03.py",
        "uv run python scripts/report_v03.py",
        "```",
        "",
        "Use `--data`, `--models`, and `--reports` to place a rebuild elsewhere. "
        "Stages are `prepare`, `build`, `benchmark`, `summarize`; `--only` selects benchmark cases for a "
        "partial rerun. The report script accepts `--reports` and `--output`. Source downloads are SHA-256 pinned. "
        "Numerical library versions can affect fitted codebooks; the release records the measured versions.",
        "",
    ]
    out = Path(a.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines))
    print(
        json.dumps(
            {"report": str(out), "models": len(sizes), "comparisons": len(comparisons), "runtime_bytes": runtime}
        )
    )


if __name__ == "__main__":
    main()
