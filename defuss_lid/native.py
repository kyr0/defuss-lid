"""Read released fastText v12 .bin/.ftz tables without native dependencies.

Only supervised models with wordNgrams=1 and hierarchical or flat softmax are
accepted; every other configuration fails explicitly instead of producing a
model that scores differently from fastText. Word n-grams (wordNgrams > 1)
would need fastText's word-pair hashing at inference time, which the runtimes
do not implement. The parser reads bytes with struct and numpy only: no pickle,
no native extension, no code loading from the model file.

The reader keeps fastText's own encodings (dense float32 rows or product
quantization with an optional norm codebook) so that exporting the released
lid.176.ftz is lossless: tests/test_native.py checks it against the shipped
models/v0.3/full/fasttext-native-exact.dlid when data/lid.176.ftz is present.

VERIFIED: exporting data/lid.176.ftz reproduced the shipped native packs byte for byte on 2026-11-02.
"""

import hashlib
import struct
from pathlib import Path

import numpy as np

# fastText's file magic and the only on-disk version this reader understands.
FASTTEXT_MAGIC = 793712314
FASTTEXT_VERSION = 12
# SHA-256 of the official lid.176.bin and lid.176.ftz, used only to attach the
# known CC-BY-SA-3.0 license to exports of those exact files.
OFFICIAL_LID176_SHA256 = {
    "7e69ec5451bc261cc7844e49e4792a85d7f09c06789ec800fc4a44aec362764e",
    "8f3472cfe8738a7b6099e8e999c3cbfae0dcd15696aac7d7738a8039db603e83",
}


class Reader:
    """Bounds-checked little-endian cursor over the bytes of a model file."""

    def __init__(self, path):
        self.data = Path(path).read_bytes()
        self.pos = 0

    def take(self, count):
        """Return the next `count` bytes as a zero-copy view; ValueError past the end."""
        if count < 0 or self.pos + count > len(self.data):
            raise ValueError("truncated fastText model")
        b = memoryview(self.data)[self.pos : self.pos + count]
        self.pos += count
        return b

    def unpack(self, fmt):
        """Read a struct with standard sizes and no padding (`<` prefix)."""
        return struct.unpack("<" + fmt, self.take(struct.calcsize("<" + fmt)))

    def array(self, dtype, shape):
        """Read a read-only C-order array of `shape`."""
        n = int(np.prod(shape))
        return np.frombuffer(self.take(n * np.dtype(dtype).itemsize), dtype=dtype).reshape(shape)

    def string(self):
        """Read a NUL-terminated UTF-8 dictionary entry."""
        end = self.data.find(b"\0", self.pos)
        if end < 0:
            raise ValueError("unterminated dictionary entry")
        value = self.data[self.pos : end].decode("utf-8")
        self.pos = end + 1
        return value


def read_pq(r):
    """Read a fastText ProductQuantizer and return its centroids as (groups, 256, width).

    fastText lets the last group be narrower (`lastdsub`); requiring uniform
    groups keeps the codebook a regular 3-D array for both runtimes.
    """
    dim, groups, width, last = r.unpack("4i")
    if dim < 1 or groups < 1 or width < 1 or last != width or groups * width != dim:
        raise ValueError("only uniform fastText PQ groups are supported")
    return r.array("<f4", (groups, 256, width))


def read_matrix(r, quantized):
    """Read a fastText DenseMatrix or QuantMatrix into a dict of arrays.

    Dense: `{"vectors"}`. Quantized: `{"codes", "books"}`, plus `{"norm_codes",
    "norm_book"}` when the model was quantized with -qnorm.
    """
    if not quantized:
        rows, dim = r.unpack("2q")
        if rows < 1 or dim < 1:
            raise ValueError("invalid matrix shape")
        return {"vectors": r.array("<f4", (rows, dim))}
    qnorm, rows, dim, count = r.unpack("?qqi")
    if rows < 1 or dim < 1 or count < rows or count % rows:
        raise ValueError("invalid quantized matrix")
    codes = r.array("u1", (rows, count // rows))
    books = read_pq(r)
    if books.shape[0] != codes.shape[1] or books.shape[0] * books.shape[2] != dim:
        raise ValueError("inconsistent quantized dimensions")
    result = {"codes": codes, "books": books}
    if qnorm:
        # The norm quantizer is a 1-D PQ (one group of width 1): 256 scalar norms.
        result["norm_codes"] = r.array("u1", (rows,))
        result["norm_book"] = read_pq(r).reshape(-1)
        if len(result["norm_book"]) != 256:
            raise ValueError("invalid norm codebook")
    return result


def dense(matrix):
    """Return the float32 rows of a dense, int8-with-row-scales or PQ matrix dict."""
    if "vectors" in matrix:
        x = matrix["vectors"]
        return x.astype(np.float32) * matrix["scales"][:, None] if "scales" in matrix else x
    x = np.concatenate([book[matrix["codes"][:, g]] for g, book in enumerate(matrix["books"])], axis=1)
    if "norm_codes" in matrix:
        x *= matrix["norm_book"][matrix["norm_codes"]][:, None]
    return x


def dense_head(arrays):
    """Return the float32 classifier, dequantizing int8 rows with their per-row scales."""
    x = arrays["head"].astype(np.float32)
    return x * arrays["head_scales"][:, None] if "head_scales" in arrays else x


def huffman(counts):
    """Rebuild fastText's hierarchical-softmax tree from label counts.

    fastText does not store the tree; it rebuilds it from the label counts at
    load time. This is the same two-queue Huffman construction as
    HierarchicalSoftmaxLoss::buildTree, including its tie-breaking (a leaf wins
    only when strictly smaller), so the node numbering matches the trained head
    rows. Leaves are 0..n-1 in dictionary order, internal node n + j is returned
    as `left[j]`, `right[j]`, and the root is 2n - 2.
    """
    n = len(counts)
    # fastText initializes not-yet-built internal nodes to a count of 1e15.
    values = list(map(int, counts)) + [10**15] * (n - 1)
    left, right = np.full(n - 1, -1, np.int32), np.full(n - 1, -1, np.int32)
    # Leaves are consumed from the end of the dictionary, which is the smallest
    # count first because labels are stored by descending count (as observed in
    # lid.176.ftz); internal nodes are consumed in creation order.
    leaf, node = n - 1, n
    for parent in range(n, 2 * n - 1):
        children = []
        for _ in range(2):
            if leaf >= 0 and values[leaf] < values[node]:
                children.append(leaf)
                leaf -= 1
            else:
                children.append(node)
                node += 1
        left[parent - n], right[parent - n] = children
        values[parent] = values[children[0]] + values[children[1]]
    return left, right


def read_fasttext(path):
    """Parse a fastText v12 supervised model into DLID `(meta, arrays)`.

    The input rows are reordered to words first, then buckets by ascending
    bucket ID, which is the layout Model expects. Label counts are dropped after
    the HS tree is rebuilt, since inference needs only the tree.
    """
    r = Reader(path)
    magic, version = r.unpack("2i")
    if magic != FASTTEXT_MAGIC or version != FASTTEXT_VERSION:
        raise ValueError("expected a fastText v12 model")
    names = "dim ws epoch minCount neg wordNgrams loss model bucket minn maxn lrUpdateRate".split()
    args = dict(zip(names, r.unpack("12i"), strict=True))
    r.unpack("d")  # sampling threshold t: training-only
    # fastText enums: model 3 = supervised; loss 1 = hs, 3 = softmax.
    if args["model"] != 3 or args["loss"] not in (1, 3) or args["wordNgrams"] != 1:
        raise ValueError(f"requires supervised, loss=hs/softmax, wordNgrams=1; got {args}")
    size, nw, nl, _, nprune = r.unpack("iiiqq")
    if nw < 0 or nl < 2 or size != nw + nl or nprune < -1:
        raise ValueError("invalid dictionary")
    words, labels, counts = [], [], []
    for i in range(size):
        word = r.string()
        count, kind = r.unpack("qb")
        # fastText stores all words (type 0) before all labels (type 1).
        if kind != (0 if i < nw else 1):
            raise ValueError("unsupported dictionary order")
        if i < nw:
            words.append(word)
        else:
            labels.append(word.removeprefix("__label__"))
            counts.append(count)
    # A pruned (.ftz) dictionary maps each retained bucket ID to its index among
    # the retained bucket rows; nprune == -1 means every bucket row is present.
    mapping = dict(r.unpack("2i") for _ in range(max(nprune, 0)))
    (quantized,) = r.unpack("?")
    input_matrix = read_matrix(r, quantized)
    # The output matrix is quantized only when both flags are set (-qout).
    (qout,) = r.unpack("?")
    output = dense(read_matrix(r, quantized and qout))
    if r.pos != len(r.data):
        raise ValueError("unexpected trailing data")
    bucket_ids = np.array(sorted(mapping) if nprune >= 0 else np.arange(args["bucket"]), dtype=np.uint32)
    bucket_rows = [nw + mapping[int(i)] for i in bucket_ids] if nprune >= 0 else range(nw, nw + args["bucket"])
    order = np.r_[np.arange(nw), np.asarray(bucket_rows, dtype=np.int64)]
    key = "codes" if quantized else "vectors"
    if len(order) != len(input_matrix[key]):
        raise ValueError("dictionary/matrix mismatch")
    for key in ("vectors", "codes", "norm_codes"):
        if key in input_matrix:
            input_matrix[key] = input_matrix[key][order]
    tree = huffman(counts) if args["loss"] == 1 else None
    source_hash = hashlib.sha256(r.data).hexdigest()
    known = source_hash in OFFICIAL_LID176_SHA256
    meta = {
        "dim": args["dim"],
        "words": words,
        "labels": labels,
        "bucket": args["bucket"],
        "minn": args["minn"],
        "maxn": args["maxn"],
        "loss": "hs" if tree else "softmax",
        "kind": "pq" if quantized else "fp32",
        "source_sha256": source_hash,
        "source_name": Path(path).name,
        "license": "CC-BY-SA-3.0 (official lid.176 weights)"
        if known
        else "Unspecified: retain the source model's actual license",
        "changes": "Portable table layout; sorted bucket mapping; counts removed after tree construction",
    }
    arrays = {"bucket_ids": bucket_ids, **input_matrix, "head": output.astype(np.float32)}
    if tree:
        arrays.update(left=tree[0], right=tree[1])
    return meta, arrays
