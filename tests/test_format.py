"""DLID container contract: exact round trips and ValueError for every malformed file."""

import json
import struct

import numpy as np
import pytest

from defuss_lid.format import MAGIC, MAGIC_V2, load, save


def container(meta, payload=b"", magic=MAGIC):
    """Assemble raw DLID bytes by hand, bypassing save() so malformed headers can be written."""
    header = json.dumps(meta).encode()
    return magic + struct.pack("<I", len(header)) + header + b"\0" * (-len(header) % 4) + payload


def valid_meta(**sections):
    """Return a header that passes the format/version/payload checks for the given sections."""
    return {"format": "defuss-lid", "version": 1, "payload_bytes": 8, "sections": sections}


@pytest.mark.parametrize(
    "raw",
    [
        # A dtype the container never writes (float64) must not surface as a KeyError.
        container(valid_meta(x={"offset": 0, "dtype": "f8", "shape": [1]}), b"\0" * 8),
        # A scalar shape must not surface as a TypeError from iterating an int.
        container(valid_meta(x={"offset": 0, "dtype": "f4", "shape": 1}), b"\0" * 8),
        # A JSON header that is not an object must not surface as an AttributeError.
        container([1, 2]),
        # A header without a section table must not surface as a KeyError.
        container({"format": "defuss-lid", "version": 1, "payload_bytes": 0}),
        # A section entry that is not an object must not surface as a TypeError.
        container(valid_meta(x=[0, "f4", [1]]), b"\0" * 8),
    ],
    ids=["unknown-dtype", "scalar-shape", "header-not-object", "no-sections", "section-not-object"],
)
def test_malformed_header_raises_value_error(tmp_path, raw):
    """Callers rely on one exception type to reject untrusted model files."""
    path = tmp_path / "bad.dlid"
    path.write_bytes(raw)
    with pytest.raises(ValueError):
        load(path)


def test_round_trip_all_dtypes_aligned_little_endian(tmp_path):
    """Every supported dtype round-trips exactly, 4-byte aligned, stored little-endian."""
    arrays = {
        "f4": np.array([1.5, -2.25], ">f4"),  # big-endian input must be stored little-endian
        "u4": np.array([[1, 2, 3]], np.uint32),
        "i4": np.array([-7], np.int32),
        "u2": np.array([65535, 1, 2], np.uint16),
        "u1": np.array([255], np.uint8),
        "i1": np.array([-128, 127, 0], np.int8),
        "empty": np.zeros((0, 3), np.float32),
    }
    path = tmp_path / "all.dlid"
    save(path, {"note": "ünïcode"}, arrays)
    meta, loaded = load(path)
    assert path.read_bytes()[:8] == MAGIC and meta["version"] == 1 and meta["note"] == "ünïcode"
    for name, array in arrays.items():
        assert meta["sections"][name]["offset"] % 4 == 0
        assert loaded[name].dtype.byteorder in ("<", "|", "=")
        np.testing.assert_array_equal(loaded[name], array)
        assert loaded[name].shape == array.shape


def test_unsupported_dtype_is_not_narrowed(tmp_path):
    """float64 must be cast by the caller; the writer never silently loses precision."""
    with pytest.raises(ValueError, match="unsupported dtype"):
        save(tmp_path / "x.dlid", {}, {"x": np.zeros(2, np.float64)})


def test_int8_head_selects_v2_magic_and_v1_magic_rejects_v2_header(tmp_path):
    """Int8 heads are written as DLID0002, and magic and header version must agree."""
    path = tmp_path / "v2.dlid"
    save(path, {"head_kind": "int8"}, {"head": np.zeros((1, 1), np.int8)})
    raw = path.read_bytes()
    assert raw[:8] == MAGIC_V2 and load(path)[0]["version"] == 2
    path.write_bytes(MAGIC + raw[8:])
    with pytest.raises(ValueError, match="unsupported format"):
        load(path)


@pytest.mark.parametrize(
    ("sections", "message"),
    [
        ({"a": {"offset": 0, "dtype": "f4", "shape": [2]}, "b": {"offset": 4, "dtype": "f4", "shape": [1]}}, "overlap"),
        ({"a": {"offset": 2, "dtype": "u1", "shape": [1]}}, "bounds"),
        ({"a": {"offset": 0, "dtype": "f4", "shape": [3]}}, "bounds"),
        ({"a": {"offset": 0, "dtype": "f4", "shape": [True]}}, "bounds"),
    ],
    ids=["overlapping", "unaligned", "past-end", "bool-dimension"],
)
def test_invalid_array_layout_is_rejected(tmp_path, sections, message):
    """Arrays must be aligned, inside the payload and disjoint."""
    path = tmp_path / "bad.dlid"
    path.write_bytes(container(valid_meta(**sections), b"\0" * 8))
    with pytest.raises(ValueError, match=message):
        load(path)
