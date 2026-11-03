"""Reference inference for DLID fastText-style models.

The JavaScript runtime reads the same files and is tested against this module
for identical rankings and scores within 1e-12. Arithmetic is float64 from the
first dequantized value onwards: fastText itself accumulates in float32, but a
float64 reference is reproducible across Python and JS, and stays within the
native-parity tolerances (tests/native-fixtures.json, scripts/verify_native.py).

VERIFIED: agrees with native fastText on tests/native-fixtures.json
(tests/test_runtime.py::test_native_fasttext_parity).
"""

import math
import re

import numpy as np

from .features import bucket_ids, tokens
from .format import load

# fastText scores every probability factor as log(x + 1e-5) (std_log in loss.cc)
# and reports exp of the summed logs. Keeping the epsilon reproduces its scores
# exactly, including values slightly above 1 for near-certain predictions.
EPSILON = 1e-5
# A character fastText's stream reader keeps inside a word; text without one holds only EOS (see Model.predict).
_WORD_CHARACTER = re.compile(r"[^ \t\n\r\v\f\0]")


def bucket_gaps(ids):
    """Sorted bucket `ids` as the uint16 `bucket_gaps` section (the first id, then each id minus the one before), or
    None when a gap does not fit two bytes and the file must keep 4-byte `bucket_ids`. Model reads either form.

    Why: in a re-encoded DNO-PQ pack a bucket row takes 4 code bytes and a norm byte, so a 4-byte id is almost half of
    it, while the gaps between a pruned table's sorted ids stay far below 65,536 (VERIFIED: at most 5,103 in every v0.3
    fastText file and fastText DNO-PQ pack). Raises ValueError for ids that are not strictly ascending.
    """
    gaps = np.diff(np.asarray(ids, np.int64), prepend=0)
    if np.any(gaps[1:] < 1) or (len(gaps) and gaps[0] < 0):
        raise ValueError("bucket IDs must be sorted and unique")
    return gaps.astype(np.uint16) if not len(gaps) or gaps.max() <= 0xFFFF else None


def _with_bucket_ids(arrays):
    """`arrays` with `bucket_gaps` decoded into the `bucket_ids` every check and lookup reads, in the same position,
    so writing the result back gives the 4-byte file's layout; other files pass."""
    if "bucket_gaps" not in arrays:
        return arrays
    gaps = arrays["bucket_gaps"]
    if "bucket_ids" in arrays or gaps.dtype != np.uint16 or gaps.ndim != 1:
        raise ValueError("invalid bucket gaps")
    ids = np.cumsum(gaps, dtype=np.int64)
    if len(ids) and ids[-1] > 0xFFFFFFFF:
        raise ValueError("invalid bucket gaps")
    return dict(("bucket_ids", ids.astype(np.uint32)) if k == "bucket_gaps" else (k, v) for k, v in arrays.items())


class Model:
    """A validated, read-only language-identification model.

    `meta` is the DLID header (labels, words, n-gram settings, loss and table
    kind); `arrays` holds the tensors. Construction validates every shape and
    index the inference path uses, so a model that loads cannot index out of
    bounds or return uninitialized scores.
    """

    def __init__(self, meta, arrays):
        self.meta, self.arrays = meta, _with_bucket_ids(arrays)
        self.words = {w: i for i, w in enumerate(meta["words"])}
        # Pruned tables keep only some hash buckets. Rows are stored words first,
        # then buckets in ascending bucket-ID order, so the row is an offset.
        self.buckets = {int(b): len(self.words) + i for i, b in enumerate(self.arrays["bucket_ids"])}
        self._validate()

    @classmethod
    def load(cls, path):
        """Load and validate a `.dlid` file."""
        return cls(*load(path))

    def _validate(self):
        m, a = self.meta, self.arrays
        n, d, labels = len(self.words) + len(self.buckets), m["dim"], len(m["labels"])
        if len(self.words) != len(m["words"]) or labels < 1 or len(set(m["labels"])) != labels:
            raise ValueError("duplicate words/labels or insufficient labels")
        if m["kind"] not in ("fp32", "int8", "pq", "task-pq", "optic") or m["loss"] not in (
            "hs",
            "hs-subset",
            "softmax",
        ):
            raise ValueError("unsupported model")
        if not (1 <= d <= 4096 and 0 <= m["minn"] <= m["maxn"] <= 32 and m["bucket"] > 0):
            raise ValueError("invalid feature configuration")
        # Strictly ascending IDs make the row order canonical and prove uniqueness.
        ids = a["bucket_ids"]
        if len(ids) and (ids[-1] >= m["bucket"] or np.any(ids[1:] <= ids[:-1])):
            raise ValueError("bucket IDs must be sorted and unique")
        # Full HS and softmax heads have one row per label (HS uses n-1 of them as
        # internal nodes). Subset heads keep only the internal nodes still used.
        if (
            a["head"].ndim != 2
            or a["head"].shape[1] != d
            or (m["loss"] != "hs-subset" and a["head"].shape != (labels, d))
        ):
            raise ValueError("invalid classifier shape")
        if m.get("head_kind", "fp32") == "int8":
            # Positive scales: a zero or negative scale would silently zero or
            # flip a classifier row instead of failing.
            if (
                a["head"].dtype != np.int8
                or "head_scales" not in a
                or a["head_scales"].shape != (len(a["head"]),)
                or a["head_scales"].dtype != np.float32
                or np.any(a["head_scales"] <= 0)
            ):
                raise ValueError("invalid int8 classifier/scales")
        elif m.get("head_kind", "fp32") != "fp32" or a["head"].dtype != np.float32 or "head_scales" in a:
            raise ValueError("invalid classifier encoding")
        if m["loss"] == "hs-subset":
            # Paths are stored CSR-style: label i owns path_nodes/path_sides
            # [path_offsets[i], path_offsets[i + 1]).
            off, nodes, sides = (a.get(k) for k in ("path_offsets", "path_nodes", "path_sides"))
            if (
                off is None
                or nodes is None
                or sides is None
                or off.shape != (labels + 1,)
                or nodes.ndim != 1
                # Unsigned like the JS runtime's Uint32Array: a negative node would index from the end.
                or nodes.dtype.kind != "u"
                or sides.shape != nodes.shape
                or off[0] != 0
                or off[-1] != len(nodes)
                or np.any(off[1:] < off[:-1])
                or np.any(nodes >= len(a["head"]))
                or np.any(sides > 1)
            ):
                raise ValueError("invalid subset paths")
        if m["kind"] in ("fp32", "int8"):
            if a["vectors"].shape != (n, d):
                raise ValueError("invalid embedding shape")
            if m["kind"] == "int8" and a["scales"].shape != (n,):
                raise ValueError("invalid row scales")
        else:
            # Codes are uint8, so 256 centroids per group makes every code valid.
            g, k, width = a["books"].shape
            if g * width != d or k != 256 or a["codes"].shape != (n, g):
                raise ValueError("invalid PQ shape")
            if "norm_codes" in a and (a["norm_codes"].shape != (n,) or a["norm_book"].shape != (256,)):
                raise ValueError("invalid norm quantizer")
        for value in a.values():
            if value.dtype.kind == "f" and not np.isfinite(value).all():
                raise ValueError("non-finite model weights")
        if m["loss"] == "hs":
            if a["left"].shape != (labels - 1,) or a["right"].shape != (labels - 1,):
                raise ValueError("invalid tree shape")
            # Every node must be reached exactly once from the root: a cycle would
            # recurse forever and an unreachable leaf would keep a garbage score.
            visited = set()

            def walk(node):
                if node in visited or node < 0 or node >= 2 * labels - 1:
                    raise ValueError("invalid classifier tree")
                visited.add(node)
                if node >= labels:
                    walk(int(a["left"][node - labels]))
                    walk(int(a["right"][node - labels]))

            walk(2 * labels - 2)
            if len(visited) != 2 * labels - 1:
                raise ValueError("incomplete classifier tree")

    def features(self, text):
        """Return the table rows fastText would average for `text`, in order.

        In-vocabulary words contribute their word row, every token its retained
        n-gram buckets; `__label__` tokens are skipped as fastText does. Rows may
        repeat, and repeats weigh the average as in fastText.
        """
        ids = []
        for word in tokens(text):
            if word.startswith("__label__"):
                continue
            if word in self.words:
                ids.append(self.words[word])
            for b in bucket_ids(word, self.meta["minn"], self.meta["maxn"], self.meta["bucket"]):
                # Buckets pruned from the table contribute nothing, as in a
                # pruned fastText .ftz.
                row = self.buckets.get(b)
                if row is not None:
                    ids.append(row)
        return ids

    def vectors(self, ids):
        """Return the dequantized float64 embedding rows for `ids`."""
        a = self.arrays
        if self.meta["kind"] in ("fp32", "int8"):
            x = a["vectors"][ids].astype(np.float64)
            if self.meta["kind"] == "int8":
                x *= a["scales"][ids, None]
            return x
        # Product quantization: each group's code selects a sub-vector from that
        # group's codebook; concatenating the groups rebuilds the row.
        x = np.concatenate([book[a["codes"][ids, g]] for g, book in enumerate(a["books"])], axis=1).astype(np.float64)
        if "norm_codes" in a:
            # fastText's -qnorm stores direction and norm separately: the books
            # hold unit-scale directions and a 256-entry codebook holds norms.
            x *= a["norm_book"][a["norm_codes"][ids]][:, None]
        return x

    def scores_from_hidden(self, hidden):
        """Return one fastText-style score per label for a document vector.

        Scores are probabilities with fastText's epsilon applied: softmax reports
        p + 1e-5, hierarchical softmax exp(sum(log(p_node + 1e-5))) along the path.
        """
        a, m = self.arrays, self.meta
        logits = a["head"].astype(np.float64) @ hidden
        if m.get("head_kind") == "int8":
            # Scaling the dot product equals dequantizing the row first, but costs
            # one multiply per row instead of one per coefficient.
            logits *= a["head_scales"]
        if m["loss"] == "hs-subset":
            # Numerically stable sigmoid: exp(-log(1 + exp(-x))).
            p = np.exp(-np.logaddexp(0, -logits))
            scores = []
            for i in range(len(m["labels"])):
                lo, hi = a["path_offsets"][i : i + 2]
                nodes, sides = a["path_nodes"][lo:hi], a["path_sides"][lo:hi]
                # Side 1 is fastText's right child (probability p), side 0 the left (1 - p).
                probs = np.where(sides, p[nodes], 1 - p[nodes])
                scores.append(math.exp(sum(math.log(float(v) + EPSILON) for v in probs)))
            return np.asarray(scores)
        if m["loss"] == "softmax":
            p = np.exp(logits - logits.max())
            return p / p.sum() + EPSILON
        n = len(m["labels"])
        scores = np.empty(n)

        # Full hierarchical softmax: leaves are labels 0..n-1, internal node
        # n + j uses head row j, and the root is node 2n - 2 (fastText's layout).
        def walk(node, score):
            if node < n:
                scores[node] = math.exp(score)
                return
            index = node - n
            z = float(logits[index])
            # Branch on the sign so math.exp never overflows for large |z|.
            p = 1 / (1 + math.exp(-z)) if z >= 0 else math.exp(z) / (1 + math.exp(z))
            walk(int(a["left"][index]), score + math.log(1 - p + EPSILON))
            walk(int(a["right"][index]), score + math.log(p + EPSILON))

        walk(2 * n - 2, 0.0)
        return scores

    def predict(self, text, k=1, threshold=0.0, languages=None):
        """Return up to `k` `{"language", "score"}` dicts, best first.

        `threshold` applies to the probability before fastText's +1e-5 offset:
        fastText's softmax skips p < threshold, and its HS search prunes
        log-scores below log(threshold + 1e-5). Both reported scores carry the
        +1e-5, so one cutoff, score >= threshold + 1e-5, matches either loss.
        `languages` restricts the ranking to known labels without renormalizing
        scores. Text without words (only fastText separators: space, tab, CR, LF, VT, FF, NUL) returns []
        rather than an EOS-only prediction.
        Raises ValueError for invalid `k`, `threshold` or `languages`.
        """
        if type(k) is not int or k < 1 or not math.isfinite(threshold) or threshold < 0 or threshold > 1:
            raise ValueError("k >= 1 and threshold in [0,1] required")
        if languages is not None and (
            not languages or len(set(languages)) != len(languages) or set(languages) - set(self.meta["labels"])
        ):
            raise ValueError("languages must be nonempty, unique, known labels")
        ids = self.features(text)
        # Same rule as the JS runtime: abstain when no character is a word character for fastText's reader (str.strip
        # would also drop U+001C-U+001F and keep U+FEFF, which the two runtimes then disagreed on).
        if not _WORD_CHARACTER.search(text) or not ids:
            return []
        hidden = self.vectors(ids).mean(axis=0)
        scores = self.scores_from_hidden(hidden)
        # Stable sort: equal scores keep label order, so rankings are deterministic.
        order = [
            i for i in np.argsort(-scores, kind="stable") if languages is None or self.meta["labels"][i] in languages
        ][:k]
        return [
            {"language": self.meta["labels"][int(i)], "score": float(scores[i])}
            for i in order
            if scores[i] >= threshold + EPSILON
        ]
