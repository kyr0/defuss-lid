"""Benchmark metrics, Pareto frontiers and paired bootstrap intervals.

Prediction rows are dicts with `gold`, `pred`, `score`, and for some functions
`id`, `group`, `slice` and `locale`. The abstention label is `und`. Never
compare different benchmark cohorts: frontier() refuses mixed dataset hashes.

VERIFIED: metric values were identical before and after the 2026-11-02 refactor (tests/test_evaluate.py).
"""

import collections
import json
from pathlib import Path

import numpy as np


def metrics(rows):
    """Return accuracy, macro-F1, per-language, per-locale and coverage metrics.

    Every row counts: an abstention (`und`) or a prediction outside the gold
    label set is an error, never dropped, so a model cannot raise its accuracy
    by refusing hard inputs. Macro-F1 averages over gold labels only.
    `coverage_curve` reports, per score threshold, the share of non-abstained
    rows accepted and their accuracy (None when nothing is accepted).
    """
    labels = sorted({r["gold"] for r in rows})
    gold, pred, tp = collections.Counter(), collections.Counter(), collections.Counter()
    for r in rows:
        gold[r["gold"]] += 1
        pred[r["pred"]] += 1
        if r["gold"] == r["pred"]:
            tp[r["gold"]] += 1
    per_language = {}
    for label in labels:
        precision = tp[label] / pred[label] if pred[label] else 0
        recall = tp[label] / gold[label]
        per_language[label] = {
            "n": gold[label],
            "precision": precision,
            "recall": recall,
            # 2tp / (gold + pred) equals 2PR / (P + R), and is 0 rather than 0/0 when tp is 0.
            "f1": 2 * tp[label] / (gold[label] + pred[label]),
        }
    f1 = float(np.mean([r["f1"] for r in per_language.values()]))
    curves = []
    for threshold in [0, 0.5, 0.8, 0.9, 0.95, 0.99]:
        accepted = [r for r in rows if r["pred"] != "und" and r["score"] >= threshold]
        curves.append(
            {
                "threshold": threshold,
                "coverage": len(accepted) / len(rows),
                "accuracy_accepted": sum(r["gold"] == r["pred"] for r in accepted) / len(accepted)
                if accepted
                else None,
            }
        )
    locales = sorted({r["locale"] for r in rows if r.get("locale")})
    per_locale = {
        loc: {
            "n": sum(r.get("locale") == loc for r in rows),
            "accuracy": sum(r.get("locale") == loc and r["gold"] == r["pred"] for r in rows)
            / sum(r.get("locale") == loc for r in rows),
        }
        for loc in locales
    }
    return {
        "n": len(rows),
        "languages": len(labels),
        "accuracy": sum(tp.values()) / len(rows),
        "per_locale": per_locale,
        "macro_f1": f1,
        "per_language": per_language,
        "coverage_curve": curves,
        "abstention_rate": pred["und"] / len(rows),
    }


def summarize(path):
    """Add per-slice metrics to a benchmark report and rewrite it in place.

    Reads `<name>.json` and its `<name>.predictions.jsonl`, computes metrics()
    per `slice` and stores them under `metrics`. Returns the updated report.
    """
    path = Path(path)
    summary = json.loads(path.read_text(encoding="utf-8"))
    rows = [
        json.loads(line) for line in path.with_suffix(".predictions.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    summary["metrics"] = {s: metrics([r for r in rows if r["slice"] == s]) for s in sorted({r["slice"] for r in rows})}
    path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary


def frontier(results, slice_name="full", include_latency=True):
    """Return the models no other model beats on size, macro-F1 and optionally p95 latency.

    A model is dominated when another is at least as good on every axis and
    strictly better on one. Raises ValueError unless all results share one
    `dataset_sha256`: scores on different cohorts are not comparable.
    """
    keys = {(r["dataset_sha256"], slice_name) for r in results}
    if len(keys) != 1:
        raise ValueError("Pareto comparison requires the identical dataset")
    # CLD3's weight-only bytes are unknown; avoid pretending WASM bytes are
    # directly comparable to DLID model-only bytes.
    points = [r for r in results if r.get("model_bytes") is not None]

    def dominates(a, b):
        # Smaller is better on every axis, hence the negated F1.
        av = [a["model_bytes"], -a["metrics"][slice_name]["macro_f1"]]
        bv = [b["model_bytes"], -b["metrics"][slice_name]["macro_f1"]]
        if include_latency:
            av.append(a["timings"][slice_name]["p95_ms"])
            bv.append(b["timings"][slice_name]["p95_ms"])
        return all(x <= y for x, y in zip(av, bv, strict=True)) and any(x < y for x, y in zip(av, bv, strict=True))

    return [r["model"] for r in points if not any(dominates(s, r) for s in points if s is not r)]


def paired_accuracy_ci(rows_a, rows_b, seed=42, draws=2000):
    """Paired bootstrap over source groups, preserving aligned translations.

    Returns the accuracy difference A - B and a 95% percentile interval.
    Resampling whole `group`s instead of rows keeps the translations of one
    source sentence together; they share content, so treating them as
    independent rows would make the interval too narrow. Both inputs must hold
    the same unique `(id, slice)` records with the same gold labels.
    """
    a = {(r["id"], r["slice"]): r for r in rows_a}
    b = {(r["id"], r["slice"]): r for r in rows_b}
    if a.keys() != b.keys() or len(a) != len(rows_a) or len(b) != len(rows_b):
        raise ValueError("paired comparisons require unique identical records")
    groups = collections.defaultdict(list)
    for key, r in a.items():
        if r["gold"] != b[key]["gold"]:
            raise ValueError("gold label mismatch")
        groups[r["group"]].append(int(r["pred"] == r["gold"]) - int(b[key]["pred"] == r["gold"]))
    totals = np.array([sum(v) for v in groups.values()])
    counts = np.array([len(v) for v in groups.values()])
    rng = np.random.default_rng(seed)
    estimates = []
    for _ in range(draws):
        ids = rng.integers(0, len(totals), len(totals))
        # Ratio of sums, not a mean of group means: groups may differ in size.
        estimates.append(totals[ids].sum() / counts[ids].sum())
    return {
        "accuracy_delta": float(totals.sum() / counts.sum()),
        "ci95": np.quantile(estimates, [0.025, 0.975]).tolist(),
        "bootstrap_unit": "aligned source sentence group",
        "draws": draws,
        "seed": seed,
    }
