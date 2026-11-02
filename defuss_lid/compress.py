"""Data-free compression of released tables, including output-aware latent VQ.

Every method here works from the pretrained weights alone: no labeled text, no
LID retraining. Three product-quantization (PQ) variants differ in what the
codebooks are fitted to reproduce:

- `pq`: ordinary k-means PQ of the embedding rows (embedding-space error).
- `task-pq`: k-means after a linear map under which squared Euclidean distance
  equals squared classifier-logit error, so codebook capacity goes to the
  directions the classifier actually reads, optionally with fewer dimensions.
- `optic`: task-pq followed by alternating decoder least squares, codebook least
  squares and conditional code reassignment under the classifier-output metric.
  This is an OPTIC-inspired single-table adaptation, not Gemma OPTIC or
  supervised LID training. Hierarchical-softmax node logits are the
  reconstruction targets.

Plus `fp32` and per-row symmetric `int8` rows, `pq-int8` (pq with an int8
classifier) and `quantize_head` for an int8 classifier on any table.

VERIFIED: the 2026-11-02 refactor kept the output bytes of all six methods identical (before/after
fingerprints).
"""

import copy

import numpy as np
from scipy.cluster.vq import kmeans2

from .native import dense, dense_head


def prune(meta, arrays, cutoff, selection="norm"):
    """Keep the `cutoff` most influential input rows and return dense fp32 `(meta, arrays)`.

    `selection="norm"` ranks rows by squared L2 norm. `selection="output"`
    ranks them by the squared norm of their classifier logits, ||W x||^2, which
    ignores directions the classifier does not read. Both need no corpus.
    `cutoff == 0` or a cutoff above the row count keeps every row. The EOS row
    is always kept: every document ends in `</s>`, so it enters every average.
    Retained rows stay in source order, so words-then-sorted-buckets still holds.
    """
    meta = copy.deepcopy(meta)
    x = dense(arrays)
    n = len(x)
    if cutoff < 0:
        raise ValueError("cutoff must be nonnegative (0 retains all rows)")
    if cutoff == 0 or cutoff >= n:
        ids = np.arange(n)
    else:
        if selection == "norm":
            score = np.einsum("ij,ij->i", x, x)
        elif selection == "output":
            # Avoid materializing a two-million by 176 output-score matrix:
            # ||W x||^2 = x^T (W^T W) x with a dim x dim metric.
            head = dense_head(arrays)
            # A full HS head has one row per label but only n - 1 internal nodes;
            # the last row is never read.
            w = head[:-1] if meta["loss"] == "hs" else head
            metric = w.astype(np.float64).T @ w.astype(np.float64)
            score = np.einsum("ij,jk,ik->i", x, metric, x, optimize=True)
        else:
            raise ValueError("selection must be norm or output")
        eos = meta["words"].index("</s>") if "</s>" in meta["words"] else None
        if eos is not None:
            score[eos] = np.inf
        # Stable tie-breaking and source ordering make builds reproducible.
        ids = np.sort(np.argsort(-score, kind="stable")[:cutoff])
    nw = len(meta["words"])
    wi, bi = ids[ids < nw], ids[ids >= nw] - nw
    meta["words"] = [meta["words"][i] for i in wi]
    meta.update(
        kind="fp32",
        retained_rows=len(ids),
        selection=selection,
        changes=meta.get("changes", "") + f"; feature pruning cutoff={cutoff}, selection={selection}",
    )
    out = {
        "vectors": np.ascontiguousarray(x[ids], dtype=np.float32),
        "bucket_ids": arrays["bucket_ids"][bi],
        "head": arrays["head"].copy(),
    }
    # The classifier and its encoding are unchanged by row pruning.
    for name in ("left", "right", "path_offsets", "path_nodes", "path_sides", "head_scales"):
        if name in arrays:
            out[name] = arrays[name].copy()
    return meta, out


def nearest(x, centers, chunk=4096):
    """Return the uint8 index of the nearest center for each row of `x`.

    Uses ||a - c||^2 = ||a||^2 + ||c||^2 - 2 a.c in chunks, so memory stays at
    chunk x centers instead of rows x centers. Supports at most 256 centers.
    """
    codes = np.empty(len(x), np.uint8)
    norms = (centers * centers).sum(axis=1)
    for start in range(0, len(x), chunk):
        block = x[start : start + chunk]
        distance = (block * block).sum(axis=1)[:, None] + norms - 2 * block @ centers.T
        codes[start : start + len(block)] = distance.argmin(axis=1)
    return codes


def latent(codes, books):
    """Decode PQ `codes` (rows x groups) with `books` (groups x 256 x width) to rows."""
    return np.concatenate([b[codes[:, g]] for g, b in enumerate(books)], axis=1)


def fit_optic(x, head, codes, books, steps, chunk=2048):
    """Refine PQ codes, codebooks and a decoder to reproduce the classifier logits.

    The objective is the mean squared error between `latent(codes, books) @
    decoder` and the original logits `x @ head.T`. Each step updates the
    codebooks by least squares, refits the decoder, reassigns every code to its
    exact conditional optimum, and refits the decoder again. A step that raises
    the objective (beyond 1e-8 relative) is rolled back and fitting stops, so
    the returned history is non-increasing. Returns `(codes, float32 books,
    float32 head (labels x rank), history)`. `codes` is updated in place.
    """
    target = x.astype(np.float64) @ head.astype(np.float64).T
    books = books.astype(np.float64)
    z = latent(codes, books)
    decoder = np.linalg.lstsq(z, target, rcond=1e-10)[0]

    def loss(zz, bb):
        return float(np.mean((zz @ bb - target) ** 2))

    history = [loss(z, decoder)]
    groups, _, width = books.shape
    for _ in range(steps):
        old = (codes.copy(), books.copy(), decoder.copy(), z.copy())
        # Update centroids with fixed assignments and decoder. Empty entries
        # remain available for the next discrete reassignment.
        residual = target - z @ decoder
        for g in range(groups):
            s = slice(g * width, (g + 1) * width)
            b = decoder[s]
            # Residual with this group's own contribution added back: what this
            # group alone should reproduce.
            residual += z[:, s] @ b
            sums = np.zeros((256, target.shape[1]))
            np.add.at(sums, codes[:, g], residual)
            counts = np.bincount(codes[:, g], minlength=256)
            active = counts > 0
            # Least-squares centroid c with c @ b closest to the mean residual of its rows.
            books[g, active] = (sums[active] / counts[active, None]) @ np.linalg.pinv(b)
            z[:, s] = books[g, codes[:, g]]
            residual -= z[:, s] @ b
        decoder = np.linalg.lstsq(z, target, rcond=1e-10)[0]
        metric = decoder @ decoder.T
        projection = target @ decoder.T
        # Each group update minimizes the exact current row-level squared
        # node-logit error, conditional on all other groups.
        for start in range(0, len(x), chunk):
            stop = min(start + chunk, len(x))
            zz = z[start:stop].copy()
            # h = gradient/2 of the row loss with respect to the latent row.
            h = zz @ metric - projection[start:stop]
            for g in range(groups):
                s = slice(g * width, (g + 1) * width)
                c = books[g]
                block = metric[s, s]
                # Loss as a function of this group's centroid c, up to a constant:
                # c M_ss c^T + 2 (h_s - z_s M_ss) c^T.
                linear = h[:, s] - zz[:, s] @ block
                cost = ((c @ block) * c).sum(axis=1)[None, :] + 2 * linear @ c.T
                assign = cost.argmin(axis=1)
                delta = c[assign] - zz[:, s]
                h += delta @ metric[s, :]
                zz[:, s] = c[assign]
                codes[start:stop, g] = assign
            z[start:stop] = zz
        decoder = np.linalg.lstsq(z, target, rcond=1e-10)[0]
        current = loss(z, decoder)
        if current > history[-1] * (1 + 1e-8):
            codes, books, decoder, z = old
            break
        history.append(current)
    return codes, books.astype(np.float32), decoder.T.astype(np.float32), history


def compress(meta, arrays, method="optic", groups=4, rank=None, seed=42, iterations=20, alternations=2):
    """Re-encode the input table with `method` and return new `(meta, arrays)`.

    `method` is one of fp32, int8, pq, pq-int8, task-pq, optic. PQ methods use
    256 centroids per group (one uint8 code), `groups` equal-width groups and
    `iterations` k-means iterations seeded with `seed + group`; `rank` lowers
    the dimension for task-pq/optic only, and `alternations` is the optic step
    count. Any int8 classifier is dequantized first, so the output head is fp32
    unless method is pq-int8. Raises ValueError for invalid settings.
    """
    meta = copy.deepcopy(meta)
    int8_head = method == "pq-int8"
    if int8_head:
        method = "pq"
    x = dense(arrays).astype(np.float32)
    head = dense_head(arrays)
    out = {
        k: v
        for k, v in arrays.items()
        if k in ("head", "bucket_ids", "left", "right", "path_offsets", "path_nodes", "path_sides")
    }
    out["head"] = head
    meta["head_kind"] = "fp32"
    meta.pop("head_quantization", None)
    if method == "fp32":
        out["vectors"] = x
    elif method == "int8":
        # Symmetric per-row max-abs scaling to [-127, 127]: zero stays exactly
        # zero. The tiny floor keeps all-zero rows valid instead of dividing by 0.
        scale = np.maximum(np.max(np.abs(x), axis=1) / 127, np.finfo(np.float32).tiny)
        out.update(
            vectors=np.clip(np.rint(x / scale[:, None]), -127, 127).astype(np.int8), scales=scale.astype(np.float32)
        )
    elif method in ("pq", "task-pq", "optic"):
        rank = x.shape[1] if rank is None else rank
        # 256 rows minimum: k-means needs at least one row per centroid.
        if not 1 <= rank <= x.shape[1] or groups < 1 or rank % groups or len(x) < 256:
            raise ValueError("PQ requires >=256 rows, positive groups dividing rank, and rank <= source dimension")
        if iterations < 1 or alternations < 0:
            raise ValueError("iterations >=1, alternations >=0 required")
        transform = np.eye(x.shape[1], dtype=np.float64)
        if method != "pq":
            w = head[:-1] if meta["loss"] == "hs" else head
            # T = V sqrt(L) for W^T W = V L V^T gives ||x T||^2 = ||W x||^2:
            # Euclidean k-means on x T minimizes classifier-logit error.
            evals, evecs = np.linalg.eigh(w.astype(np.float64).T @ w)
            # Clamp tiny eigenvalues so directions the head ignores keep a small
            # positive weight and T stays invertible.
            evals = np.maximum(evals, max(float(evals.max()) * 1e-8, 1e-12))
            transform = evecs @ np.diag(np.sqrt(evals))
            y = x @ transform
            # Principal axes of the mapped rows; the top `rank` are kept.
            vals, rotation = np.linalg.eigh(y.T @ y / len(y))
            order = np.argsort(-vals)[:rank]
            # Round-robin variance balancing across equally wide groups.
            permutation = [order[g::groups] for g in range(groups)]
            transform = transform @ rotation[:, np.concatenate(permutation)]
        elif rank != x.shape[1]:
            raise ValueError("plain PQ baseline retains full source dimension")
        y = (x @ transform).astype(np.float32)
        # Fold the inverse transform into the classifier so inference needs no
        # extra matrix: logits = W x = (W pinv(T)^T) applied to x T.
        projected_head = (head @ np.linalg.pinv(transform).T).astype(np.float32)
        width = rank // groups
        books, codes = [], []
        for g in range(groups):
            block = np.ascontiguousarray(y[:, g * width : (g + 1) * width])
            # Keep the `seed=` keyword: SciPy hands an int seed to its legacy
            # RandomState path, while `rng=` would switch to default_rng and
            # change every fitted codebook of the shipped packs.
            book, _ = kmeans2(block, 256, iter=iterations, minit="++", seed=seed + g, missing="warn")
            books.append(book.astype(np.float32))
            # kmeans2 labels come from before its last centroid update; recompute
            # so every code points at its nearest final centroid.
            codes.append(nearest(block, book))
        books, codes = np.stack(books), np.stack(codes, axis=1)
        if method == "optic":
            codes, books, projected_head, history = fit_optic(x, head, codes, books, alternations)
            meta["fit_node_logit_mse"] = history
        out.update(codes=codes.astype(np.uint8), books=books, head=projected_head)
        meta["dim"] = rank
        meta.update(
            groups=groups,
            seed=seed,
            kmeans_iterations=iterations,
            alternations=alternations if method == "optic" else 0,
        )
    else:
        raise ValueError(f"unknown compression method: {method}")
    meta["kind"] = method
    meta["changes"] = meta.get("changes", "") + f"; {method} table compression; no labeled data or LID retraining"
    return quantize_head(meta, out) if int8_head else (meta, out)


def quantize_head(meta, arrays):
    """Quantize classifier rows to symmetric int8 with one float32 scale per row.

    Per-row rather than per-tensor scales because classifier rows (HS nodes or
    labels) differ in magnitude. Rounding is np.rint (round half to even). Input
    embeddings and PQ codebooks are copied unchanged, so quantizing a native
    fastText table adds only head error. An already-int8 head is returned as a
    copy: re-quantizing would compound rounding error. The DLID writer stores
    the result with the DLID0002 magic.
    """
    meta = copy.deepcopy(meta)
    out = {k: v.copy() for k, v in arrays.items()}
    if meta.get("head_kind") == "int8":
        return meta, out
    head = dense_head(arrays)
    # The tiny floor keeps all-zero rows valid (Model rejects non-positive
    # scales); lid.176's never-read last HS head row is all zeros.
    scales = np.maximum(np.max(np.abs(head), axis=1) / 127, np.finfo(np.float32).tiny)
    out["head"] = np.clip(np.rint(head / scales[:, None]), -127, 127).astype(np.int8)
    out["head_scales"] = scales.astype(np.float32)
    meta["head_kind"] = "int8"
    meta["head_quantization"] = "symmetric per-row max-abs / 127; FP32 scales; round-to-even"
    meta["changes"] = meta.get("changes", "") + "; int8 classifier rows, no LID retraining"
    return meta, out
