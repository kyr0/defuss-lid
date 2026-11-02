"""Read pinned MASSIVE 1.1. Default retains the v0.1/v0.2 24-locale cohort.

Locales map to model labels by their language subtag (nb -> no), so zh-CN and
zh-TW both become zh. Records are interleaved by utterance ID across locales.

UNKNOWN: not rerun on 2026-11-02 (needs downloaded corpora or weights); py_compile and --help pass.
"""

import argparse
import hashlib
import json
import tarfile
from pathlib import Path

# The original 24-locale cohort of the v0.1/v0.2 reports.
LOCALES = (
    "ar-SA bn-BD de-DE el-GR en-US es-ES fi-FI fr-FR hi-IN hu-HU hy-AM id-ID "
    "is-IS ja-JP jv-ID ka-GE ko-KR lv-LV my-MM pt-PT ru-RU vi-VN zh-CN zh-TW"
).split()


def prepare(archive, output, split="test", limit=0, locales=None):
    """Write MASSIVE `split` records as JSONL to `output`, plus a .manifest.json beside it.

    `locales` is None (the 24-locale cohort), "all" (every locale in the
    archive) or a list of locale codes. `limit` = 0 keeps every record;
    otherwise evenly spaced records per locale. Raises ValueError for unknown
    or duplicate locales and invalid split/limit.
    """
    if limit < 0 or split not in ("dev", "test"):
        raise ValueError("invalid split/limit")
    records = []
    seen = []
    with tarfile.open(archive, "r:gz") as tar:
        available = sorted(Path(n).stem for n in tar.getnames() if n.startswith("1.1/data/") and n.endswith(".jsonl"))
        chosen = available if locales == "all" else (LOCALES if locales is None else list(locales))
        if not chosen or len(set(chosen)) != len(chosen) or set(chosen) - set(available):
            raise ValueError("invalid locales")
        for locale in chosen:
            with tar.extractfile(f"1.1/data/{locale}.jsonl") as stream:
                items = [json.loads(line) for line in stream]
            items = [r for r in items if r["partition"] == split]
            if limit and limit < len(items):
                items = [items[i * len(items) // limit] for i in range(limit)]
            # Norwegian Bokmal is "no" in both model label sets.
            label = {"nb": "no"}.get(locale.split("-")[0], locale.split("-")[0])
            for r in items:
                records.append(
                    {
                        "id": f"massive11:{split}:{locale}:{r['id']}",
                        "group": f"massive11:{split}:{r['id']}",
                        "language": label,
                        "locale": locale,
                        "text": r["utt"],
                        "source": "MASSIVE-1.1",
                        "split": split,
                    }
                )
            seen.append(locale)
    records.sort(key=lambda r: (int(r["id"].rsplit(":", 1)[1]), r["locale"]))
    out = Path(output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in records), encoding="utf-8")
    labels = sorted({r["language"] for r in records})
    manifest = {
        "dataset": "MASSIVE-1.1",
        "split": split,
        "locales": seen,
        "language_labels": len(labels),
        "labels": labels,
        "records": len(records),
        "limit_per_locale": limit,
        "archive_sha256": hashlib.sha256(Path(archive).read_bytes()).hexdigest(),
        "jsonl_sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
        "url": "https://github.com/alexa/massive",
        "license": "CC-BY-4.0",
        "note": "Explicit locale selection; zh-CN/zh-TW -> zh; nb-NO -> no. No runtime oracle filtering.",
    }
    out.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"output": str(out), "records": len(records), "labels": len(labels), "locales": len(seen)}))


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("archive", help="amazon-massive-dataset-1.1.tar.gz")
    p.add_argument("output", help="JSONL file to write")
    p.add_argument("--split", choices=["dev", "test"], default="test", help="MASSIVE partition (default: %(default)s)")
    p.add_argument("--limit", type=int, default=0, help="records per locale; 0 = all (default: %(default)s)")
    p.add_argument("--locales", help="comma-separated locale codes, or all; default is the original 24-locale cohort")
    a = p.parse_args()
    prepare(
        a.archive,
        a.output,
        a.split,
        a.limit,
        "all" if a.locales == "all" else a.locales.split(",") if a.locales else None,
    )
