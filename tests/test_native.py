"""fastText v12 reader: dense and quantized layouts, pruned buckets, HS tree, rejections."""

from pathlib import Path

import numpy as np
import pytest

from defuss_lid.format import save
from defuss_lid.native import huffman, read_fasttext
from defuss_lid.runtime import Model

ROOT = Path(__file__).resolve().parents[1]


def test_dense_hs_model_is_read_losslessly(dense_fasttext):
    """Dense rows, labels and the rebuilt Huffman tree come through unchanged."""
    path, spec = dense_fasttext()
    meta, arrays = read_fasttext(path)
    assert meta["labels"] == ["en", "de", "fr"] and meta["words"] == ["</s>", "hello"]
    assert (meta["loss"], meta["kind"], meta["dim"], meta["bucket"]) == ("hs", "fp32", 2, 4)
    assert meta["license"].startswith("Unspecified") and meta["source_name"] == "dense.bin"
    np.testing.assert_array_equal(arrays["bucket_ids"], np.arange(4))
    np.testing.assert_array_equal(arrays["vectors"], spec["input_matrix"])
    np.testing.assert_array_equal(arrays["head"], spec["output_matrix"])
    left, right = huffman(spec["counts"])
    np.testing.assert_array_equal(arrays["left"], left)
    np.testing.assert_array_equal(arrays["right"], right)
    assert Model(meta, arrays).predict("hello", 3)


def test_quantized_pruned_softmax_model_reorders_buckets(tmp_path, fasttext_writer):
    """Pruned bucket rows are reordered by ascending bucket ID; qnorm and qout decode."""
    rng = np.random.default_rng(11)
    books = rng.normal(size=(2, 256, 2)).astype(np.float32)
    codes = np.array([[1, 2], [3, 4], [5, 6]], np.uint8)
    norm_book = rng.uniform(0.5, 2, size=256).astype(np.float32)
    norm_codes = np.array([7, 8, 9], np.uint8)
    out_codes = np.array([[10, 11], [12, 13]], np.uint8)
    path = tmp_path / "model.ftz"
    path.write_bytes(
        fasttext_writer(
            dim=4,
            words=["</s>"],
            labels=["en", "de"],
            counts=[2, 1],
            loss=3,
            bucket=100,
            # Bucket 57 is stored in row 0 and bucket 3 in row 1 of the bucket block.
            prune={57: 0, 3: 1},
            input_matrix={"codes": codes, "books": books, "norm_codes": norm_codes, "norm_book": norm_book},
            output_matrix={"codes": out_codes, "books": books},
        )
    )
    meta, arrays = read_fasttext(path)
    assert (meta["loss"], meta["kind"]) == ("softmax", "pq") and "left" not in arrays
    np.testing.assert_array_equal(arrays["bucket_ids"], [3, 57])
    np.testing.assert_array_equal(arrays["codes"], codes[[0, 2, 1]])
    np.testing.assert_array_equal(arrays["norm_codes"], norm_codes[[0, 2, 1]])
    np.testing.assert_array_equal(arrays["norm_book"], norm_book)
    expected_head = np.concatenate([books[0, out_codes[:, 0]], books[1, out_codes[:, 1]]], axis=1)
    np.testing.assert_array_equal(arrays["head"], expected_head)
    assert Model(meta, arrays).predict("hello", 2)


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"magic": 1}, "v12"),
        ({"word_ngrams": 2}, "wordNgrams=1"),
        ({"loss": 2}, "loss=hs/softmax"),
        ({"labels": ["en"], "counts": [1], "output_matrix": np.zeros((1, 2), np.float32)}, "dictionary"),
        ({"input_matrix": np.zeros((5, 2), np.float32)}, "dictionary/matrix mismatch"),
    ],
    ids=["magic", "word-ngrams", "negative-sampling", "one-label", "row-count"],
)
def test_unsupported_or_inconsistent_models_are_rejected(dense_fasttext, overrides, message):
    """Configurations the runtimes cannot score like fastText fail at import time."""
    path, _ = dense_fasttext(**overrides)
    with pytest.raises(ValueError, match=message):
        read_fasttext(path)


def test_truncated_and_trailing_bytes_are_rejected(dense_fasttext):
    """A file must be consumed exactly: missing or extra bytes mean a misparse."""
    path, _ = dense_fasttext()
    raw = path.read_bytes()
    path.write_bytes(raw[:-1])
    with pytest.raises(ValueError, match="truncated"):
        read_fasttext(path)
    path.write_bytes(raw + b"\0")
    with pytest.raises(ValueError, match="trailing"):
        read_fasttext(path)


@pytest.mark.skipif(not (ROOT / "data/lid.176.ftz").exists(), reason="data/lid.176.ftz is downloaded, not committed")
def test_official_ftz_exports_to_the_shipped_exact_pack(tmp_path):
    """Exporting the released lid.176.ftz reproduces the shipped exact pack byte for byte."""
    target = tmp_path / "exact.dlid"
    save(target, *read_fasttext(ROOT / "data/lid.176.ftz"))
    assert target.read_bytes() == (ROOT / "models/v0.3/full/fasttext-native-exact.dlid").read_bytes()
