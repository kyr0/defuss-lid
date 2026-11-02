"""Add metrics to benchmark reports and print their size/quality Pareto frontiers.

Each FILE is a benchmark JSON with a sibling .predictions.jsonl; metrics are
written back into it. All files must come from the same dataset cohort.

UNKNOWN: not rerun on 2026-11-02 (needs downloaded corpora or weights); py_compile and --help pass.
"""

import argparse
import json
from pathlib import Path

from defuss_lid.evaluate import frontier, summarize

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("files", nargs="+", metavar="FILE", help="benchmark report JSON files of one cohort")
p.add_argument("--output", required=True, help="summary JSON with results and frontiers")
a = p.parse_args()
results = [summarize(f) for f in a.files]
out = {
    "results": results,
    "pareto_size_quality": frontier(results, include_latency=False),
    "pareto_size_quality_latency": frontier(results),
    "caution": "Empirical frontier on this cohort; latency is noisy; not a universal optimum.",
}
Path(a.output).write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
for r in results:
    print(r["model"], r["model_bytes"], {s: round(m["macro_f1"], 5) for s, m in r["metrics"].items()})
