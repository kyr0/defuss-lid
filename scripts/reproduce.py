"""Reproduce the benchmark; optionally rebuild the data-free compression grid.

Run from the repository root after `uv sync --extra baseline` (native fastText
for verify_native.py), `bun install` and `bun run build` (scripts/benchmark.mjs
runs the built runtime in dist/).
Existing shipped reports are never overwritten by default.

VERIFIED: --dry-run and --dry-run --fit exited 0 on 2026-11-02.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path

from download import ARTIFACTS, download


def main():
    """Download, prepare, export, optionally refit, benchmark and verify parity."""
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data", default="data", help="downloads and prepared corpora (default: %(default)s)")
    p.add_argument("--output", default="runs/reproduction", help="run directory for reports (default: %(default)s)")
    p.add_argument("--fit", action="store_true", help="rebuild all 21 candidates and validate before testing")
    p.add_argument("--dry-run", action="store_true", help="print commands without downloads or writes")
    a = p.parse_args()
    data, out = Path(a.data), Path(a.output)
    root = Path(__file__).resolve().parents[1]
    if Path.cwd() != root:
        p.error(f"run from {root}")
    # Single-threaded BLAS keeps k-means and timing results independent of core count.
    env = {**os.environ, "OPENBLAS_NUM_THREADS": "1", "OMP_NUM_THREADS": "1"}

    def run(*args):
        command = [str(x) for x in args]
        print(json.dumps({"command": command}), flush=True)
        if not a.dry_run:
            subprocess.run(command, check=True, env=env)

    def py(script, *args):
        run(sys.executable, "scripts/" + script, *args)

    if not a.dry_run:
        data.mkdir(parents=True, exist_ok=True)
        out.mkdir(parents=True, exist_ok=True)
        for name in ARTIFACTS:
            download(name, data)
        # Extract only regular corpus files into a known destination.
        with tarfile.open(data / "flores200_dataset.tar.gz", "r:gz") as tar:
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
    else:
        print(json.dumps({"download_and_verify": list(ARTIFACTS), "extract": "FLORES regular dev/devtest files"}))
    dev, flores, massive = (data / n for n in ("flores-dev.jsonl", "flores-devtest.jsonl", "massive-test.jsonl"))
    py("prepare_flores.py", data / "flores200_dataset", dev, "--split", "dev", "--limit", 100)
    py("prepare_flores.py", data / "flores200_dataset", flores, "--split", "devtest")
    py("prepare_massive.py", data / "amazon-massive-dataset-1.1.tar.gz", massive)
    run(sys.executable, "-m", "defuss_lid.cli", "export", data / "lid.176.bin", data / "official-bin.dlid")
    run(sys.executable, "-m", "defuss_lid.cli", "export", data / "lid.176.ftz", data / "official-ftz.dlid")
    models = [
        ("cld3", "-", "cld3"),
        ("dlid", data / "official-bin.dlid", "fasttext-bin"),
        ("dlid", data / "official-ftz.dlid", "fasttext-ftz"),
    ]
    variants = [
        ("compact-pq", "pq-50000-g4.dlid", "compact-pq-176.dlid"),
        ("optic", "optic-50000-g4.dlid", "optic-176.dlid"),
        ("tiny-pq", "pq-10000-g2.dlid", "tiny-pq-176.dlid"),
    ]
    if a.fit:
        candidates = out / "candidates"
        py("build_candidates.py", data / "lid.176.bin", candidates, "--iterations", 15, "--alternations", 2)
        names = [f"int8-{n}.dlid" for n in (10000, 25000, 50000)]
        names += [
            f"{m}-{n}-g{g}.dlid" for n in (10000, 25000, 50000) for m in ("pq", "task-pq", "optic") for g in (2, 4)
        ]
        validation = models + [("dlid", candidates / n, Path(n).stem) for n in names]
        reports = []
        for kind, model, tag in validation:
            report = out / "validation" / f"{tag}.json"
            reports.append(report)
            run("node", "scripts/benchmark.mjs", kind, model, dev, report)
        py(
            "select_candidate.py",
            *reports,
            "--baseline",
            "official-ftz.dlid",
            "--output",
            out / "validation-selection.json",
        )
        models += [("dlid", candidates / source, tag) for tag, source, _ in variants]
    else:
        models += [("dlid", Path("models") / bundled, tag) for tag, _, bundled in variants]
    lock = {
        "models": [[kind, str(model), tag] for kind, model, tag in models],
        "flores": str(flores),
        "massive": str(massive),
        "reason": "fixed baselines, 465 KB PQ/OPTIC ablation and 101 KB endpoint; no test-based tuning",
    }
    if not a.dry_run:
        (out / "test-lock.json").write_text(json.dumps(lock, indent=2) + "\n")
    for dataset, path, slices in [("flores", flores, "full,20,80"), ("massive", massive, "full")]:
        reports = []
        for kind, model, tag in models:
            report = out / "final" / f"{dataset}-{tag}.json"
            reports.append(report)
            run("node", "scripts/benchmark.mjs", kind, model, path, report, slices)
        py("summarize.py", *reports, "--output", out / f"{dataset}-summary.json")
    for kind in ("bin", "ftz"):
        py("verify_native.py", data / f"lid.176.{kind}", "--dataset", dev, "--output", out / f"parity-{kind}.json")


if __name__ == "__main__":
    main()
