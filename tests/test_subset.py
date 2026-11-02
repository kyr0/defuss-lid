"""Language subsets: score preservation, corpus feature pruning and validation."""

import collections
import json
from pathlib import Path

import numpy as np
import pytest

from defuss_lid.compress import compress, prune
from defuss_lid.format import load, save
from defuss_lid.runtime import Model
from defuss_lid.subset import restrict

ROOT = Path(__file__).resolve().parents[1]
EXACT = ROOT / "models/v0.3/full/fasttext-native-exact.dlid"


def write_jsonl(path, rows):
    """Write `rows` as one JSON object per line."""
    path.write_text("".join(json.dumps(r) + "\n" for r in rows))


def test_hs_subset_preserves_scores_and_restricted_ranking(tmp_path):
    """An HS subset scores exactly like the full model restricted to the same labels."""
    m, a = load(EXACT)
    original = Model(m, a)
    sub, sa = restrict(m, a, ["en", "de", "ru"])
    assert len(sa["head"]) < len(a["head"]) and "left" not in sa
    path = tmp_path / "subset.dlid"
    save(path, sub, sa)
    built = Model.load(path)
    for text in ["Hallo Welt", "Hello there", "Привет, мир", "Bonjour les amis", "这是中文", "a </s> ignored"]:
        before = original.predict(text, 3, languages=["en", "de", "ru"])
        after = built.predict(text, 3)
        assert [p["language"] for p in before] == [p["language"] for p in after]
        np.testing.assert_allclose([p["score"] for p in before], [p["score"] for p in after], atol=1e-13, rtol=1e-13)
    # Subsetting a subset walks the stored paths instead of the dropped tree.
    single = Model(*restrict(sub, sa, ["de"]))
    assert single.predict("Hello")[0]["language"] == "de"
    assert single.predict("Hello")[0]["score"] == pytest.approx(
        original.predict("Hello", 1, languages=["de"])[0]["score"]
    )


def test_observed_feature_subset_and_compression(tmp_path):
    """Corpus pruning keeps exactly the observed rows, so calibration texts score unchanged."""
    m, a = load(EXACT)
    original = Model(m, a)
    corpus = tmp_path / "calibration.jsonl"
    rows = [
        {"language": "en", "text": "Hello world", "split": "train"},
        {"language": "de", "text": "Hallo Welt", "split": "train"},
        {"language": "ru", "text": "unrelated excluded record", "split": "train"},
    ]
    write_jsonl(corpus, rows)
    sub, sa = restrict(m, a, ["en", "de"], corpus)
    expected = set(original.features("Hello world")) | set(original.features("Hallo Welt"))
    assert len(sub["words"]) + len(sa["bucket_ids"]) == len(expected)
    assert len(sa["codes"]) < len(a["codes"])
    assert sub["feature_selection"]["examples_per_language"] == {"de": 1, "en": 1}
    for text in ["Hello world", "Hallo Welt"]:
        before = original.predict(text, 2, languages=["en", "de"])
        after = Model(sub, sa).predict(text, 2)
        assert [p["language"] for p in before] == [p["language"] for p in after]
        np.testing.assert_allclose([p["score"] for p in before], [p["score"] for p in after], atol=1e-13)
    pm, pa = prune(sub, sa, 0)
    cm, ca = compress(pm, pa, "int8")
    assert set(p["language"] for p in Model(cm, ca).predict("Hello", 2)) == {"en", "de"}
    # Held-out splits of a requested language must never shape the model.
    rows[0]["split"] = "test"
    write_jsonl(corpus, rows)
    with pytest.raises(ValueError, match="evaluation split"):
        restrict(m, a, ["en", "de"], corpus)


def test_min_count_and_max_features_keep_frequent_rows_and_eos(tmp_path):
    """min_count filters by document frequency; max_features caps rows but always keeps EOS."""
    m, a = load(EXACT)
    original = Model(m, a)
    texts = ["Hello world", "Hello there world", "Hallo Welt"]
    corpus = tmp_path / "calibration.jsonl"
    rows = [{"language": "en", "text": texts[0]}, {"language": "en", "text": texts[1]}]
    rows += [{"language": "de", "text": texts[2]}, {"language": "de", "text": "   "}]
    corpus.write_text("\n" + "".join(json.dumps(r) + "\n" for r in rows))
    frequency = collections.Counter(i for t in texts for i in set(original.features(t)))
    eos = original.words["</s>"]
    sub, _ = restrict(m, a, ["en", "de"], corpus, min_count=2)
    assert sub["retained_rows"] == len({i for i, c in frequency.items() if c >= 2} | {eos})
    assert sub["feature_selection"]["examples_per_language"] == {"de": 1, "en": 2}
    capped, capped_arrays = restrict(m, a, ["en", "de"], corpus, max_features=3)
    assert capped["retained_rows"] == 3 and "</s>" in capped["words"]
    assert len(capped_arrays["codes"]) == 3


def test_record_without_text_is_rejected(tmp_path):
    """A selected-language record without a text string is a corpus error, not a skip."""
    m, a = load(EXACT)
    corpus = tmp_path / "calibration.jsonl"
    write_jsonl(corpus, [{"language": "en", "text": None}])
    with pytest.raises(ValueError, match="missing text at line 1"):
        restrict(m, a, ["en"], corpus)


@pytest.mark.parametrize("languages", [[], ["xx-unknown"], ["en", "en"]])
def test_invalid_allowlist(languages):
    """Empty, unknown or duplicate labels are rejected by both subsetting and prediction."""
    m, a = load(EXACT)
    with pytest.raises(ValueError):
        restrict(m, a, languages)
    with pytest.raises(ValueError):
        Model(m, a).predict("Hello", languages=languages)


def test_subset_requires_each_language_in_calibration(tmp_path):
    """A language without calibration text, or limits without a corpus, are errors."""
    m, a = load(EXACT)
    p = tmp_path / "empty.jsonl"
    p.write_text("")
    with pytest.raises(ValueError, match="no calibration"):
        restrict(m, a, ["en"], p)
    with pytest.raises(ValueError, match="require a calibration"):
        restrict(m, a, ["en"], max_features=10)


def test_corrupt_subset_paths_rejected():
    """A path node outside the head would index out of bounds and is rejected."""
    m, a = restrict(*load(EXACT), ["en", "de"])
    a["path_nodes"][0] = len(a["head"])
    with pytest.raises(ValueError, match="subset paths"):
        Model(m, a)


def test_flat_softmax_subset_is_conditional():
    """A softmax subset renormalizes over the retained labels."""
    m = {
        "dim": 2,
        "words": ["</s>"],
        "labels": ["en", "de", "ru"],
        "bucket": 2,
        "minn": 2,
        "maxn": 4,
        "loss": "softmax",
        "kind": "fp32",
    }
    a = {
        "vectors": np.array([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]], np.float32),
        "bucket_ids": np.arange(2, dtype=np.uint32),
        "head": np.array([[0.1, 0.2], [0.3, -0.1], [-0.2, 0.1]], np.float32),
    }
    original = Model(m, a)
    subset = Model(*restrict(m, a, ["ru", "de"]))
    h = original.vectors(original.features("hello")).mean(axis=0)
    p = original.scores_from_hidden(h)[[1, 2]] - 1e-5
    np.testing.assert_allclose(subset.scores_from_hidden(h), p / p.sum() + 1e-5, atol=1e-14)
    # Labels keep model order, not request order.
    assert subset.meta["labels"] == ["de", "ru"]


def test_cld3_quantized_columns_and_subset(tmp_path):
    """CLD3 int8 output columns stay within half a quantization step of the originals."""
    from defuss_lid.cld3_pack import LABELS, build

    base = json.loads((ROOT / "runtime/cld3-core.json").read_text())
    with np.load(ROOT / "inspection/cld3-parameters.npz") as z:
        params = {k: z[k] for k in z.files}
    target = tmp_path / "q.cld3q"
    build(base, params, target, "int8", ["en", "de"])
    meta, a = load(target)
    desc = meta["tensors"]["kSoftmaxWeights0"]
    assert desc["shape"] == [208, 2]
    reconstructed = a[desc["quant"]].astype(np.float32) * a[desc["scales"]]
    original = params["kSoftmaxWeights0"].reshape(208, 109)[:, meta["output_columns"]]
    assert np.all(np.abs(reconstructed - original) <= a[desc["scales"]] / 2 + 1e-5)
    assert meta["labels"] == [x for x in LABELS if x in ("en", "de")]
