"""Download pinned source artifacts. Refuse hash mismatches; use atomic writes.

Every artifact is pinned by SHA-256, so an upstream change fails loudly instead
of silently changing benchmark data or model weights. Bytes stream into a
.part file that replaces the target only after the hash matches.

UNKNOWN: not rerun on 2026-11-02 (needs downloaded corpora or weights); py_compile and --help pass.
"""

import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

ARTIFACTS = {
    "amazon-massive-dataset-1.1.tar.gz": (
        "https://amazon-massive-nlu-dataset.s3.amazonaws.com/amazon-massive-dataset-1.1.tar.gz",
        "4cba5faa11c71437928e17cb1b9b3d8b8e727e7ea363a3a9a8045e19c0491577",
    ),
    "lid.176.bin": (
        "https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.bin",
        "7e69ec5451bc261cc7844e49e4792a85d7f09c06789ec800fc4a44aec362764e",
    ),
    "lid.176.ftz": (
        "https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.ftz",
        "8f3472cfe8738a7b6099e8e999c3cbfae0dcd15696aac7d7738a8039db603e83",
    ),
    "flores200_dataset.tar.gz": (
        "https://dl.fbaipublicfiles.com/nllb/flores200_dataset.tar.gz",
        "b8b0b76783024b85797e5cc75064eb83fc5288b41e9654dabc7be6ae944011f6",
    ),
}


def download(name, directory):
    """Return the path of the verified artifact `name` in `directory`, downloading it if needed."""
    url, expected = ARTIFACTS[name]
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / name
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == expected:
        return path
    temp = path.with_name(path.name + ".part")
    try:
        sha = hashlib.sha256()
        with urlopen(url, timeout=60) as r, temp.open("wb") as f:
            while chunk := r.read(1024 * 1024):
                sha.update(chunk)
                f.write(chunk)
        if sha.hexdigest() != expected:
            raise ValueError(f"source artifact changed: {name}; expected {expected}, got {sha.hexdigest()}")
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)
    return path


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--directory", default="data", help="download directory (default: %(default)s)")
    p.add_argument("artifacts", nargs="*", metavar="ARTIFACT", help="known artifact names; omitted = all pinned files")
    a = p.parse_args()
    unknown = set(a.artifacts) - ARTIFACTS.keys()
    if unknown:
        p.error("unknown artifacts: " + ", ".join(sorted(unknown)))
    for name in a.artifacts or list(ARTIFACTS):
        print(json.dumps({"file": str(download(name, a.directory)), "sha256": ARTIFACTS[name][1]}))
