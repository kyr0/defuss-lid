"""Select by validation quality/size only, before running held-out devtest.

Rule: the smallest model whose macro-F1 is within --max-f1-drop of the
baseline on every validation slice; the baseline itself when none qualifies.
Choosing on validation data only keeps the later held-out scores unbiased.

UNKNOWN: not rerun on 2026-11-02 (needs downloaded corpora or weights); py_compile and --help pass.
"""

import argparse
import json
from pathlib import Path

from defuss_lid.evaluate import frontier, summarize

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("results", nargs="+", help="validation benchmark report JSON files of one cohort")
p.add_argument("--baseline", required=True, help="model name of the reference report")
p.add_argument(
    "--max-f1-drop", type=float, default=0.005, help="allowed macro-F1 loss per slice (default: %(default)s)"
)
p.add_argument("--output", required=True, help="selection JSON to write")
a = p.parse_args()
rows = [summarize(f) for f in a.results]
baseline = next(r for r in rows if r["model"] == a.baseline)
if len({r["dataset_sha256"] for r in rows}) != 1:
    raise ValueError("different evaluation cohorts")
qualified = [
    r
    for r in rows
    if r.get("model_bytes") is not None
    and all(
        r["metrics"][s]["macro_f1"] >= baseline["metrics"][s]["macro_f1"] - a.max_f1_drop for s in baseline["metrics"]
    )
]
choice = min(qualified, key=lambda r: r["model_bytes"]) if qualified else baseline
result = {
    "selected": choice["model"],
    "baseline": baseline["model"],
    "max_macro_f1_drop_each_slice": a.max_f1_drop,
    "dataset_sha256": baseline["dataset_sha256"],
    "rule": "minimum model bytes, within tolerance on EVERY validation slice",
    "pareto_size_quality_full": frontier(rows, include_latency=False),
    "qualified": [r["model"] for r in qualified],
    "validation_results": [{k: r[k] for k in ("model", "model_bytes", "metrics")} for r in rows],
}
Path(a.output).write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({k: v for k, v in result.items() if k != "validation_results"}, indent=2))
