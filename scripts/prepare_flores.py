"""Produce aligned, explicitly mapped, common-language FLORES-200 JSONL.

The released fastText/CLD3 models keep their full output vocabularies. Only the
gold data are restricted to this declared shared cohort. No oracle filtering.

UNKNOWN: not rerun on 2026-11-02 (needs downloaded corpora or weights); py_compile and --help pass.
"""

import argparse
import hashlib
import json
from pathlib import Path

# Explicit benchmark granularity. Arabic=MSA, Persian=Western Persian,
# Malay=Standard Malay, Chinese=Mandarin Hans, Nepali=individual Nepali,
# Mongolian=Halh. CLD3's iw/fil are normalized to he/tl in the runner.
MAPPING = dict(
    item.split(":")
    for item in """
af:afr_Latn am:amh_Ethi ar:arb_Arab bg:bul_Cyrl bn:ben_Beng bs:bos_Latn
ca:cat_Latn ceb:ceb_Latn cs:ces_Latn cy:cym_Latn da:dan_Latn de:deu_Latn
el:ell_Grek en:eng_Latn eo:epo_Latn es:spa_Latn et:est_Latn eu:eus_Latn
fa:pes_Arab fi:fin_Latn fr:fra_Latn ga:gle_Latn gl:glg_Latn gu:guj_Gujr
he:heb_Hebr hi:hin_Deva hr:hrv_Latn hu:hun_Latn hy:hye_Armn id:ind_Latn
is:isl_Latn it:ita_Latn ja:jpn_Jpan jv:jav_Latn ka:kat_Geor kk:kaz_Cyrl
km:khm_Khmr kn:kan_Knda ko:kor_Hang ky:kir_Cyrl lb:ltz_Latn lo:lao_Laoo
lt:lit_Latn lv:lvs_Latn mk:mkd_Cyrl ml:mal_Mlym mn:khk_Cyrl mr:mar_Deva
ms:zsm_Latn mt:mlt_Latn my:mya_Mymr ne:npi_Deva nl:nld_Latn pa:pan_Guru
pl:pol_Latn pt:por_Latn ro:ron_Latn ru:rus_Cyrl sd:snd_Arab si:sin_Sinh
sk:slk_Latn sl:slv_Latn so:som_Latn sq:als_Latn sr:srp_Cyrl sv:swe_Latn
sw:swh_Latn ta:tam_Taml te:tel_Telu tg:tgk_Cyrl th:tha_Thai tl:tgl_Latn
tr:tur_Latn uk:ukr_Cyrl ur:urd_Arab uz:uzn_Latn vi:vie_Latn zh:zho_Hans
""".split()
)


def prepare(root, out, split, limit):
    """Write the mapped FLORES `split` as JSONL to `out`, plus a .manifest.json beside it.

    `limit` = 0 keeps every sentence; otherwise the same evenly spaced sentence
    indices are taken for every language. Raises FileNotFoundError when a
    mapped language file is missing, rather than silently shrinking the cohort.
    """
    root, out = Path(root), Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    records, files = [], {}
    for label, code in sorted(MAPPING.items()):
        path = root / split / f"{code}.{split}"
        if not path.exists():
            raise FileNotFoundError(f"Required language missing: {path}")
        raw = path.read_bytes()
        files[code] = hashlib.sha256(raw).hexdigest()
        lines = raw.decode("utf-8").splitlines()
        # Evenly spaced deterministic subset. Shared source indices across
        # languages keep paired comparisons and grouped bootstrap possible.
        indices = (
            list(range(len(lines)))
            if limit == 0 or limit >= len(lines)
            else [i * len(lines) // limit for i in range(limit)]
        )
        for i in indices:
            records.append(
                {
                    "id": f"flores200:{split}:{code}:{i}",
                    "group": f"flores200:{split}:{i}",
                    "language": label,
                    "text": lines[i],
                    "source": "FLORES-200",
                    "split": split,
                }
            )
    # Interleave languages to prevent a language-local cache advantage.
    records.sort(key=lambda r: (int(r["id"].rsplit(":", 1)[1]), r["language"]))
    out.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in records), encoding="utf-8")
    manifest = {
        "dataset": "FLORES-200",
        "split": split,
        "records": len(records),
        "languages": MAPPING,
        "limit_per_language": limit,
        "source_sha256": files,
        "jsonl_sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
        "license": "CC-BY-SA-4.0",
        "url": "https://github.com/facebookresearch/flores/tree/main/flores200",
        "granularity": "explicit model label mapping; no label-conditioned prediction filtering",
        "note": "Single-domain translated sentences; not a web, mixed-language, or unsupported-language benchmark.",
    }
    out.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(out), "records": len(records), "languages": len(MAPPING)}))


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("root", help="extracted flores200_dataset directory")
    p.add_argument("output", help="JSONL file to write")
    p.add_argument("--split", choices=["dev", "devtest"], default="devtest", help="FLORES split (default: %(default)s)")
    p.add_argument("--limit", type=int, default=0, help="0=all; otherwise deterministic per-language sample")
    a = p.parse_args()
    if a.limit < 0:
        p.error("limit must be nonnegative")
    prepare(a.root, a.output, a.split, a.limit)
