"""Build full or allowlisted pretrained CLD3 parameter packs and shared runtime.

Regenerates runtime/ (core, glue, layout) from the pinned cld3-asm package and
writes one .cld3q pack per method plus build-manifest.json to --output.

VERIFIED: --help lists --languages, --methods and --output, as scripts/e2e.mjs checks for the README command.
"""

import argparse
import json
from pathlib import Path

from defuss_lid.cld3_pack import build, source_assets

p = argparse.ArgumentParser(description=__doc__)
p.add_argument(
    "--package", default="node_modules/cld3-asm", help="installed cld3-asm 4.0.0 package (default: %(default)s)"
)
p.add_argument(
    "--parameters",
    default="inspection/cld3-parameters.npz",
    help="CLD3 arrays from scripts/inspect_cld3.py --npz (default: %(default)s)",
)
p.add_argument("--runtime", default="runtime", help="directory for the shared runtime files (default: %(default)s)")
p.add_argument("--output", default="models/cld3", help="directory for the .cld3q packs (default: %(default)s)")
p.add_argument(
    "--methods",
    default="raw,int8,pq,tiny-pq,pq-int8,tiny-pq-int8",
    help="comma-separated pack methods (default: %(default)s)",
)
p.add_argument("--languages", help="comma-separated canonical labels; omit for all 109")
p.add_argument("--seed", type=int, default=42, help="k-means seed (default: %(default)s)")
p.add_argument("--iterations", type=int, default=20, help="k-means iterations (default: %(default)s)")
a = p.parse_args()
out = Path(a.output)
out.mkdir(parents=True, exist_ok=True)
base, params = source_assets(a.package, a.parameters, a.runtime)
records = []
for method in a.methods.split(","):
    row = build(
        base,
        params,
        out / f"{method}.cld3q",
        method,
        a.languages.split(",") if a.languages else None,
        a.seed,
        a.iterations,
    )
    records.append(row)
    print(json.dumps(row), flush=True)
(out / "build-manifest.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
