"""Reference runtime: native fastText parity, prediction options and model validation."""

import json
from pathlib import Path

import numpy as np
import pytest

from defuss_lid.compress import compress, prune
from defuss_lid.format import load
from defuss_lid.runtime import Model

ROOT = Path(__file__).resolve().parents[1]
EXACT = ROOT / "models/v0.3/full/fasttext-native-exact.dlid"


@pytest.fixture(scope="module")
def exact():
    """The lossless lid.176.ftz export, shared read-only across this module."""
    return Model.load(EXACT)


def test_native_fasttext_parity(exact):
    """Top-1 labels, scores and hidden vectors match fastText C++ on its own outputs.

    tests/native-fixtures.json was recorded from fastText by
    scripts/verify_native.py; the tolerances are that script's pass criteria.
    """
    fixtures = json.loads((ROOT / "tests/native-fixtures.json").read_text(encoding="utf-8"))
    for item in fixtures:
        best = exact.predict(item["text"])[0]
        assert best["language"] == item["language"], item["text"]
        assert abs(best["score"] - item["score"]) < 3e-5, item["text"]
        hidden = exact.vectors(exact.features(item["text"])).mean(axis=0)
        assert np.max(np.abs(hidden - item["hidden"])) < 1e-4, item["text"]


def test_hs_threshold_matches_fasttext_log_cutoff(exact):
    """HS keeps a label iff its reported score >= threshold + 1e-5, fastText's dfs cutoff."""
    # A score well below 1: near-certain HS scores can exceed 1 by the epsilon.
    text = "Hello, how are you today?"
    score = exact.predict(text)[0]["score"]
    assert 0.5 < score < 0.99
    assert exact.predict(text, threshold=score - 1e-5 - 1e-9)[0]["language"] == "en"
    assert exact.predict(text, threshold=score - 1e-5 + 1e-9) == []


def test_language_filter_keeps_scores_and_order(exact):
    """An allowlist restricts the ranking without renormalizing the scores."""
    text = "Bonjour tout le monde."
    full = {p["language"]: p["score"] for p in exact.predict(text, 176)}
    restricted = exact.predict(text, 2, languages=["de", "en", "it"])
    assert len(restricted) == 2
    assert restricted[0]["score"] >= restricted[1]["score"]
    for p in restricted:
        assert p["score"] == full[p["language"]]


def test_label_tokens_and_blank_text(exact):
    """__label__ tokens contribute no features; blank text yields no prediction."""
    assert exact.features("__label__de hello") == exact.features("hello")
    assert exact.predict(" \t ") == []


@pytest.mark.parametrize("kwargs", [{"k": 0}, {"k": True}, {"threshold": -0.1}, {"threshold": float("nan")}])
def test_invalid_prediction_options(exact, kwargs):
    """k must be a positive int and threshold a finite probability."""
    with pytest.raises(ValueError):
        exact.predict("hello", **kwargs)


def test_int8_rows_score_close_to_fp32(exact):
    """int8 tables keep the ranking of the fp32 table they were quantized from."""
    m, a = prune(exact.meta, exact.arrays, 2000)
    fp32 = Model(m, a)
    int8 = Model(*compress(m, a, "int8"))
    assert int8.meta["kind"] == "int8" and int8.arrays["vectors"].dtype == np.int8
    for text in ["Das ist ein deutscher Satz.", "Hello, how are you today?"]:
        assert int8.predict(text)[0]["language"] == fp32.predict(text)[0]["language"]


def corrupt(change):
    """Return a fresh writable copy of the exact model with `change(meta, arrays)` applied."""
    meta, arrays = load(EXACT)
    meta = json.loads(json.dumps(meta))
    arrays = {k: v.copy() for k, v in arrays.items()}
    change(meta, arrays)
    return meta, arrays


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda m, a: m.update(kind="lzma"), "unsupported model"),
        (lambda m, a: m.update(minn=5), "feature configuration"),
        (lambda m, a: m["labels"].append("en"), "duplicate"),
        (lambda m, a: a.update(bucket_ids=a["bucket_ids"][::-1].copy()), "sorted and unique"),
        (lambda m, a: a.update(codes=a["codes"][:-1]), "PQ shape"),
        (lambda m, a: a.update(norm_codes=a["norm_codes"][:-1]), "norm quantizer"),
        (lambda m, a: a.update(head=a["head"][:-1]), "classifier shape"),
        (lambda m, a: a.update(left=a["left"][:-1]), "tree shape"),
    ],
    ids=["kind", "minn-gt-maxn", "duplicate-label", "unsorted-buckets", "codes", "norm", "head", "tree"],
)
def test_inconsistent_models_are_rejected(change, message):
    """Every shape the inference path indexes is checked when the model is built."""
    with pytest.raises(ValueError, match=message):
        Model(*corrupt(change))


def test_blank_text_rule_matches_the_js_runtime(exact):
    """Only fastText's separators make text blank, in both runtimes.

    Before the shared rule, Python used str.strip() and JS String.prototype.trim(): U+FEFF was a prediction here and
    blank in JS, U+001C the reverse (VERIFIED on the full exact model, 2026-11-02).
    """
    assert exact.predict(" \t\n\r\v\f\0") == []
    assert exact.predict("﻿")[0]["language"] == "en"
    assert len(exact.predict("\x1c")) == 1


def test_subset_path_nodes_must_be_unsigned():
    """A signed path table could hold -1, which NumPy would read as the last tree node instead of failing."""
    meta, arrays = load(ROOT / "models/v0.3/3/fasttext-native-exact.dlid")
    signed = dict(arrays, path_nodes=arrays["path_nodes"].astype(np.int32))
    with pytest.raises(ValueError, match="subset paths"):
        Model(meta, signed)
