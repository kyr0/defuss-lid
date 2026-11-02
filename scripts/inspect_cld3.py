"""Extract released CLD3 parameter arrays for inspection, not standalone inference.

Input: https://raw.githubusercontent.com/google/cld3/master/src/lang_id_nn_params.cc
The expected source hash is pinned. --npz preserves scale bit patterns.
Upstream float16 uses the upper 16 bits of FP32 (bfloat16 layout), not IEEE FP16.
Feature extraction, label mapping, and nonlinear inference are not in this file.

UNKNOWN: not rerun on 2026-11-02 (needs downloaded corpora or weights); py_compile and --help pass.
"""

import argparse
import hashlib
import json
import re
from pathlib import Path

import numpy as np

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("source", help="lang_id_nn_params.cc from google/cld3 (pinned by SHA-256)")
p.add_argument("--output", required=True, help="JSON inventory of the extracted tensors")
p.add_argument("--npz", help="also write the arrays to this .npz (bit patterns preserved)")
a = p.parse_args()
raw = Path(a.source).read_bytes()
sha = hashlib.sha256(raw).hexdigest()
expected = "00b2ea875cfee3a0756076945d430fe65b10886f04d333f8ed7652652dcb4ae2"
if sha != expected:
    raise ValueError("source hash changed; inspect upstream before changing the pin")
arrays = {}
for typ, name, body in re.findall(
    r"const (float16|uint8|float) LangIdNNParams::(\w+)\[\] = \{(.*?)\};", raw.decode(), re.S
):
    # Strip C literal suffixes (12u, 0.5f) before parsing.
    values = [x.strip().rstrip("uUfF") for x in body.split(",") if x.strip()]
    if typ == "float":
        arr = np.asarray([float(x) for x in values], dtype="<f4")
    else:
        # float16 values are written as integer bit patterns; keep them as uint16.
        arr = np.asarray([int(x, 0) for x in values], dtype="<u2" if typ == "float16" else "u1")
    arrays[name] = arr
if len(arrays) != 16:
    raise ValueError("unexpected parameter array inventory")
report = {
    "source_sha256": sha,
    "tensor_bytes": sum(x.nbytes for x in arrays.values()),
    "tensors": {name: {"count": x.size, "dtype": x.dtype.str, "bytes": x.nbytes} for name, x in arrays.items()},
    "note": "upstream float16 scales use bfloat16 layout, exported as uint16 bit patterns; "
    "excludes feature code and label metadata",
    "license": "Apache-2.0; Copyright 2016 Google Inc.",
}
Path(a.output).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
if a.npz:
    np.savez_compressed(a.npz, **arrays)
print(json.dumps({"tensor_bytes": report["tensor_bytes"], "arrays": len(arrays)}))
