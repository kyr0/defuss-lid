"""Build real language subsets; optionally retain features observed in a corpus.

A subset physically removes classifier rows instead of masking labels at
prediction time, so a 3-language pack does not ship 176 labels' worth of head.
For hierarchical softmax the retained labels keep their original root-to-leaf
paths, which keeps every retained label's score identical to the full model
(restricted argmax, no renormalization). Flat softmax renormalizes over the
retained labels: dropping head rows removes their terms from the denominator.

Hashed buckets have no exclusive language ownership. Corpus pruning is an
empirical coverage restriction, never a proof that a bucket belongs to a language.

VERIFIED: exact subsets score like the full model restricted to their labels (tests/fasttext.test.ts,
tests/test_subset.py).
"""

import collections
import copy
import hashlib
import json
from pathlib import Path

import numpy as np

from .runtime import Model

# Splits that must never influence which features are kept: pruning on them
# would leak held-out data into the model.
EVALUATION_SPLITS = ("test", "devtest", "validation_test")


def restrict(meta, arrays, languages, corpus=None, min_count=1, max_features=0):
    """Return `(meta, arrays)` restricted to the `languages` labels.

    Labels keep the source model's order. With `corpus` (JSONL records with
    `language`, `text` and optional `split`), only table rows that occur in at
    least `min_count` documents of the requested languages are kept, at most
    `max_features` of them (0 = no cap, most frequent first), plus the EOS row.
    Records of other languages are ignored; records of an evaluation split
    raise ValueError, as do unknown or duplicate labels, a requested language
    without calibration text, and feature limits without a corpus.
    """
    languages = list(languages)
    if not languages or len(set(languages)) != len(languages):
        raise ValueError("languages must be nonempty and unique")
    unknown = set(languages) - set(meta["labels"])
    if unknown:
        raise ValueError("unknown languages: " + ", ".join(sorted(unknown)))
    if min_count < 1 or max_features < 0:
        raise ValueError("min_count >= 1 and max_features >= 0 required")
    if corpus is None and (min_count != 1 or max_features != 0):
        raise ValueError("feature limits require a calibration corpus")
    model = Model(meta, arrays)
    m = copy.deepcopy(meta)
    a = {k: v.copy() for k, v in arrays.items()}
    selected = [i for i, label in enumerate(meta["labels"]) if label in languages]
    m["labels"] = [meta["labels"][i] for i in selected]
    if meta["loss"] in ("hs", "hs-subset"):
        # paths[label] = [(head row, side)] from the root; side 1 = right child.
        paths = {}
        if meta["loss"] == "hs":
            n = len(meta["labels"])

            def walk(node, path):
                if node < n:
                    paths[node] = path
                else:
                    j = node - n
                    walk(int(a["left"][j]), path + [(j, 0)])
                    walk(int(a["right"][j]), path + [(j, 1)])

            walk(2 * n - 2, [])
        else:
            for i in selected:
                lo, hi = map(int, a["path_offsets"][i : i + 2])
                paths[i] = list(zip(map(int, a["path_nodes"][lo:hi]), map(int, a["path_sides"][lo:hi]), strict=True))
        # Keep only internal nodes on a retained path, renumbered densely in
        # their original order so the head stays a contiguous matrix.
        nodes = sorted({node for i in selected for node, _ in paths[i]})
        remap = {old: new for new, old in enumerate(nodes)}
        offsets, indices, sides = [0], [], []
        for i in selected:
            for node, side in paths[i]:
                indices.append(remap[node])
                sides.append(side)
            offsets.append(len(indices))
        a["head"] = a["head"][nodes]
        if "head_scales" in a:
            a["head_scales"] = a["head_scales"][nodes]
        a["path_offsets"] = np.asarray(offsets, dtype=np.uint32)
        a["path_nodes"] = np.asarray(indices, dtype=np.uint32)
        a["path_sides"] = np.asarray(sides, dtype=np.uint8)
        a.pop("left", None)
        a.pop("right", None)
        m["loss"] = "hs-subset"
        m["score_semantics"] = "original unconditional HS scores; restricted argmax, no renormalization"
    elif meta["loss"] == "softmax":
        a["head"] = a["head"][selected]
        if "head_scales" in a:
            a["head_scales"] = a["head_scales"][selected]
        m["score_semantics"] = "softmax conditional on the retained output labels"
    else:
        raise ValueError("unsupported classifier")
    m["allowlist"] = m["labels"]
    m["changes"] = m.get("changes", "") + "; physically subset output paths/rows"
    if corpus is not None:
        source = Path(corpus)
        counts = collections.Counter()
        by_language = collections.Counter()
        # Hash every byte, including skipped records, so the manifest pins the exact file.
        sha = hashlib.sha256()
        with source.open("rb") as f:
            for line_number, line in enumerate(f, 1):
                sha.update(line)
                if not line.strip():
                    continue
                row = json.loads(line)
                if row.get("language") not in languages:
                    continue
                if str(row.get("split", "")).lower() in EVALUATION_SPLITS:
                    raise ValueError(f"evaluation split cannot prune features (line {line_number})")
                if not isinstance(row.get("text"), str):
                    raise ValueError(f"missing text at line {line_number}")
                if not row["text"].strip():
                    continue
                # Document frequency: a row counts once per record however often it occurs.
                counts.update(set(model.features(row["text"])))
                by_language[row["language"]] += 1
        missing = set(languages) - by_language.keys()
        if missing:
            raise ValueError("no calibration examples for: " + ", ".join(sorted(missing)))
        ids = [i for i, count in counts.items() if count >= min_count]
        eos = model.words.get("</s>")
        if eos is not None and eos not in ids:
            ids.append(eos)
        # EOS first so a max_features cap can never drop it, then by descending
        # document frequency, then by row for a deterministic cut.
        ids.sort(key=lambda i: (i != eos, -counts[i], i))
        if max_features:
            ids = ids[:max_features]
        # Back to source order: words first, then buckets by ascending ID.
        ids = np.asarray(sorted(ids), dtype=np.int64)
        nw = len(meta["words"])
        wi, bi = ids[ids < nw], ids[ids >= nw] - nw
        m["words"] = [meta["words"][i] for i in wi]
        a["bucket_ids"] = arrays["bucket_ids"][bi]
        # Per-row arrays shrink; codebooks (books, norm_book) are shared by all rows.
        for key in ("vectors", "codes", "scales", "norm_codes"):
            if key in a:
                a[key] = a[key][ids]
        m["retained_rows"] = len(ids)
        m["feature_selection"] = {
            "policy": "observed-document-frequency",
            "corpus_sha256": sha.hexdigest(),
            "examples_per_language": dict(sorted(by_language.items())),
            "min_count": min_count,
            "max_features": max_features,
            "retained_words": len(wi),
            "retained_buckets": len(bi),
            "caveat": "hashed buckets can be shared/collide; unobserved valid features are removed",
        }
        m["changes"] += "; empirical calibration-corpus feature pruning"
    else:
        m["feature_selection"] = {
            "policy": "all",
            "caveat": "label selection alone does not identify language-specific ngrams",
        }
    Model(m, a)
    return m, a
