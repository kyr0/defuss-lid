"""Paired accuracy intervals over aligned source groups, separately by slice.

Both inputs are .predictions.jsonl files of the same cohort. A positive delta
means the first model is more accurate.

UNKNOWN: not rerun on 2026-11-02 (needs downloaded corpora or weights); py_compile and --help pass.
"""

import argparse
import json
from pathlib import Path

from defuss_lid.evaluate import paired_accuracy_ci

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("first", help="predictions JSONL of model A")
p.add_argument("second", help="predictions JSONL of model B, same records as A")
p.add_argument("--output", required=True, help="JSON file for the per-slice intervals")
p.add_argument("--draws", type=int, default=2000, help="bootstrap draws (default: %(default)s)")
a = p.parse_args()
left = [json.loads(x) for x in Path(a.first).read_text(encoding="utf-8").splitlines()]
right = [json.loads(x) for x in Path(a.second).read_text(encoding="utf-8").splitlines()]
slices = sorted({r["slice"] for r in left})
out = {
    "first": Path(a.first).name,
    "second": Path(a.second).name,
    "positive_delta_favors": "first",
    "metrics": {
        s: paired_accuracy_ci(
            [r for r in left if r["slice"] == s], [r for r in right if r["slice"] == s], draws=a.draws
        )
        for s in slices
    },
}
Path(a.output).write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
print(json.dumps(out))
