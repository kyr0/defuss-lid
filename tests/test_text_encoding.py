"""Every text-mode file access in the repository's Python names its encoding.

Why: without `encoding=`, Python decodes with the locale's code page, which is cp1252 on Windows before Python 3.15
(PEP 686 makes UTF-8 the default from 3.15 on), and the package supports Python >= 3.10. A static scan also covers the
scripts no test runs; ruff's PLW1514 only flags calls whose receiver it can type as a Path, so it missed
`(ROOT / "…").read_text()`.

VERIFIED: CI on windows-latest with Python 3.12.10 failed to read tests/native-fixtures.json (UnicodeDecodeError,
cp1252) on 2026-11-02.
"""

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Modules whose `open` reads bytes by default and text only with "t" in the mode, like the built-in in reverse.
ARCHIVES = {"gzip", "bz2", "lzma"}
# Modules whose `open` has no text mode (or is not a file open at all).
NOT_TEXT = {"os", "tarfile", "zipfile", "webbrowser"}


def _argument(call: ast.Call, position: int, name: str):
    """The argument at `position` or keyword `name`, else None."""
    if len(call.args) > position:
        return call.args[position]
    return next((k.value for k in call.keywords if k.arg == name), None)


def _is_text(mode, default_text: bool) -> bool:
    if mode is None:
        return default_text
    if isinstance(mode, ast.Constant) and isinstance(mode.value, str):
        return "t" in mode.value if not default_text else "b" not in mode.value
    return True  # a computed mode may be text: name the encoding to be safe


def calls_without_encoding(tree: ast.AST) -> list[ast.Call]:
    """Text-mode open/read_text/write_text calls that do not pass an encoding."""
    calls = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = func.attr if isinstance(func, ast.Attribute) else func.id if isinstance(func, ast.Name) else None
        receiver = func.value.id if isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name) else None
        # The positions of mode and encoding follow each stdlib signature.
        if name == "read_text":
            missing = _argument(node, 0, "encoding") is None
        elif name == "write_text":
            missing = _argument(node, 1, "encoding") is None
        elif name == "open" and isinstance(func, ast.Name):  # open(file, mode, buffering, encoding)
            missing = _is_text(_argument(node, 1, "mode"), True) and _argument(node, 3, "encoding") is None
        elif name == "open" and receiver in ARCHIVES:  # gzip.open(filename, mode, compresslevel, encoding)
            missing = _is_text(_argument(node, 1, "mode"), False) and _argument(node, 3, "encoding") is None
        elif name == "open" and receiver not in NOT_TEXT:  # Path.open(mode, buffering, encoding)
            missing = _is_text(_argument(node, 0, "mode"), True) and _argument(node, 2, "encoding") is None
        else:
            missing = False
        if missing:
            calls.append(node)
    return calls


def text_io_without_encoding(source: str) -> list[int]:
    """Line numbers of the calls of `source` that do not pass an encoding."""
    return sorted(call.lineno for call in calls_without_encoding(ast.parse(source)))


def test_text_io_names_its_encoding():
    """No Python file of the package, the scripts or the tests reads or writes text in the locale encoding."""
    files = sorted(path for folder in ("defuss_lid", "scripts", "tests") for path in (ROOT / folder).rglob("*.py"))
    offenders = [
        f"{path.relative_to(ROOT)}:{line}"
        for path in files
        for line in text_io_without_encoding(path.read_text(encoding="utf-8"))
    ]
    assert offenders == [], 'pass encoding="utf-8" to: ' + ", ".join(offenders)


def test_scanner_tells_text_from_binary_access():
    """Binary modes and archive defaults pass; text calls without an encoding are reported by line."""
    source = "\n".join(
        [
            "p.read_text()",  # 1: text, no encoding
            'p.read_text(encoding="utf-8")',
            "p.write_text(s)",  # 3
            'p.write_text(s, encoding="utf-8")',
            "open(f)",  # 5
            'open(f, "rb")',
            'p.open("w")',  # 7
            'p.open("rb")',
            "gzip.open(f)",
            'gzip.open(f, "rt")',  # 10
            'gzip.open(f, "rt", encoding="utf-8")',
            "tarfile.open(f)",
        ]
    )
    assert text_io_without_encoding(source) == [1, 3, 5, 7, 10]
