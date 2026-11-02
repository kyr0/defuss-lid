"""fastText-compatible tokenization, signed-byte FNV hashing and character n-grams.

A pretrained table is only usable if text maps to exactly the row IDs fastText
computed during training, so this module reproduces fastText's feature
extraction byte for byte instead of using a "cleaner" tokenizer:

- No case folding or Unicode normalization: these would change pretrained features.
- Separators are the ASCII bytes fastText's stream reader splits on. Unicode
  spaces such as U+00A0 stay inside tokens, as they do in fastText.
- Newlines become spaces: the public API scores one document, while fastText
  would end the line at the first newline. scripts/verify_native.py applies the
  same replacement before calling fastText, and tests/native-fixtures.json
  records the native result for 'first\\nsecond'.
- Character n-gram lengths count Unicode code points, matching fastText's
  UTF-8 lead-byte walk for valid UTF-8.

VERIFIED: features match native fastText on tests/native-fixtures.json (tests/test_runtime.py).
"""

import re

# fastText Dictionary::readWord splits on these bytes. UTF-8 continuation and
# lead bytes are >= 0x80, so splitting the decoded string is equivalent.
SEPARATORS = re.compile(r"[ \t\r\v\f\x00]+")


def hash_bytes(data: bytes) -> int:
    """Return fastText's 32-bit FNV-1a hash of `data`.

    fastText XORs `uint32_t(int8_t(byte))`, so bytes >= 0x80 are sign-extended
    before the XOR. Plain FNV-1a would assign every non-ASCII n-gram a different
    bucket. Subtracting 256 gives the same low 32 bits once the product is masked.
    """
    h = 2166136261
    for b in data:
        h = ((h ^ (b if b < 128 else b - 256)) * 16777619) & 0xFFFFFFFF
    return h


def tokens(text: str):
    """Yield the whitespace tokens of `text`, ending with the `</s>` EOS token.

    fastText appends an EOS token to every line and its row is part of every
    document vector. A literal `</s>` in the input ends the stream early, as
    fastText's getLine stops at the first EOS. Raises TypeError for non-strings
    and UnicodeEncodeError for unpaired surrogates.
    """
    if not isinstance(text, str):
        raise TypeError("text must be a string")
    # Reject unpaired surrogates rather than silently hashing different bytes.
    text.encode("utf-8", errors="strict")
    for token in SEPARATORS.split(text.replace("\n", " ")):
        if token:
            yield token
            if token == "</s>":
                return
    yield "</s>"


def bucket_ids(word: str, minn: int, maxn: int, bucket: int):
    """Yield the hashed bucket IDs of the character n-grams of `word`.

    Mirrors fastText computeSubwords on `"<" + word + ">"`: n-grams of `minn` to
    `maxn` code points, excluding the lone `<` and `>` 1-grams, each hashed and
    reduced modulo `bucket`. EOS has no subwords, and `maxn == 0` disables
    subwords, as in fastText. IDs are yielded in fastText's order, with
    duplicates kept: a repeated n-gram counts twice in the document average.
    """
    if word == "</s>" or maxn == 0:
        return
    chars = ["<", *word, ">"]
    for i in range(len(chars)):
        # FNV-1a is a left fold over bytes, so extending the n-gram starting at
        # i by one code point extends its hash: no n-gram is hashed twice.
        h = 2166136261
        for j in range(i, min(i + maxn, len(chars))):
            for b in chars[j].encode("utf-8"):
                h = ((h ^ (b if b < 128 else b - 256)) * 16777619) & 0xFFFFFFFF
            n = j - i + 1
            if n >= minn and not (n == 1 and (i == 0 or j == len(chars) - 1)):
                yield h % bucket
