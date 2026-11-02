"""Weight-only CLD3 compression; reconstruct the unchanged WASM code at load.

CLD3 ships as an Emscripten WASM binary whose data segment embeds the network
weights. source_assets() locates each released parameter array in that binary
by exact byte match and cuts it out, leaving a weight-free "core" that every
pack shares. build() writes the weights, optionally compressed, as a DLID
container (`.cld3q`) that records each tensor's original byte range. At load
the JS runtime decodes the tensors back into those ranges, so the unmodified
CLD3 feature extraction and kernels run on them.

Inference memory/kernel shapes remain native. Model transfer/storage shrink;
no new feature extractor, supervised training, or compiled quantized kernel.

Tensor layout (sizes from inspection/cld3-parameters.npz): six uint8 embedding
tables (SHAPES) with one bfloat16 scale per row, an 80 x 208 hidden layer
(80 = the sum of the six embedding widths) and a 208 x 109 softmax.

VERIFIED: its raw full pack reconstructs the upstream WASM byte for byte (tests/cld3.test.ts).
"""

import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

import numpy as np
from scipy.cluster.vq import kmeans2

from .compress import nearest
from .format import save

# SHA-256 of the WASM embedded in cld3-asm 4.0.0. Offsets are only meaningful
# for this exact binary.
WASM_SHA = "fbbc082e3b310b7e25749866ab47e4537f653a85c8d0957bb38a90a150e76641"
# The 109 output labels; label i is softmax column i (output_columns index into it).
LABELS = (
    "eo co eu ta de mt ps te su uz zh-Latn ne nl sw sq hmn ja no mn so ko kk sl ig mr th zu ml hr bs lo "
    "sd cy hy uk pt lv he cs vi jv be km mk tr fy am zh da sv fi ht af la id tl sm ca el ka sr it sk ru "
    "ru-Latn bg ny fa haw gl et ms gd bg-Latn ha is ur mi hi bn hi-Latn fr yi hu xh my tg ro ar lb "
    "el-Latn st ceb kn az si ky mg en gu es pl ja-Latn ga lt sn yo pa ku"
).split()
# (rows, width) of kEmbeddingsWeights0..5.
SHAPES = [(1000, 16), (5000, 16), (12, 8), (103, 8), (5000, 16), (100, 16)]


def digest(data):
    """Return the hex SHA-256 of `data`."""
    return hashlib.sha256(data).hexdigest()


def source_assets(package, parameters, runtime):
    """Split the pinned cld3-asm WASM into a shared core and its 16 weight arrays.

    Writes to `runtime/`: `cld3-core.bin.gz` (the WASM without weight bytes),
    `cld3-glue.js` (the Emscripten loader adapted to take WASM bytes from memory
    and export an ES module), `cld3-core.json` and `cld3-layout.js` (byte ranges
    and labels). Returns `(base metadata, parameter arrays)` for build().
    Raises ValueError when the package version, WASM hash, Emscripten glue or
    any array's unique byte match differs from what was pinned.
    """
    package, runtime = Path(package), Path(runtime)
    info = json.loads((package / "package.json").read_text(encoding="utf-8"))
    if info["version"] != "4.0.0":
        raise ValueError("only hash-verified cld3-asm 4.0.0 is supported")
    js = (package / "dist/esm/lib/browser/cld3.js").read_text(encoding="utf-8")
    pattern = r'var wasmBinaryFile="data:application/octet-stream;base64,([A-Za-z0-9+/=]+)";'
    match = re.search(pattern, js)
    if not match:
        raise ValueError("embedded WASM not found")
    wasm = base64.b64decode(match[1])
    if digest(wasm) != WASM_SHA:
        raise ValueError("CLD3 WASM source hash changed")
    with np.load(parameters, allow_pickle=False) as z:
        params = {k: z[k].copy() for k in z.files}
    if len(params) != 16:
        raise ValueError("expected 16 CLD3 parameter arrays")
    # A unique exact match proves the extracted arrays are the bytes the WASM
    # computes with, so writing them back at these offsets restores the binary.
    ranges = []
    for name, arr in params.items():
        raw = arr.tobytes()
        if wasm.count(raw) != 1:
            raise ValueError(f"array does not have one exact WASM match: {name}")
        ranges.append({"name": name, "offset": wasm.index(raw), "bytes": len(raw), "dtype": arr.dtype.str})
    ranges.sort(key=lambda r: r["offset"])
    chunks = []
    pos = 0
    for r in ranges:
        if r["offset"] < pos:
            raise ValueError("overlapping parameter ranges")
        chunks.append(wasm[pos : r["offset"]])
        pos = r["offset"] + r["bytes"]
    chunks.append(wasm[pos:])
    core = b"".join(chunks)
    runtime.mkdir(parents=True, exist_ok=True)
    # mtime=0 fixes the gzip header, but the compressed stream still depends on
    # the zlib build: zlib 1.2.12 (macOS, Python 3.15) yields different bytes
    # than the shipped runtime/cld3-core.bin.gz for an identical core.
    packed_core = gzip.compress(core, compresslevel=9, mtime=0)
    (runtime / "cld3-core.bin.gz").write_bytes(packed_core)
    # Use the browser preamble with explicit in-memory WASM on every host.
    # Only replace the no-browser guard, binary URL, and module export footer.
    glue = re.sub(pattern, 'var wasmBinaryFile="cld3-supplied-in-memory.wasm";', js, count=1)
    guard = '}else{throw new Error("environment detection error")}var out='
    if glue.count(guard) != 1:
        raise ValueError("unexpected Emscripten environment guard")
    glue = glue.replace(guard, '}else if(!Module["wasmBinary"]){throw new Error("WASM bytes required")}var out=')
    footer = glue.index("\nif (typeof exports === 'object'")
    glue = glue[:footer] + "\nexport default Module;\n"
    glue = "// Derived from cld3-asm 4.0.0; see NOTICE.md and licenses/.\n" + glue
    (runtime / "cld3-glue.js").write_text(glue, encoding="utf-8")
    base = {
        "architecture": "cld3-wasm-pack",
        "kind": "cld3-pack",
        "source_wasm_sha256": WASM_SHA,
        "wasm_bytes": len(wasm),
        "core_sha256": digest(core),
        "core_gzip_sha256": digest(packed_core),
        "core_bytes": len(core),
        "core_gzip_bytes": len(packed_core),
        "ranges": ranges,
        "license": "Apache-2.0; Copyright 2016 Google Inc.",
        "runtime_note": "weights reconstructed before WASM instantiation; no inference RAM or kernel-size reduction",
    }
    (runtime / "cld3-core.json").write_text(json.dumps(base, indent=2) + "\n", encoding="utf-8")
    (runtime / "cld3-layout.js").write_text(
        "// Pinned cld3-asm 4.0.0 data layout; generated by build_cld3.py.\nexport const CLD3_LAYOUT = "
        + json.dumps({**base, "labels": LABELS}, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    return base, params


def pq_bytes(x, groups, centroids, iterations, seed):
    """Ordinary PQ of native uint8 rows, retaining upstream bfloat16 scales.

    Returns `(books, codes, decoded)`: uint8 books (groups x centroids x width),
    codes (one byte per code for 256 centroids; two 4-bit codes per byte, low
    nibble first, for 16 centroids) and the decoded uint8 rows for error
    measurement. The per-row scales are not touched, so dequantization in the
    native kernel stays exactly as upstream.
    """
    n, d = x.shape
    if d % groups or n < centroids:
        raise ValueError("invalid PQ shape")
    width = d // groups
    books = []
    codes = []
    for g in range(groups):
        block = x[:, g * width : (g + 1) * width].astype(np.float32)
        book, _ = kmeans2(block, centroids, iter=iterations, minit="++", seed=seed + g, missing="warn")
        # The native kernel consumes uint8 values; store exactly those values.
        book = np.clip(np.floor(book + 0.5), 0, 255).astype(np.uint8)
        # Assign against the rounded centroids that will actually be decoded.
        code = nearest(block, book.astype(np.float32))
        books.append(book)
        codes.append(code)
    books = np.stack(books)
    codes = np.stack(codes, axis=1)
    decoded = np.concatenate([books[g, codes[:, g]] for g in range(groups)], axis=1)
    flat = codes.reshape(-1)
    if centroids == 16:
        if len(flat) % 2:
            flat = np.pad(flat, (0, 1))
        codes = (flat[::2] | (flat[1::2] << 4)).astype(np.uint8)
    return books, codes, decoded


def build(base, params, output, method="raw", languages=None, seed=42, iterations=20):
    """Write a `.cld3q` pack and return a size/hash/error report.

    `method`: raw (original tensors), int8 (hidden and softmax weights as int8
    with one float32 scale per output neuron), pq / tiny-pq (8-bit codes with
    4 x 256 centroids / 4-bit codes with 2 x 16 centroids on the three largest
    embedding tables), or the pq/tiny-pq + int8 combinations. PQ is skipped for
    the three small tables: they have fewer rows (12, 103, 100) than 256
    centroids, and a pq8 codebook (256 x row width bytes) would outweigh their
    96 to 1600 bytes. `languages` keeps a subset of softmax columns in
    LABELS order; the embeddings and hidden layer are shared by all labels and
    stay whole. Raises ValueError for unknown methods or labels.
    """
    if method not in ("raw", "int8", "pq", "tiny-pq", "pq-int8", "tiny-pq-int8"):
        raise ValueError("unknown CLD3 compression method")
    if iterations < 1:
        raise ValueError("iterations must be positive")
    if languages is None:
        languages = LABELS
    if not languages or len(set(languages)) != len(languages) or set(languages) - set(LABELS):
        raise ValueError("languages must be nonempty, unique canonical CLD3 labels")
    columns = [i for i, label in enumerate(LABELS) if label in languages]
    meta = {
        **base,
        "method": method,
        "labels": [LABELS[i] for i in columns],
        "output_columns": columns,
        "seed": seed,
        "iterations": iterations,
        "tensors": {},
        "changes": "parameter pack; original CLD3 feature pipeline",
        "score_semantics": "native softmax over retained labels; excluded biases reconstructed as -1e9",
    }
    arrays = {}
    errors = {}
    for name, original in params.items():
        value = original.copy()
        emb = re.fullmatch(r"kEmbeddingsWeights([0-5])", name)
        if emb:
            value = value.reshape(SHAPES[int(emb[1])])
        elif name == "kHiddenWeights0":
            value = value.reshape(80, 208)
        elif name == "kSoftmaxWeights0":
            value = value.reshape(208, 109)[:, columns]
        elif name == "kSoftmaxBiasWeights0":
            value = value[columns]
        # `target` names the WASM range to restore; `scatter` tells the loader to
        # place a column subset back into the full 109-label layout.
        desc = {"shape": list(value.shape), "target": name}
        if name == "kSoftmaxWeights0":
            desc["scatter"] = "columns"
        if name == "kSoftmaxBiasWeights0":
            desc["scatter"] = "bias"
        pq = "pq" in method and emb and int(emb[1]) in (0, 1, 4)
        if pq:
            tiny = method.startswith("tiny-")
            groups = 2 if tiny else 4
            centroids = 16 if tiny else 256
            # Distinct seeds per table keep each table's k-means independent.
            books, codes, decoded = pq_bytes(value, groups, centroids, iterations, seed + int(emb[1]) * 17)
            arrays[name + "_books"] = books
            arrays[name + "_codes"] = codes
            desc.update(
                encoding="pq4" if tiny else "pq8",
                groups=groups,
                centroids=centroids,
                books=name + "_books",
                codes=name + "_codes",
            )
        elif method.endswith("int8") and name in ("kHiddenWeights0", "kSoftmaxWeights0"):
            # Per-output-neuron scale; the matrices are input × output.
            scales = np.maximum(np.max(np.abs(value), axis=0) / 127, np.finfo(np.float32).tiny).astype(np.float32)
            quant = np.clip(np.rint(value / scales), -127, 127).astype(np.int8)
            arrays[name + "_quant"] = quant
            arrays[name + "_scales"] = scales
            decoded = (quant.astype(np.float32) * scales).astype(np.float32)
            desc.update(encoding="int8-columns", quant=name + "_quant", scales=name + "_scales")
        else:
            arrays[name] = value
            decoded = value
            desc.update(encoding="raw", array=name)
        errors[name] = float(np.mean((value.astype(np.float64) - decoded.astype(np.float64)) ** 2))
        meta["tensors"][name] = desc
    meta["coefficient_mse"] = errors
    meta["changes"] += f"; {method}; {len(columns)} retained output labels; no supervised training"
    save(output, meta, arrays)
    raw = Path(output).read_bytes()
    return {
        "file": Path(output).name,
        "method": method,
        "labels": len(columns),
        "bytes": len(raw),
        "gzip9_bytes": len(gzip.compress(raw, compresslevel=9, mtime=0)),
        "sha256": digest(raw),
        "coefficient_mse": errors,
    }
