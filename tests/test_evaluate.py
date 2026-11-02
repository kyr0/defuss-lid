"""Benchmark metrics, report summaries, Pareto frontiers and paired intervals."""

import json

import pytest

from defuss_lid.evaluate import frontier, metrics, paired_accuracy_ci, summarize


def row(i, gold, pred, score=0.9, slice_name="full", group=None, locale=None):
    """Return one prediction record."""
    record = {"id": str(i), "group": group or str(i), "gold": gold, "pred": pred, "score": score, "slice": slice_name}
    if locale:
        record["locale"] = locale
    return record


def test_coverage_curve_and_locales():
    """Thresholds trade coverage for accuracy; locales are scored separately."""
    rows = [
        row(0, "de", "de", 0.99, locale="de-DE"),
        row(1, "de", "en", 0.6, locale="de-DE"),
        row(2, "en", "en", 0.3, locale="en-US"),
        row(3, "en", "und", 0.0, locale="en-US"),
    ]
    r = metrics(rows)
    curve = {c["threshold"]: c for c in r["coverage_curve"]}
    assert curve[0]["coverage"] == 0.75 and curve[0]["accuracy_accepted"] == pytest.approx(2 / 3)
    assert curve[0.5]["coverage"] == 0.5 and curve[0.5]["accuracy_accepted"] == 0.5
    assert curve[0.99]["coverage"] == 0.25 and curve[0.99]["accuracy_accepted"] == 1.0
    assert r["per_locale"] == {"de-DE": {"n": 2, "accuracy": 0.5}, "en-US": {"n": 2, "accuracy": 0.5}}
    assert r["per_language"]["de"]["precision"] == 1.0 and r["per_language"]["en"]["precision"] == 0.5
    # With nothing above the highest threshold, accuracy is undefined rather than 0.
    assert metrics([row(0, "de", "de", 0.1)])["coverage_curve"][-1]["accuracy_accepted"] is None


def test_summarize_writes_metrics_per_slice(tmp_path):
    """summarize adds per-slice metrics to the report file and returns it."""
    report = tmp_path / "model.json"
    report.write_text(json.dumps({"model": "m", "model_bytes": 10}))
    rows = [row(0, "de", "de"), row(1, "en", "de"), row(0, "de", "en", slice_name="prefix-20")]
    report.with_suffix(".predictions.jsonl").write_text("".join(json.dumps(r) + "\n" for r in rows))
    summary = summarize(report)
    assert set(summary["metrics"]) == {"full", "prefix-20"}
    assert summary["metrics"]["full"]["accuracy"] == 0.5 and summary["metrics"]["prefix-20"]["n"] == 1
    assert json.loads(report.read_text()) == summary


def result(name, size, f1, p95):
    """Return a summarized benchmark result for frontier()."""
    return {
        "model": name,
        "model_bytes": size,
        "dataset_sha256": "same",
        "metrics": {"full": {"macro_f1": f1}},
        "timings": {"full": {"p95_ms": p95}},
    }


def test_frontier_with_and_without_latency():
    """A model stays on the frontier unless another is no worse everywhere and better somewhere."""
    small = result("small", 10, 0.80, 5.0)
    big = result("big", 20, 0.90, 1.0)
    dominated = result("dominated", 20, 0.80, 5.0)
    slow_twin = result("slow-twin", 10, 0.80, 9.0)
    unsized = result("cld3", None, 0.99, 0.1)
    results = [small, big, dominated, slow_twin, unsized]
    assert frontier(results) == ["small", "big"]
    # Without latency, slow-twin ties small and neither dominates the other.
    assert frontier(results, include_latency=False) == ["small", "big", "slow-twin"]


def test_paired_interval_sign_and_validation():
    """The delta is A minus B; records and gold labels must match one to one."""
    a = [row(i, "de", "de", group=str(i // 2)) for i in range(6)]
    b = [row(i, "de", "de" if i < 3 else "en", group=str(i // 2)) for i in range(6)]
    ci = paired_accuracy_ci(a, b, seed=1, draws=200)
    assert ci["accuracy_delta"] == 0.5 and 0 <= ci["ci95"][0] <= 0.5 <= ci["ci95"][1] <= 1
    with pytest.raises(ValueError, match="identical records"):
        paired_accuracy_ci(a, b[:-1])
    with pytest.raises(ValueError, match="identical records"):
        paired_accuracy_ci(a + a[:1], b + b[:1])
    with pytest.raises(ValueError, match="gold"):
        paired_accuracy_ci(a, [dict(r, gold="en") for r in b])
