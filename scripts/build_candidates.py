"""Fixed, data-free compression grid. No validation or test text is read.

Builds every cutoff x method x groups combination from one fastText model so
that candidates are chosen afterwards on validation data only
(scripts/select_candidate.py), never tuned while building. The manifest is
rewritten after each model so an interrupted run keeps its finished entries.

UNKNOWN: not rerun on 2026-11-02 (needs downloaded corpora or weights); py_compile and --help pass.
"""

import argparse
import json
import time
from pathlib import Path

from defuss_lid.compress import compress, prune
from defuss_lid.format import save
from defuss_lid.native import read_fasttext
from defuss_lid.runtime import Model

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("source", help="fastText .bin/.ftz model")
p.add_argument("output", help="directory for the candidate .dlid files and build-manifest.json")
p.add_argument("--cutoffs", default="10000,25000,50000", help="comma-separated row cutoffs (default: %(default)s)")
p.add_argument("--groups", default="2,4", help="comma-separated PQ group counts (default: %(default)s)")
p.add_argument("--methods", default="int8,pq,task-pq,optic", help="comma-separated methods (default: %(default)s)")
p.add_argument("--iterations", type=int, default=20, help="k-means iterations (default: %(default)s)")
p.add_argument("--alternations", type=int, default=2, help="optic refinement steps (default: %(default)s)")
p.add_argument(
    "--selection", choices=["norm", "output"], default="norm", help="row ranking for pruning (default: %(default)s)"
)
p.add_argument("--seed", type=int, default=42, help="k-means seed (default: %(default)s)")
a = p.parse_args()
root = Path(a.output)
root.mkdir(parents=True, exist_ok=True)
meta, arrays = read_fasttext(a.source)
manifest = []
for cutoff in map(int, a.cutoffs.split(",")):
    pm, pa = prune(meta, arrays, cutoff, a.selection)
    for method in a.methods.split(","):
        # Row encodings have no groups: build them once, with groups=0 in the name/manifest.
        for groups in [0] if method in ("fp32", "int8") else list(map(int, a.groups.split(","))):
            started = time.monotonic()
            m, b = compress(
                pm, pa, method, groups=groups or 4, seed=a.seed, iterations=a.iterations, alternations=a.alternations
            )
            Model(m, b)
            name = f"{method}-{cutoff}" + (f"-g{groups}" if groups else "") + ".dlid"
            save(root / name, m, b)
            record = {
                "file": name,
                "bytes": (root / name).stat().st_size,
                "fit_seconds": time.monotonic() - started,
                "cutoff": cutoff,
                "method": method,
                "groups": groups,
                "source_sha256": m["source_sha256"],
                "fit_node_logit_mse": m.get("fit_node_logit_mse"),
            }
            manifest.append(record)
            (root / "build-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(record), flush=True)
