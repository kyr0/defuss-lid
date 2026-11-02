"""Feature hashing, container round trips, compression fits, tree rebuild and metrics."""

import numpy as np
import pytest

from defuss_lid.compress import compress, fit_optic, latent
from defuss_lid.evaluate import frontier, metrics, paired_accuracy_ci
from defuss_lid.features import bucket_ids, hash_bytes, tokens
from defuss_lid.format import load, save
from defuss_lid.native import huffman
from defuss_lid.runtime import Model


def fixture():
    """Return a random 3-label softmax model with 512 fp32 rows (enough for 256-centroid PQ)."""
    rng = np.random.default_rng(123)
    x = rng.normal(size=(512, 8)).astype(np.float32)
    meta = {
        "dim": 8,
        "words": ["</s>"],
        "labels": ["en", "de", "ru"],
        "bucket": 511,
        "minn": 2,
        "maxn": 4,
        "loss": "softmax",
        "kind": "fp32",
    }
    arrays = {
        "bucket_ids": np.arange(511, dtype=np.uint32),
        "vectors": x,
        "head": rng.normal(size=(3, 8)).astype(np.float32),
    }
    return meta, arrays


def test_signed_utf8_hash():
    """Bytes >= 0x80 are sign-extended before the XOR, as in fastText's hash."""
    assert hash_bytes(b"hello") == 1335831723
    assert hash_bytes(bytes([255])) == ((2166136261 ^ -1) * 16777619) & 0xFFFFFFFF
    assert list(bucket_ids("</s>", 2, 4, 100)) == []
    # "<ä>" yields "<ä", "ä>" and "<ä>"; the lone "<" and ">" are excluded.
    assert len(list(bucket_ids("ä", 2, 4, 100))) == 3


def test_stream_semantics():
    """Only fastText's ASCII separators split tokens; a literal </s> ends the stream."""
    assert list(tokens("a b\tX\nY")) == ["a b", "X", "Y", "</s>"]
    assert list(tokens("a </s> ignored")) == ["a", "</s>"]
    assert list(tokens("a\0b")) == ["a", "b", "</s>"]
    with pytest.raises(UnicodeEncodeError):
        list(tokens("\ud800"))


@pytest.mark.parametrize("method", ["fp32", "int8", "pq", "task-pq", "optic"])
def test_roundtrip_and_inference(tmp_path, method):
    """Saving and loading preserves every array bit-exactly and therefore every score."""
    m, a = fixture()
    m, a = compress(m, a, method, groups=2, iterations=3, alternations=1)
    path = tmp_path / "test.dlid"
    save(path, m, a)
    model = Model.load(path)
    actual, expected = model.predict("Hallo Welt", 3), Model(m, a).predict("Hallo Welt", 3)
    assert [p["language"] for p in actual] == [p["language"] for p in expected]
    np.testing.assert_allclose([p["score"] for p in actual], [p["score"] for p in expected], atol=1e-12)
    for key in a:
        np.testing.assert_array_equal(model.arrays[key], a[key])
    assert model.predict("") == []
    with pytest.raises(ValueError):
        model.predict("x", 0)
    if method == "optic":
        history = m["fit_node_logit_mse"]
        assert all(y <= x * (1 + 1e-8) for x, y in zip(history, history[1:], strict=False))


def test_corrupt_container(tmp_path):
    """Garbage, truncated and trailing bytes are rejected with ValueError."""
    m, a = fixture()
    path = tmp_path / "x.dlid"
    save(path, m, a)
    original = path.read_bytes()
    for data in [b"garbage", original[:-1], original + b"garbage"]:
        path.write_bytes(data)
        with pytest.raises(ValueError):
            load(path)


def test_bad_tree_rejected():
    """A tree that revisits a node fails validation instead of recursing or mis-scoring."""
    m, a = fixture()
    m["loss"] = "hs"
    a["left"] = np.array([0, 4], np.int32)
    a["right"] = np.array([1, 2], np.int32)
    with pytest.raises(ValueError, match="tree"):
        Model(m, a)


def test_classifier_folding():
    """Folding an invertible input transform into the classifier preserves the logits."""
    rng = np.random.default_rng(3)
    x = rng.normal(size=(100, 8))
    a = rng.normal(size=(8, 8))
    w = rng.normal(size=(5, 8))
    np.testing.assert_allclose(x @ w.T, (x @ a) @ (w @ np.linalg.inv(a).T).T, atol=1e-10)


def test_output_fit_improves():
    """The optic refinement never increases the logit error and reports it correctly."""
    m, a = fixture()
    m, b = compress(m, a, "pq", groups=2, iterations=3)
    c, books, head, history = fit_optic(a["vectors"], a["head"], b["codes"].copy(), b["books"].copy(), 3)
    assert history[-1] <= history[0]
    actual = np.mean((latent(c, books) @ head.T - a["vectors"] @ a["head"].T) ** 2)
    assert abs(actual - history[-1]) < 1e-5


def test_huffman_ties():
    """On equal counts the internal node wins, matching fastText's buildTree numbering."""
    left, right = huffman([9, 5, 5])
    assert left.tolist() == [2, 0] and right.tolist() == [1, 3]


def test_metrics_do_not_drop_abstentions_or_foreign_predictions():
    """Abstentions and labels outside the gold set count as errors."""
    rows = [
        {"id": str(i), "group": str(i), "gold": g, "pred": p, "score": 0.9, "slice": "full"}
        for i, (g, p) in enumerate([("de", "de"), ("de", "und"), ("en", "fr"), ("en", "en")])
    ]
    r = metrics(rows)
    assert r["accuracy"] == 0.5 and r["macro_f1"] == pytest.approx(2 / 3)
    assert r["abstention_rate"] == 0.25
    ci = paired_accuracy_ci(rows, rows, draws=20)
    assert ci["ci95"] == [0, 0]


def test_pareto_rejects_different_cohorts():
    """Frontiers over different datasets would compare incomparable scores."""
    with pytest.raises(ValueError):
        frontier([{"dataset_sha256": "a"}, {"dataset_sha256": "b"}])


def test_model_validation():
    """Non-finite weights are rejected at load time, not discovered as NaN scores."""
    m, a = fixture()
    a["head"][0, 0] = np.nan
    with pytest.raises(ValueError, match="finite"):
        Model(m, a)


def test_softmax_threshold_uses_raw_probability_like_fasttext():
    """Softmax thresholds compare the raw probability, as fastText's findKBest does.

    fastText skips outputs with p < threshold and reports exp(log(p + 1e-5)),
    so a probability 5e-6 below the threshold must be rejected even though its
    reported score p + 1e-5 is above the threshold.
    """
    m = {
        "dim": 1,
        "words": ["</s>"],
        "labels": ["a", "b"],
        "bucket": 1,
        "minn": 0,
        "maxn": 0,
        "loss": "softmax",
        "kind": "fp32",
    }
    a = {
        "bucket_ids": np.zeros(0, np.uint32),
        "vectors": np.array([[1.0]], np.float32),
        "head": np.array([[0.8], [0.0]], np.float32),
    }
    model = Model(m, a)
    p = model.predict("x", 1)[0]["score"] - 1e-5
    assert model.predict("x", 1, threshold=p + 5e-6) == []
    assert model.predict("x", 1, threshold=p - 5e-6)[0]["language"] == "a"
