"""Rebuild fixed v0.3 packs and evaluate identical held-out cohorts.

All three compression candidates and both baselines are declared before scoring.
Run from the repository root after `bun install` and `bun run build` (the benchmark
stage runs scripts/benchmark.mjs on dist/). No test-set selection or LID retraining.

VERIFIED: --help exits 0 with only the built wheel installed (scripts/e2e.mjs checks the documented command).
"""

import argparse
import collections
import hashlib
import json
import os
import shutil
import subprocess
import tarfile
from pathlib import Path

# Set before numpy/scipy load: single-threaded BLAS keeps k-means results reproducible.
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
from defuss_lid.cld3_pack import LABELS, build, source_assets
from defuss_lid.compress import compress, prune, quantize_head
from defuss_lid.evaluate import summarize
from defuss_lid.format import load, save
from defuss_lid.native import read_fasttext
from defuss_lid.runtime import Model
from defuss_lid.subset import restrict
from download import download
from prepare_flores import prepare as flores_prepare
from prepare_massive import prepare as massive_prepare

# Language sets; None = the full native inventory of each model.
SETS = {
    "3": ["de", "en", "ru"],
    "6": ["de", "en", "fr", "es", "ru", "it"],
    "20": "en de fr it ru id es pt nl ur vi th zh ja pl tr ar ko bn hi".split(),
    "full": None,
}
# Benchmark case -> (runtime kind, file extension); three candidates, then two baselines.
CASES = {
    "cld3-pq-int8": ("cld3-pack", ".cld3q"),
    "fasttext-pq-int8": ("dlid", ".dlid"),
    "fasttext-native-pq-int8": ("dlid", ".dlid"),
    "cld3-raw": ("cld3-pack", ".cld3q"),
    "fasttext-native-exact": ("dlid", ".dlid"),
}


def sha(path):
    """Return the hex SHA-256 of the file at `path`."""
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def cohorts(data, reports):
    """Write the per-set FLORES/MASSIVE cohorts and their manifests; return their paths.

    Each set keeps exactly the records whose gold language is in the set, so all
    cases of one set are scored on identical examples. Raises ValueError when a
    requested language has no records.
    """
    result = {}
    for dataset, source in [("flores", data / "flores-devtest.jsonl"), ("massive", data / "massive-all-test.jsonl")]:
        rows = [json.loads(line) for line in source.read_text().splitlines()]
        for key, langs in SETS.items():
            selected = rows if langs is None else [r for r in rows if r["language"] in langs]
            if langs is not None and set(langs) != {r["language"] for r in selected}:
                raise ValueError("incomplete cohort")
            path = data / "v0.3" / f"{dataset}-{key}.jsonl"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in selected), encoding="utf-8")
            manifest = {
                "dataset": dataset,
                "set": key,
                "records": len(selected),
                "labels": sorted({r["language"] for r in selected}),
                "per_language": dict(sorted(collections.Counter(r["language"] for r in selected).items())),
                "locales": sorted({r["locale"] for r in selected if "locale" in r}),
                "sha256": sha(path),
                "source_sha256": sha(source),
                "file": path.name,
            }
            (reports / f"{dataset}-{key}.manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
            result[(dataset, key)] = path
    return result


def main():
    """Run the selected v0.3 stage (or all) in order: prepare, build, benchmark, summarize."""
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data", default="data", help="downloads and prepared corpora (default: %(default)s)")
    p.add_argument("--models", default="models/v0.3", help="output directory for the packs (default: %(default)s)")
    p.add_argument("--reports", default="reports/v0.3", help="evidence directory (default: %(default)s)")
    p.add_argument(
        "--stage",
        choices=["all", "prepare", "build", "benchmark", "summarize"],
        default="all",
        help="run one stage only (default: %(default)s)",
    )
    p.add_argument("--only", help="optional comma-separated benchmark case names; default is all five")
    a = p.parse_args()
    data = Path(a.data)
    models = Path(a.models)
    reports = Path(a.reports)
    reports.mkdir(parents=True, exist_ok=True)
    data.mkdir(parents=True, exist_ok=True)

    def active(stage):
        return a.stage in ("all", stage)

    only = a.only.split(",") if a.only else list(CASES)
    if set(only) - set(CASES):
        p.error("unknown benchmark case")
    if active("prepare"):
        archive = download("flores200_dataset.tar.gz", data)
        with tarfile.open(archive, "r:gz") as tar:
            for member in tar:
                parts = Path(member.name).parts
                if (
                    member.isfile()
                    and len(parts) == 3
                    and parts[0] == "flores200_dataset"
                    and parts[1] in ("dev", "devtest")
                    and ".." not in parts
                ):
                    target = data.joinpath(*parts)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with tar.extractfile(member) as src, target.open("wb") as dst:
                        shutil.copyfileobj(src, dst)
        flores_prepare(data / "flores200_dataset", data / "flores-dev.jsonl", "dev", 100)
        flores_prepare(data / "flores200_dataset", data / "flores-devtest.jsonl", "devtest", 0)
        massive_prepare(
            download("amazon-massive-dataset-1.1.tar.gz", data), data / "massive-all-test.jsonl", locales="all"
        )
        for name in ["flores-dev", "flores-devtest", "massive-all-test"]:
            shutil.copyfile(data / f"{name}.manifest.json", reports / f"{name}.manifest.json")
        cohorts(data, reports)
    if active("build"):
        base, params = source_assets("node_modules/cld3-asm", "inspection/cld3-parameters.npz", "runtime")
        nm, na = read_fasttext(download("lid.176.ftz", data))
        bm, ba = prune(*read_fasttext(download("lid.176.bin", data)), 50000, "norm")
        manifest = []
        for key, langs in SETS.items():
            directory = models / key
            directory.mkdir(parents=True, exist_ok=True)
            for method in ["raw", "pq-int8"]:
                build(base, params, directory / f"cld3-{method}.cld3q", method, langs, seed=42, iterations=20)
            save(directory / "fasttext-native-exact.dlid", *((nm, na) if langs is None else restrict(nm, na, langs)))
            observed = (nm, na) if langs is None else restrict(nm, na, langs, data / "flores-dev.jsonl")
            save(directory / "fasttext-native-pq-int8.dlid", *quantize_head(*observed))
            ordinary = (bm, ba) if langs is None else restrict(bm, ba, langs, data / "flores-dev.jsonl")
            cm, ca = compress(*ordinary, method="pq-int8", groups=4, seed=42, iterations=20)
            Model(cm, ca)
            save(directory / "fasttext-pq-int8.dlid", cm, ca)
            for name, (kind, ext) in CASES.items():
                file = directory / (name + ext)
                meta, arrays = load(file)
                if kind == "dlid":
                    Model(meta, arrays)
                entry = {
                    "set": key,
                    "case": name,
                    "kind": kind,
                    "path": file.as_posix(),
                    "bytes": file.stat().st_size,
                    "sha256": sha(file),
                    "labels": meta["labels"],
                    "label_count": len(meta["labels"]),
                    "feature_selection": meta.get("feature_selection"),
                    "head_kind": meta.get("head_kind"),
                    "retained_rows": len(meta.get("words", [])) + len(arrays.get("bucket_ids", []))
                    if kind == "dlid"
                    else None,
                }
                manifest.append(entry)
                print(json.dumps({k: entry[k] for k in ["set", "case", "bytes", "label_count"]}), flush=True)
        lock = {
            "version": "0.3.0",
            "sets": SETS,
            "cases": list(CASES),
            "models": manifest,
            "calibration_sha256": sha(data / "flores-dev.jsonl"),
            "fit": "no LID retraining; kmeans on released weights; seed=42, 20 iterations, 4 groups, 256 centroids",
            "fasttext_ordinary": "lid.176.bin; norm cutoff 50000; subset calibration observed rows; PQ; int8 head",
            "fasttext_native": "lid.176.ftz native norm-PQ; subset calibration observed rows; int8 head",
            "subset_feature_rule": "FLORES dev: 100 examples/language; document frequency >=1; no extra feature cap",
            "full_features": "no corpus pruning; fastText native all released rows, ordinary norm cutoff 50000",
            "heldout_tuning": False,
            "cld3_not_in_fasttext": sorted(set(LABELS) - set(nm["labels"])),
        }
        (reports / "build-lock.json").write_text(json.dumps(lock, indent=2) + "\n")
    if active("benchmark"):
        lock = json.loads((reports / "build-lock.json").read_text())
        for item in lock["models"]:
            if sha(item["path"]) != item["sha256"]:
                raise ValueError("model changed after build lock")
        datasets = cohorts(data, reports)
        for key in SETS:
            for dataset, lengths in [("flores", "full,20,80"), ("massive", "full")]:
                for name, (kind, ext) in CASES.items():
                    if name not in only:
                        continue
                    target = reports / key / f"{dataset}-{name}.json"
                    subprocess.run(
                        [
                            "node",
                            "scripts/benchmark.mjs",
                            kind,
                            str(models / key / (name + ext)),
                            str(datasets[(dataset, key)]),
                            str(target),
                            lengths,
                        ],
                        check=True,
                    )
    if active("summarize"):
        results = []
        for key in SETS:
            for dataset in ["flores", "massive"]:
                for name in CASES:
                    report = summarize(reports / key / f"{dataset}-{name}.json")
                    report.update(set=key, case=name, benchmark=dataset)
                    results.append(report)
                    print(
                        key,
                        dataset,
                        name,
                        report["model_bytes"],
                        {s: round(m["accuracy"] * 100, 4) for s, m in report["metrics"].items()},
                        flush=True,
                    )
        (reports / "summary.json").write_text(json.dumps({"version": "0.3.0", "results": results}, indent=2) + "\n")


if __name__ == "__main__":
    main()
