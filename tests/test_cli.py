"""Command line interface: every subcommand end to end on real model files."""

import argparse
import json
from pathlib import Path

import pytest

import defuss_lid
from defuss_lid.cli import build_parser, main
from defuss_lid.format import load
from defuss_lid.runtime import Model

ROOT = Path(__file__).resolve().parents[1]
EXACT = ROOT / "models/v0.3/full/fasttext-native-exact.dlid"


def run(capsys, *argv):
    """Run the CLI in-process and return its stdout."""
    main([str(a) for a in argv])
    return capsys.readouterr().out


def test_version(capsys):
    """--version prints the package version."""
    with pytest.raises(SystemExit) as exit_info:
        main(["--version"])
    assert exit_info.value.code == 0
    assert capsys.readouterr().out.strip() == f"defuss-lid {defuss_lid.__version__}"


def subparsers(parser):
    """Return {name: parser} for every subcommand of `parser`."""
    action = next(a for a in parser._actions if isinstance(a, argparse._SubParsersAction))
    return action.choices


def test_every_argument_has_help(capsys):
    """Each subcommand and each of its arguments documents itself in --help."""
    parser = build_parser()
    commands = subparsers(parser)
    assert set(commands) == {"export", "compress", "quantize-head", "predict", "inspect", "subset"}
    for name, sub in commands.items():
        for action in sub._actions:
            assert action.help, f"{name} {action.dest} has no help"
        with pytest.raises(SystemExit) as exit_info:
            main([name, "--help"])
        assert exit_info.value.code == 0
        out = capsys.readouterr().out
        for action in sub._actions:
            # argparse wraps long help over lines; the first word is enough to find it.
            assert action.help.split()[0] in out, f"{name} {action.dest}"


def test_predict_prints_ranked_json(capsys):
    """predict returns the k best languages as JSON."""
    out = json.loads(run(capsys, "predict", ROOT / "models/v0.3/der_3.dlid", "Guten Morgen, wie geht es dir?"))
    assert [p["language"] for p in out][0] == "de" and len(out) == 3
    out = json.loads(run(capsys, "predict", EXACT, "Hello, how are you today?", "--k", "1"))
    assert len(out) == 1 and out[0]["language"] == "en"


def test_export_dlid_reproduces_identical_bytes(capsys, tmp_path):
    """Re-exporting a .dlid validates it and writes byte-identical output."""
    target = tmp_path / "copy.dlid"
    report = json.loads(run(capsys, "export", EXACT, target))
    assert report == {"file": str(target), "kind": "pq", "languages": 176, "dimension": 16}
    assert target.read_bytes() == EXACT.read_bytes()


def test_export_fasttext_binary(capsys, tmp_path, dense_fasttext):
    """A fastText .bin is parsed natively and saved as a loadable .dlid."""
    source, _ = dense_fasttext()
    target = tmp_path / "dense.dlid"
    report = json.loads(run(capsys, "export", source, target))
    assert report["kind"] == "fp32" and report["languages"] == 3
    assert Model.load(target).meta["labels"] == ["en", "de", "fr"]


def test_compress_with_explicit_options(capsys, tmp_path):
    """compress prunes, fits PQ and records the chosen settings."""
    target = tmp_path / "pq.dlid"
    argv = ["compress", EXACT, target, "--cutoff", "300", "--method", "pq", "--groups", "2", "--iterations", "2"]
    report = json.loads(run(capsys, *argv))
    assert report["kind"] == "pq" and report["dimension"] == 16
    meta, arrays = load(target)
    assert meta["retained_rows"] == 300 and meta["groups"] == 2 and arrays["codes"].shape == (300, 2)


def test_quantize_head_writes_v2(capsys, tmp_path):
    """quantize-head stores an int8 classifier in a DLID0002 file."""
    target = tmp_path / "int8.dlid"
    run(capsys, "quantize-head", EXACT, target)
    assert target.read_bytes()[:8] == b"DLID0002"
    assert Model.load(target).meta["head_kind"] == "int8"


def test_subset_with_corpus(capsys, tmp_path):
    """subset keeps the requested labels and only corpus-observed rows."""
    corpus = tmp_path / "calibration.jsonl"
    corpus.write_text('{"language": "de", "text": "Guten Morgen"}\n{"language": "en", "text": "Good morning"}\n')
    target = tmp_path / "deen.dlid"
    argv = ["subset", EXACT, target, "--languages", "de,en", "--corpus", corpus, "--max-features", "50"]
    report = json.loads(run(capsys, *argv))
    assert report["languages"] == 2
    meta, _ = load(target)
    assert meta["labels"] == ["en", "de"] and meta["retained_rows"] <= 50


@pytest.mark.parametrize("model", [EXACT, ROOT / "models/v0.3/major_20.cld3q"], ids=["dlid", "cld3q"])
def test_inspect_prints_metadata_without_vocabulary(capsys, model):
    """inspect prints the header as JSON, without the word list and section table."""
    meta = json.loads(run(capsys, "inspect", model))
    assert "words" not in meta and "sections" not in meta and meta["labels"]


def test_invalid_choice_exits_with_usage_error(capsys):
    """argparse rejects unknown methods before any file is read."""
    with pytest.raises(SystemExit) as exit_info:
        main(["compress", "in.dlid", "out.dlid", "--method", "zip"])
    assert exit_info.value.code == 2
    assert "invalid choice" in capsys.readouterr().err


def test_predict_on_a_cld3_pack_explains_the_runtime():
    """CLD3 packs have no Python inference; the CLI says where they run instead of failing with KeyError 'words'."""
    with pytest.raises(SystemExit, match="cld3-pack"):
        main(["predict", str(ROOT / "models/v0.3/major_20.cld3q"), "Hallo"])
