"""DLID container: a JSON header followed by aligned little-endian numeric arrays.

Layout: 8-byte magic, uint32 header length, UTF-8 JSON header, zero padding to a
4-byte boundary, then the payload. Every array starts at a 4-byte-aligned offset
relative to the payload, so a JavaScript loader can create Float32Array or
Uint32Array views on it without copying. A JSON header stays readable and can
carry labels, vocabulary and provenance (`changes`, source hashes) without a
schema change.

VERIFIED: files written here load unchanged in src/container.ts; malformed headers raise ValueError
(tests/test_format.py).
"""

import json
import math
import struct
from pathlib import Path

import numpy as np

MAGIC = b"DLID0001"
# Files with an int8 classifier head use a second magic so that a v1-only reader
# fails on the magic instead of misreading int8 codes as float32 coefficients.
MAGIC_V2 = b"DLID0002"
# The only element types the runtimes implement. Keys are numpy kind + itemsize,
# which is also the spelling stored in the header.
DTYPES = {
    "f4": np.dtype("<f4"),
    "u4": np.dtype("<u4"),
    "i4": np.dtype("<i4"),
    "u2": np.dtype("<u2"),
    "u1": np.dtype("u1"),
    "i1": np.dtype("i1"),
}


def save(path, meta, arrays):
    """Write `meta` and `arrays` to `path` as a DLID container.

    The header records each array's offset, dtype and shape; `format`, `version`,
    `sections` and `payload_bytes` are filled in here and overwrite any stale
    values copied from a loaded model. Arrays are converted to little-endian
    C order, so the output bytes depend only on the array values, not on the host.
    Raises ValueError for dtypes outside DTYPES (for example float64), which
    callers must cast explicitly rather than have silently narrowed.
    """
    meta = dict(meta)
    sections, chunks, offset = {}, [], 0
    for name, array in arrays.items():
        array = np.asarray(array)
        dtype = array.dtype.kind + str(array.dtype.itemsize)
        if dtype not in DTYPES:
            raise ValueError(f"unsupported dtype {array.dtype}")
        array = np.ascontiguousarray(array, dtype=DTYPES[dtype])
        padding = (-offset) % 4
        chunks.append(b"\0" * padding)
        offset += padding
        sections[name] = {"offset": offset, "dtype": dtype, "shape": list(array.shape)}
        chunk = array.tobytes()
        chunks.append(chunk)
        offset += len(chunk)
    # Older runtimes must reject int8 heads instead of reading their codes as
    # ordinary FP32 classifier coefficients. All v1 artifacts remain readable.
    version = 2 if meta.get("head_kind") == "int8" else 1
    meta.update(format="defuss-lid", version=version, sections=sections, payload_bytes=offset)
    # Compact separators and allow_nan=False make the header deterministic and
    # strict JSON, which JSON.parse in the JS loader also accepts.
    header = json.dumps(meta, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(
        (MAGIC_V2 if version == 2 else MAGIC)
        + struct.pack("<I", len(header))
        + header
        + b"\0" * (-len(header) % 4)
        + b"".join(chunks)
    )


def load(path):
    """Read a DLID container and return `(meta, arrays)`.

    Arrays are read-only views into the file bytes (no copy). Every structural
    problem raises ValueError: wrong magic, truncated header or payload, trailing
    bytes, a magic/version mismatch, a malformed section table, unaligned or
    out-of-range arrays, and overlapping arrays. Overlap is rejected because two
    tensors sharing bytes cannot both be what the header claims.
    """
    data = Path(path).read_bytes()
    if data[:8] not in (MAGIC, MAGIC_V2) or len(data) < 12:
        raise ValueError("not a DLID v1/v2 model")
    size = struct.unpack_from("<I", data, 8)[0]
    if size > len(data) - 12:
        raise ValueError("truncated header")
    meta = json.loads(data[12 : 12 + size])
    if not isinstance(meta, dict):
        raise ValueError("header must be a JSON object")
    start = 12 + size + (-size % 4)
    # The magic and the header version must agree, so a v2 header cannot be
    # smuggled behind a v1 magic that older readers accept.
    if meta.get("format") != "defuss-lid" or meta.get("version") != (2 if data[:8] == MAGIC_V2 else 1):
        raise ValueError("unsupported format")
    if meta.get("payload_bytes") != len(data) - start:
        raise ValueError("truncated or trailing payload")
    if not isinstance(meta.get("sections"), dict):
        raise ValueError("header has no section table")
    arrays, ranges = {}, []
    for name, section in meta["sections"].items():
        if not isinstance(section, dict) or section.get("dtype") not in DTYPES:
            raise ValueError(f"invalid section {name!r}")
        dtype = DTYPES[section["dtype"]]
        shape, offset = section.get("shape"), section.get("offset")
        # `type(...) is int` also rejects bools and floats that JSON would allow.
        if (
            not isinstance(shape, list)
            or not all(type(n) is int and n >= 0 for n in shape)
            or type(offset) is not int
            or offset < 0
        ):
            raise ValueError("invalid array bounds")
        count = math.prod(shape)
        end = offset + count * dtype.itemsize
        if offset % 4 or end > len(data) - start:
            raise ValueError("invalid array bounds")
        # Empty arrays occupy no bytes and cannot overlap anything.
        if end > offset:
            ranges.append((offset, end))
        arrays[name] = np.frombuffer(data, dtype, count, start + offset).reshape(shape)
    ranges.sort()
    if any(a[1] > b[0] for a, b in zip(ranges, ranges[1:], strict=False)):
        raise ValueError("overlapping arrays")
    return meta, arrays
