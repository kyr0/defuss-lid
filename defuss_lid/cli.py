"""Command line interface: `defuss-lid` or `python -m defuss_lid.cli`.

Every command that writes a model validates it with Model before saving, so the
CLI never leaves a file that the runtimes would reject. Results go to stdout as
JSON for scripting.

VERIFIED: scripts/e2e.mjs runs the README's CLI commands against the built wheel and checks documented flags
against --help.
"""

import argparse
import json

from . import __version__
from .compress import compress, prune, quantize_head
from .format import load, save
from .native import read_fasttext
from .runtime import Model
from .subset import restrict


def build_parser():
    """Return the argument parser for all subcommands."""
    p = argparse.ArgumentParser(description="Compress pretrained fastText LID weights without a training corpus")
    p.add_argument("--version", action="version", version=f"defuss-lid {__version__}")
    sub = p.add_subparsers(dest="command", required=True)
    source_help = "fastText .bin/.ftz file, or a .dlid file (chosen by the .dlid extension)"

    export = sub.add_parser("export", help="losslessly repackage supported .bin or .ftz")
    export.add_argument("source", help=source_help)
    export.add_argument("output", help="path of the .dlid file to write")

    fit = sub.add_parser("compress", help="prune and fit codebooks using pretrained weights only")
    fit.add_argument("source", help=source_help)
    fit.add_argument("output", help="path of the .dlid file to write")
    fit.add_argument("--cutoff", type=int, default=50000, help="input rows to keep; 0 keeps all (default: %(default)s)")
    fit.add_argument(
        "--selection",
        choices=["norm", "output"],
        default="norm",
        help="rank rows by embedding norm or by classifier-logit norm (default: %(default)s)",
    )
    fit.add_argument(
        "--method",
        choices=["fp32", "int8", "pq", "pq-int8", "task-pq", "optic"],
        default="optic",
        help="table encoding; pq-int8 also quantizes the classifier (default: %(default)s)",
    )
    fit.add_argument("--groups", type=int, default=4, help="PQ groups, each with 256 centroids (default: %(default)s)")
    fit.add_argument("--rank", type=int, help="reduced dimension for task-pq/optic (default: source dimension)")
    fit.add_argument("--seed", type=int, default=42, help="k-means seed; group g uses seed + g (default: %(default)s)")
    fit.add_argument("--iterations", type=int, default=20, help="k-means iterations per group (default: %(default)s)")
    fit.add_argument(
        "--alternations", type=int, default=2, help="optic refinement steps after k-means (default: %(default)s)"
    )

    qhead = sub.add_parser("quantize-head", help="int8 classifier, preserving input embeddings/PQ codebooks")
    qhead.add_argument("source", help=source_help)
    qhead.add_argument("output", help="path of the .dlid file to write")

    predict = sub.add_parser("predict", help="print the top languages of a text as JSON")
    predict.add_argument("model", help=".dlid model file")
    predict.add_argument("text", help="text to identify")
    predict.add_argument("--k", type=int, default=3, help="number of languages to return (default: %(default)s)")

    inspect = sub.add_parser("inspect", help="print model metadata as JSON, without the vocabulary")
    inspect.add_argument("model", help=".dlid or .cld3q file")

    subset = sub.add_parser("subset", help="physically restrict labels and optionally observed corpus features")
    subset.add_argument("source", help=source_help)
    subset.add_argument("output", help="path of the .dlid file to write")
    subset.add_argument("--languages", required=True, help="comma-separated exact language labels")
    subset.add_argument("--corpus", help="JSONL calibration text/language records; test splits rejected")
    subset.add_argument(
        "--min-count",
        type=int,
        default=1,
        help="keep features seen in at least this many corpus records (default: %(default)s)",
    )
    subset.add_argument(
        "--max-features",
        type=int,
        default=0,
        help="cap on kept corpus features, most frequent first; 0 = no cap (default: %(default)s)",
    )
    return p


def main(argv=None):
    """Run the CLI with `argv` (default: sys.argv[1:])."""
    args = build_parser().parse_args(argv)
    if args.command in ("export", "compress", "subset", "quantize-head"):
        meta, arrays = load(args.source) if str(args.source).endswith(".dlid") else read_fasttext(args.source)
        if args.command == "subset":
            meta, arrays = restrict(
                meta, arrays, args.languages.split(","), args.corpus, args.min_count, args.max_features
            )
        if args.command == "compress":
            meta, arrays = prune(meta, arrays, args.cutoff, args.selection)
            meta, arrays = compress(
                meta, arrays, args.method, args.groups, args.rank, args.seed, args.iterations, args.alternations
            )
        if args.command == "quantize-head":
            meta, arrays = quantize_head(meta, arrays)
        Model(meta, arrays)
        save(args.output, meta, arrays)
        print(
            json.dumps(
                {"file": args.output, "kind": meta["kind"], "languages": len(meta["labels"]), "dimension": meta["dim"]}
            )
        )
    elif args.command == "predict":
        meta, arrays = load(args.model)
        if meta.get("architecture") == "cld3-wasm-pack":
            # CLD3 inference needs the native feature extraction, which only the JS/WASM runtime ships.
            raise SystemExit(
                "defuss-lid predict: CLD3 packs run in JavaScript (defuss-lid/cld3-pack); "
                "Python predicts .dlid fastText models"
            )
        print(json.dumps(Model(meta, arrays).predict(args.text, args.k), ensure_ascii=False))
    else:
        meta, arrays = load(args.model)
        # CLD3 packs hold WASM tensors, not a fastText table; only the container is checked.
        if meta.get("architecture") != "cld3-wasm-pack":
            Model(meta, arrays)
        print(json.dumps({k: v for k, v in meta.items() if k not in ("words", "sections")}, indent=2))


if __name__ == "__main__":
    main()
