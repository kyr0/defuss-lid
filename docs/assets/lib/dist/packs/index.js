const PACKS = {
  der_3: {
    name: "der_3",
    kind: "fasttext",
    format: "dlid",
    languages: ["en", "ru", "de"],
    bytes: 78048,
    sha256: "a5f7731d030a0142f1c45532903f6725da7468da69f0e9ea0428c7bbd28f24e2",
    asset: "models/v0.3/der_3.dlid"
  },
  deferi_6: {
    name: "deferi_6",
    kind: "fasttext",
    format: "dlid",
    languages: ["en", "ru", "de", "fr", "it", "es"],
    bytes: 127488,
    sha256: "b72e2ba0d099495882e781078903ade285092461ae8ef41b2a8b606fac08e2ba",
    asset: "models/v0.3/deferi_6.dlid"
  },
  major_20: {
    name: "major_20",
    kind: "cld3-pack",
    format: "cld3q",
    languages: ["de", "nl", "ja", "ko", "th", "pt", "vi", "tr", "zh", "id", "it", "ru", "ur", "hi", "bn", "fr", "ar", "en", "es", "pl"],
    bytes: 110428,
    sha256: "95854544f8bc194e455cbbf36264cd312ea21e92fcf49b23fd530fbb102bff9e",
    asset: "models/v0.3/major_20.cld3q"
  },
  full: {
    name: "full",
    kind: "cld3-pack",
    format: "cld3q",
    languages: ["eo", "co", "eu", "ta", "de", "mt", "ps", "te", "su", "uz", "zh-Latn", "ne", "nl", "sw", "sq", "hmn", "ja", "no", "mn", "so", "ko", "kk", "sl", "ig", "mr", "th", "zu", "ml", "hr", "bs", "lo", "sd", "cy", "hy", "uk", "pt", "lv", "he", "cs", "vi", "jv", "be", "km", "mk", "tr", "fy", "am", "zh", "da", "sv", "fi", "ht", "af", "la", "id", "tl", "sm", "ca", "el", "ka", "sr", "it", "sk", "ru", "ru-Latn", "bg", "ny", "fa", "haw", "gl", "et", "ms", "gd", "bg-Latn", "ha", "is", "ur", "mi", "hi", "bn", "hi-Latn", "fr", "yi", "hu", "xh", "my", "tg", "ro", "ar", "lb", "el-Latn", "st", "ceb", "kn", "az", "si", "ky", "mg", "en", "gu", "es", "pl", "ja-Latn", "ga", "lt", "sn", "yo", "pa", "ku"],
    bytes: 130404,
    sha256: "24af762041e06b07cae330b1af36b483c23e8b5d7cb51c80aad7a8d5460d7873",
    asset: "models/v0.3/full.cld3q"
  }
};
const PACK_NAMES = Object.keys(PACKS);

export { PACKS, PACK_NAMES };
