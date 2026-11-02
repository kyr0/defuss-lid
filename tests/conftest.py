"""Shared test helpers: a writer for real fastText v12 model files."""

import struct

import numpy as np
import pytest

ARG_NAMES = "dim ws epoch minCount neg wordNgrams loss model bucket minn maxn lrUpdateRate".split()


def pq_bytes(books):
    """Serialize a fastText ProductQuantizer with uniform groups."""
    groups, _, width = books.shape
    return struct.pack("<4i", groups * width, groups, width, width) + books.astype("<f4").tobytes()


def matrix_bytes(matrix):
    """Serialize a fastText DenseMatrix (array) or QuantMatrix (dict of codes/books[/norm_*])."""
    if not isinstance(matrix, dict):
        return struct.pack("<2q", *matrix.shape) + matrix.astype("<f4").tobytes()
    codes, books = matrix["codes"], matrix["books"]
    qnorm = "norm_codes" in matrix
    rows, dim = len(codes), books.shape[0] * books.shape[2]
    out = struct.pack("<?qqi", qnorm, rows, dim, codes.size) + codes.astype("u1").tobytes() + pq_bytes(books)
    if qnorm:
        out += matrix["norm_codes"].astype("u1").tobytes() + pq_bytes(matrix["norm_book"].reshape(1, 256, 1))
    return out


def fasttext_bytes(
    *,
    dim,
    words,
    labels,
    counts,
    loss,
    bucket,
    input_matrix,
    output_matrix,
    minn=2,
    maxn=3,
    word_ngrams=1,
    prune=None,
    magic=793712314,
):
    """Return the bytes of a fastText v12 supervised model file.

    `input_matrix`/`output_matrix` are a float32 array (dense) or a dict with
    `codes`, `books` and optional `norm_codes`/`norm_book` (quantized). `prune`
    maps bucket ID to retained bucket row, as in a .ftz file. `loss` uses
    fastText's enum (1 = hs, 3 = softmax).
    """
    args = dict(dim=dim, ws=5, epoch=5, minCount=1, neg=5, wordNgrams=word_ngrams, loss=loss, model=3)
    args.update(bucket=bucket, minn=minn, maxn=maxn, lrUpdateRate=100)
    out = struct.pack("<2i", magic, 12) + struct.pack("<12i", *(args[n] for n in ARG_NAMES)) + struct.pack("<d", 1e-4)
    entries = [(w, 1, 0) for w in words] + [("__label__" + w, c, 1) for w, c in zip(labels, counts, strict=True)]
    out += struct.pack("<iiiqq", len(entries), len(words), len(labels), 1000, -1 if prune is None else len(prune))
    for word, count, kind in entries:
        out += word.encode() + b"\0" + struct.pack("<qb", count, kind)
    for first, second in (prune or {}).items():
        out += struct.pack("<2i", first, second)
    out += struct.pack("<?", isinstance(input_matrix, dict)) + matrix_bytes(input_matrix)
    out += struct.pack("<?", isinstance(output_matrix, dict)) + matrix_bytes(output_matrix)
    return out


@pytest.fixture
def dense_fasttext(tmp_path):
    """Return a factory writing a dense HS model (2 words, 4 buckets, 3 labels): `(path, spec)`."""

    def write(**overrides):
        rng = np.random.default_rng(7)
        spec = dict(
            dim=2,
            words=["</s>", "hello"],
            labels=["en", "de", "fr"],
            counts=[5, 3, 1],
            loss=1,
            bucket=4,
            input_matrix=rng.normal(size=(6, 2)).astype(np.float32),
            output_matrix=rng.normal(size=(3, 2)).astype(np.float32),
        )
        spec.update(overrides)
        path = tmp_path / "dense.bin"
        path.write_bytes(fasttext_bytes(**spec))
        return path, spec

    return write


@pytest.fixture
def fasttext_writer():
    """Return fasttext_bytes(), for tests that need a non-default model layout."""
    return fasttext_bytes
