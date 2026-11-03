const PACKS = {
  der_3: {
    name: "der_3",
    kind: "fasttext",
    format: "dlid",
    languages: ["en", "ru", "de"],
    bytes: 77952,
    sha256: "6119405a387d85683bf33b13403229d5b41759b6ded9c413850f053e0e74ff4d",
    asset: "models/fastText-pq-dno/der_3.dlid"
  },
  deferi_6: {
    name: "deferi_6",
    kind: "fasttext",
    format: "dlid",
    languages: ["en", "ru", "de", "fr", "it", "es"],
    bytes: 127424,
    sha256: "edd01aadbaeb4daf74877036021836fd965279991dbc770b1d6ddf0032482e81",
    asset: "models/fastText-pq-dno/deferi_6.dlid"
  },
  major_20: {
    name: "major_20",
    kind: "cld3-pack",
    format: "cld3q",
    languages: ["de", "nl", "ja", "ko", "th", "pt", "vi", "tr", "zh", "id", "it", "ru", "ur", "hi", "bn", "fr", "ar", "en", "es", "pl"],
    bytes: 110576,
    sha256: "03503bf3e896d64a7276eb23172669b253e9e62b5a0b2e7b9a8bd3a46d004a24",
    asset: "models/cld3-pq-dno/major_20.cld3q"
  },
  full: {
    name: "full",
    kind: "cld3-pack",
    format: "cld3q",
    languages: ["eo", "co", "eu", "ta", "de", "mt", "ps", "te", "su", "uz", "zh-Latn", "ne", "nl", "sw", "sq", "hmn", "ja", "no", "mn", "so", "ko", "kk", "sl", "ig", "mr", "th", "zu", "ml", "hr", "bs", "lo", "sd", "cy", "hy", "uk", "pt", "lv", "he", "cs", "vi", "jv", "be", "km", "mk", "tr", "fy", "am", "zh", "da", "sv", "fi", "ht", "af", "la", "id", "tl", "sm", "ca", "el", "ka", "sr", "it", "sk", "ru", "ru-Latn", "bg", "ny", "fa", "haw", "gl", "et", "ms", "gd", "bg-Latn", "ha", "is", "ur", "mi", "hi", "bn", "hi-Latn", "fr", "yi", "hu", "xh", "my", "tg", "ro", "ar", "lb", "el-Latn", "st", "ceb", "kn", "az", "si", "ky", "mg", "en", "gu", "es", "pl", "ja-Latn", "ga", "lt", "sn", "yo", "pa", "ku"],
    bytes: 130548,
    sha256: "1c468715f981034d1bde0fc0191f6fc357dca36944e2aaf6853a76e23c43339f",
    asset: "models/cld3-pq-dno/full.cld3q"
  }
};
const PACK_NAMES = Object.keys(PACKS);

export { PACKS, PACK_NAMES };
