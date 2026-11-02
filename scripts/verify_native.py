"""Differential check against fastText C++ on both released model formats.

Compares top-1 label, top-1 score and the averaged hidden vector of the
Python reference runtime with the fastText bindings (`uv sync --extra
baseline`). Passes with no top-1 mismatch, hidden error < 1e-4 and score
error < 3e-5; the tolerances allow for float32 arithmetic in fastText versus
float64 in the reference runtime. --fixtures writes the native results for the
built-in texts, as stored in tests/native-fixtures.json.

UNKNOWN: not run on 2026-11-02; it needs the optional fasttext-wheel, whose Python 3.15 support is untested.
"""

import argparse
import json
from pathlib import Path

import numpy as np

from defuss_lid.native import read_fasttext
from defuss_lid.runtime import Model

TEXTS = [
    "Das ist ein deutscher Satz.",
    "Hello, how are you today?",
    "Как у тебя дела?",
    "中文测试。",
    "これは日本語の文章です。",
    "مرحبا كيف حالك اليوم؟",
    "Bonjour tout le monde.",
    "¿Cómo estás hoy?",
    "Isto é uma frase em português.",
    "İstanbul güzel bir şehir.",
    "Это 🙂 тест с эмодзи.",
    "e\u0301cole café Straße",
    "hello\u00a0world",
    "hello\tworld",
    "hello\0world",
    "first\nsecond",
    "a </s> ignored",
    "__label__de Hello world",
    "한국어 문장을 테스트합니다.",
    "यह हिंदी भाषा का एक वाक्य है।",
]

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("source", help="fastText .bin or .ftz model")
p.add_argument("--dataset", help="optional JSONL corpus; texts are sampled evenly from it")
p.add_argument("--output", required=True, help="JSON result file")
p.add_argument("--fixtures", help="write native results for the built-in texts to this JSON file")
p.add_argument("--limit", type=int, default=1000, help="maximum corpus texts (default: %(default)s)")
a = p.parse_args()
# Imported after argument parsing: the optional `baseline` extra is only needed to run, not for --help.
import fasttext  # noqa: E402

reference = fasttext.load_model(a.source)
model = Model(*read_fasttext(a.source))
texts = TEXTS.copy()
if a.dataset:
    records = [json.loads(x) for x in Path(a.dataset).read_text(encoding="utf-8").splitlines()]
    texts += [r["text"] for r in records[:: max(1, len(records) // a.limit)][: a.limit]]
max_hidden, max_score, mismatches = 0.0, 0.0, []
fixtures = []
for text in texts:
    clean = text.replace("\n", " ")
    # The C++ binding scores one newline-terminated line; the Python wrapper rejects "\n".
    native = reference.f.predict(clean + "\n", 1, 0.0, "strict")
    score, label = native[0]
    hidden = reference.get_sentence_vector(clean)
    ours = model.predict(text)[0]
    actual_hidden = model.vectors(model.features(text)).mean(axis=0)
    max_hidden = max(max_hidden, float(np.max(np.abs(hidden - actual_hidden))))
    max_score = max(max_score, abs(float(score) - ours["score"]))
    if label.removeprefix("__label__") != ours["language"]:
        mismatches.append(text)
    if text in TEXTS:
        fixtures.append(
            {
                "text": text,
                "language": label.removeprefix("__label__"),
                "score": float(score),
                "hidden": hidden.tolist(),
            }
        )
result = {
    "source": Path(a.source).name,
    "source_sha256": model.meta["source_sha256"],
    "cases": len(texts),
    "top1_mismatches": len(mismatches),
    "max_abs_hidden_error": max_hidden,
    "max_abs_top1_score_error": max_score,
    "pass": len(mismatches) == 0 and max_hidden < 1e-4 and max_score < 3e-5,
}
Path(a.output).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
if a.fixtures:
    Path(a.fixtures).write_text(json.dumps(fixtures, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result))
if not result["pass"]:
    raise SystemExit("native parity failed")
