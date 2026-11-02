"""Compress pretrained language-identification tables and run them portably.

No language model training is required: every artifact is derived from
released fastText or CLD3 weights. `Model` is the Python reference runtime for
`.dlid` files; the JavaScript runtime reads the same format.

VERIFIED: __version__ equals package.json and pyproject.toml (scripts/verify.mjs check 'versions').
"""

from .runtime import Model

__all__ = ["Model"]
__version__ = "0.3.0"
