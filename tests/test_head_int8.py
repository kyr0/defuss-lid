"""Int8 classifier heads: error bound, Python/JS agreement, subsets and validation."""

import json
import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest

from defuss_lid.compress import compress, prune, quantize_head
from defuss_lid.format import load, save
from defuss_lid.native import dense, dense_head
from defuss_lid.runtime import Model
from defuss_lid.subset import restrict

ROOT = Path(__file__).resolve().parents[1]
# The lossless export of the released lid.176.ftz; present in every clone via models/v0.3.
EXACT = ROOT / "models/v0.3/full/fasttext-native-exact.dlid"
TEXTS = [
    "Hello, how are you today?",
    "Das ist ein deutscher Satz.",
    "Привет, как дела?",
    "Bonjour tout le monde.",
    "日本語の文章です。",
    "العربية لغة جميلة",
]


def js_predictions(model_path, texts):
    """Score `texts` with the JavaScript runtime run straight from its sources.

    TypeScript sources import siblings as `./x.js`, which Bun maps to `./x.ts`;
    plain-JS sources run on Node as before.
    """
    if (ROOT / "src/index.ts").exists():
        bun = shutil.which("bun")
        assert bun, "bun is required to run the TypeScript runtime sources"
        command, entry = [bun, "-e"], "./src/index.ts"
    else:
        command, entry = ["node", "--input-type=module", "-e"], "./src/index.js"
    script = (
        f"import fs from 'node:fs'; import {{LidModel}} from '{entry}'; "
        "const m=LidModel.fromBuffer(fs.readFileSync(process.argv[1])); "
        "console.log(JSON.stringify(JSON.parse(process.argv[2]).map(t=>m.predict(t,{k:3}))));"
    )
    return json.loads(subprocess.check_output([*command, script, str(model_path), json.dumps(texts)], cwd=ROOT))


def test_quantization_error_and_js_python_agree(tmp_path):
    """Int8 heads stay within half a step per row and both runtimes score them identically."""
    m, a = load(EXACT)
    qm, qa = quantize_head(m, a)
    assert qa["head"].dtype == np.int8 and qa["head"].nbytes + qa["head_scales"].nbytes < a["head"].nbytes
    assert np.all(np.abs(dense_head(qa) - a["head"]) <= qa["head_scales"][:, None] / 2 + 1e-6)
    # Quantizing the head must not silently refit the native PQ tables.
    for key in ("books", "codes", "norm_codes", "norm_book"):
        np.testing.assert_array_equal(a[key], qa[key])
    path = tmp_path / "quantized.dlid"
    save(path, qm, qa)
    model = Model.load(path)
    assert path.read_bytes()[:8] == b"DLID0002" and model.meta["version"] == 2
    expected = [model.predict(t, 3) for t in TEXTS]
    actual = js_predictions(path, TEXTS)
    assert len(actual) == len(expected)
    for before, after in zip(expected, actual, strict=True):
        assert [p["language"] for p in before] == [p["language"] for p in after]
        np.testing.assert_allclose([p["score"] for p in before], [p["score"] for p in after], atol=1e-12, rtol=1e-12)
    # Int8 subsets must preserve scores after selecting and remapping HS paths.
    sm, sa = restrict(qm, qa, ["de", "en", "ru"])
    sub = Model(sm, sa)
    for t in TEXTS:
        left, right = sub.predict(t, 3), model.predict(t, 3, languages=["de", "en", "ru"])
        assert [p["language"] for p in left] == [p["language"] for p in right]
        np.testing.assert_allclose([p["score"] for p in left], [p["score"] for p in right], atol=1e-13, rtol=1e-13)
    pm, pa = prune(sm, sa, 0)
    Model(pm, pa)
    for t in TEXTS:
        np.testing.assert_allclose(
            [p["score"] for p in Model(pm, pa).predict(t, 3)], [p["score"] for p in sub.predict(t, 3)], atol=1e-6
        )
    rem, rea = compress(pm, pa, "int8")
    assert rem["head_kind"] == "fp32" and "head_scales" not in rea
    np.testing.assert_allclose(rea["head"], dense_head(sa))


@pytest.mark.parametrize("corruption", ["missing", "negative", "shape", "dtype", "metadata"])
def test_invalid_quantized_classifier_rejected(corruption):
    """Each inconsistency between head codes, scales and metadata is rejected."""
    m, a = quantize_head(*load(EXACT))
    if corruption == "missing":
        a.pop("head_scales")
    if corruption == "negative":
        a["head_scales"][0] = -1
    if corruption == "shape":
        a["head_scales"] = a["head_scales"][:-1]
    if corruption == "dtype":
        a["head"] = a["head"].astype(np.float32)
    if corruption == "metadata":
        m.pop("head_kind")
    with pytest.raises(ValueError):
        Model(m, a)


def test_recompress_int8_embeddings_uses_row_scales():
    """Dequantizing int8 rows multiplies each row by its own scale."""
    a = {"vectors": np.array([[2, -3], [0, 7]], np.int8), "scales": np.array([0.5, 0.25], np.float32)}
    np.testing.assert_array_equal(dense(a), [[1, -1.5], [0, 1.75]])


def test_pq_int8_combines_encodings():
    """pq-int8 produces a PQ table with an int8 classifier that still predicts."""
    m, a = load(EXACT)
    m, a = prune(m, a, 300)
    m, a = compress(m, a, method="pq-int8", groups=4, iterations=2)
    model = Model(m, a)
    assert m["kind"] == "pq" and m["head_kind"] == "int8"
    assert model.predict("Hello, how are you?")
