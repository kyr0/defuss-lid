"""CLD3 parameter packs: code layouts, reports, validation and the shared WASM core."""

import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest

from defuss_lid.cld3_pack import LABELS, SHAPES, build, source_assets
from defuss_lid.format import load

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def cld3():
    """The pinned runtime metadata and the released CLD3 parameter arrays."""
    base = json.loads((ROOT / "runtime/cld3-core.json").read_text())
    with np.load(ROOT / "inspection/cld3-parameters.npz") as z:
        params = {k: z[k] for k in z.files}
    return base, params


def decode(meta, arrays, name):
    """Rebuild the uint8 embedding rows of a PQ tensor as a loader must."""
    desc = meta["tensors"][name]
    books, codes = arrays[desc["books"]], arrays[desc["codes"]]
    rows = desc["shape"][0]
    if desc["encoding"] == "pq4":
        # Two 4-bit codes per byte, low nibble first, in row-major (row, group) order.
        codes = np.stack([codes & 15, codes >> 4], axis=1).reshape(-1)[: rows * desc["groups"]]
        codes = codes.reshape(rows, desc["groups"])
    return np.concatenate([books[g, codes[:, g]] for g in range(desc["groups"])], axis=1)


@pytest.mark.parametrize(("method", "encoding"), [("pq", "pq8"), ("tiny-pq-int8", "pq4")])
def test_pq_codes_decode_to_the_measured_rows(tmp_path, cld3, method, encoding):
    """Stored codes decode to exactly the rows whose error the pack reports."""
    base, params = cld3
    target = tmp_path / f"{method}.cld3q"
    report = build(base, params, target, method, ["en", "de", "fr"], seed=1, iterations=2)
    meta, arrays = load(target)
    for index in (0, 1, 4):
        name = f"kEmbeddingsWeights{index}"
        assert meta["tensors"][name]["encoding"] == encoding
        original = params[name].reshape(SHAPES[index]).astype(np.float64)
        decoded = decode(meta, arrays, name).astype(np.float64)
        assert np.mean((original - decoded) ** 2) == pytest.approx(report["coefficient_mse"][name], rel=1e-12)
    # Small tables stay raw: they have fewer rows than centroids.
    assert meta["tensors"]["kEmbeddingsWeights2"]["encoding"] == "raw"
    assert report["bytes"] == target.stat().st_size
    assert report["sha256"] == hashlib.sha256(target.read_bytes()).hexdigest()
    assert report["labels"] == 3 and meta["output_columns"] == [LABELS.index(x) for x in meta["labels"]]


def test_raw_pack_keeps_original_values(tmp_path, cld3):
    """raw stores the released tensors unchanged, so every reported error is zero."""
    base, params = cld3
    report = build(base, params, tmp_path / "raw.cld3q")
    meta, arrays = load(tmp_path / "raw.cld3q")
    assert set(report["coefficient_mse"].values()) == {0.0} and len(meta["labels"]) == 109
    np.testing.assert_array_equal(arrays["kHiddenWeights0"].reshape(-1), params["kHiddenWeights0"])


@pytest.mark.parametrize(
    "kwargs",
    [{"method": "zstd"}, {"languages": ["xx"]}, {"languages": ["en", "en"]}, {"iterations": 0}],
    ids=["method", "unknown-label", "duplicate-label", "iterations"],
)
def test_invalid_build_settings(tmp_path, cld3, kwargs):
    """Unknown methods, labels outside CLD3's inventory and zero iterations are rejected."""
    base, params = cld3
    with pytest.raises(ValueError):
        build(base, params, tmp_path / "x.cld3q", **kwargs)


@pytest.mark.skipif(
    not (ROOT / "node_modules/cld3-asm/package.json").exists(), reason="cld3-asm is installed by bun install"
)
def test_source_assets_reproduce_the_pinned_runtime(tmp_path):
    """Cutting the weights out of the pinned WASM reproduces the committed core and glue."""
    base, params = source_assets(ROOT / "node_modules/cld3-asm", ROOT / "inspection/cld3-parameters.npz", tmp_path)
    pinned = json.loads((ROOT / "runtime/cld3-core.json").read_text())
    assert base["core_sha256"] == pinned["core_sha256"] and base["ranges"] == pinned["ranges"]
    # Compare the decompressed core: gzip bytes depend on the local zlib build.
    core = gzip.decompress((tmp_path / "cld3-core.bin.gz").read_bytes())
    assert core == gzip.decompress((ROOT / "runtime/cld3-core.bin.gz").read_bytes())
    assert (tmp_path / "cld3-glue.js").read_bytes() == (ROOT / "runtime/cld3-glue.js").read_bytes()
    assert len(params) == 16
