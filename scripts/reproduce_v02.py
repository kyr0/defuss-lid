"""Rebuild and evaluate v0.2 allowlists and CLD3 packs on pinned corpora.

Run from the repository root: uv run python scripts/reproduce_v02.py, after
`bun install` and `bun run build` (scripts/benchmark.mjs runs dist/).
Stages are independently resumable; evaluation never fits parameters.

VERIFIED: --help lists --stage with only the built wheel installed (scripts/e2e.mjs checks the README
command).
"""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path

# Set before numpy/scipy load: single-threaded BLAS keeps k-means results reproducible.
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
from defuss_lid.cld3_pack import build, source_assets
from defuss_lid.format import load, save
from defuss_lid.subset import restrict
from download import download
from prepare_flores import prepare

METHODS = ["raw", "int8", "pq", "tiny-pq", "pq-int8", "tiny-pq-int8"]
SUBSET_METHODS = ["raw", "int8", "pq-int8", "tiny-pq-int8"]


def main():
    """Run the selected v0.2 stage (or all) in order: prepare, build, dev, final."""
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data", default="data", help="downloads and prepared corpora (default: %(default)s)")
    p.add_argument("--output", default="runs/v0.2", help="run directory for models and reports (default: %(default)s)")
    p.add_argument("--languages", default="de,en,fr,es,ru", help="comma-separated subset labels (default: %(default)s)")
    p.add_argument(
        "--stage",
        choices=["all", "prepare", "build", "dev", "final"],
        default="all",
        help="run one stage only; stages are resumable (default: %(default)s)",
    )
    a = p.parse_args()
    data = Path(a.data)
    out = Path(a.output)
    out.mkdir(parents=True, exist_ok=True)
    langs = a.languages.split(",")
    models = out / "models"
    env = {**os.environ, "OPENBLAS_NUM_THREADS": "1", "OMP_NUM_THREADS": "1"}

    def run(*args):
        cmd = list(map(str, args))
        print(json.dumps({"command": cmd}), flush=True)
        subprocess.run(cmd, check=True, env=env)

    def py(script, *args):
        run(sys.executable, "scripts/" + script, *args)

    def active(stage):
        return a.stage in ("all", stage)

    dev = data / "flores-dev.jsonl"
    flores = data / "flores-devtest.jsonl"
    massive = data / "massive-test.jsonl"
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
        prepare(data / "flores200_dataset", dev, "dev", 100)
        prepare(data / "flores200_dataset", flores, "devtest", 0)
        archive = download("amazon-massive-dataset-1.1.tar.gz", data)
        py("prepare_massive.py", archive, massive)
    if active("build"):
        base, params = source_assets("node_modules/cld3-asm", "inspection/cld3-parameters.npz", out / "runtime")
        for directory, methods, allow in [("cld3", METHODS, None), ("cld3-five", SUBSET_METHODS, langs)]:
            records = []
            for method in methods:
                records.append(build(base, params, models / directory / f"{method}.cld3q", method, allow))
            (models / directory / "build-manifest.json").write_text(
                json.dumps(records, indent=2) + "\n", encoding="utf-8"
            )
        meta, arrays = load("models/v0.3/full/fasttext-native-exact.dlid")
        save(models / "subsets/fasttext-five-exact.dlid", *restrict(meta, arrays, langs))
        save(models / "subsets/fasttext-five-observed.dlid", *restrict(meta, arrays, langs, dev))
    if active("dev"):
        reports = []
        for method in METHODS:
            target = out / "dev" / f"{method}.json"
            reports.append(target)
            run("node", "scripts/benchmark.mjs", "cld3-pack", models / "cld3" / f"{method}.cld3q", dev, target)
        py("select_candidate.py", *reports, "--baseline", "raw.cld3q", "--output", out / "cld3-dev-selection.json")
    if active("final"):
        selected = json.loads((out / "cld3-dev-selection.json").read_text(encoding="utf-8"))["selected"]
        lock = {
            "full_methods": METHODS,
            "subset_languages": langs,
            "subset_methods": SUBSET_METHODS,
            "selected": selected,
            "heldout_tuning": False,
            "calibration": str(dev),
            "calibration_sha256": hashlib.sha256(dev.read_bytes()).hexdigest(),
            "feature_rule": "observed document frequency >=1; no row budget",
            "full_selection_rule": "minimum pack bytes within 0.5pp macro-F1 loss on every dev slice",
        }
        (out / "test-lock.json").write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")
        for dataset, path, lengths in [("flores", flores, "full,20,80"), ("massive", massive, "full")]:
            reports = []
            for method in METHODS:
                target = out / "final" / f"{dataset}-{method}.json"
                reports.append(target)
                run(
                    "node",
                    "scripts/benchmark.mjs",
                    "cld3-pack",
                    models / "cld3" / f"{method}.cld3q",
                    path,
                    target,
                    lengths,
                )
            py("summarize.py", *reports, "--output", out / f"{dataset}-summary.json")
            subset = path.with_name(path.stem + "-five.jsonl")
            with path.open(encoding="utf-8") as src, subset.open("w", encoding="utf-8") as dst:
                for line in src:
                    if json.loads(line)["language"] in langs:
                        dst.write(line)
            cases = [
                ("dlid", "models/v0.3/full/fasttext-native-exact.dlid", "fasttext-full", None),
                ("dlid", "models/v0.3/full/fasttext-native-exact.dlid", "fasttext-restricted", a.languages),
                ("dlid", models / "subsets/fasttext-five-exact.dlid", "fasttext-five-exact", None),
                ("dlid", models / "subsets/fasttext-five-observed.dlid", "fasttext-five-observed", None),
                ("cld3-pack", models / "cld3/raw.cld3q", "cld3-full", None),
            ]
            cases += [
                ("cld3-pack", models / "cld3-five" / f"{m}.cld3q", f"cld3-five-{m}", None) for m in SUBSET_METHODS
            ]
            reports = []
            for kind, model, tag, allow in cases:
                target = out / "subsets" / f"{dataset}-{tag}.json"
                reports.append(target)
                run("node", "scripts/benchmark.mjs", kind, model, subset, target, lengths, *([allow] if allow else []))
            py("summarize.py", *reports, "--output", out / f"{dataset}-subset-summary.json")


if __name__ == "__main__":
    main()
