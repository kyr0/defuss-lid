/**
 * Registry of the four recommended language packs: pure metadata, no I/O, safe to import anywhere.
 *
 * Why a separate registry module: applications can list packs, show sizes or pick one at runtime without pulling in
 * any model bytes or the CLD3 runtime. The loaders live in `defuss-lid/packs/<name>`, one module per pack, so a bundle
 * contains only the packs it imports.
 *
 * `bytes` and `sha256` describe the released file (models.lock.json pins the same bytes on Hugging Face); the test
 * suite and `scripts/verify.mjs` fail when they disagree, so this table cannot silently drift from the artifacts.
 *
 * VERIFIED: bytes and sha256 equal models.lock.json (tests/packs.test.ts; scripts/verify.mjs check 'registry').
 *
 * @module
 */

/** Metadata of one pack. */
export interface PackMeta {
  name: string;
  /** Runtime family: `fasttext` (pure JS, `.dlid`) or `cld3-pack` (WebAssembly, needs the shared CLD3 core). */
  kind: 'fasttext' | 'cld3-pack';
  format: 'dlid' | 'cld3q';
  /** The labels the pack can return, in the pack's own order. */
  languages: readonly string[];
  /** Exact size of the pack file in bytes. */
  bytes: number;
  /** SHA-256 of the pack file (hex). */
  sha256: string;
  /**
   * Path of the file inside this package: `models/v0.3/<file>` is `<file>` in the Hugging Face repository
   * kyr0/defuss-lid-1.0, `models/cld3-pq-dno/<file>` is `<file>` in kyr0/cld3-pq-dno.
   */
  asset: string;
}

export type PackName = 'der_3' | 'deferi_6' | 'major_20' | 'full';

export const PACKS: Readonly<Record<PackName, PackMeta>> = {
  der_3: {
    name: 'der_3',
    kind: 'fasttext',
    format: 'dlid',
    languages: ['en', 'ru', 'de'],
    bytes: 78048,
    sha256: 'a5f7731d030a0142f1c45532903f6725da7468da69f0e9ea0428c7bbd28f24e2',
    asset: 'models/v0.3/der_3.dlid',
  },
  deferi_6: {
    name: 'deferi_6',
    kind: 'fasttext',
    format: 'dlid',
    languages: ['en', 'ru', 'de', 'fr', 'it', 'es'],
    bytes: 127488,
    sha256: 'b72e2ba0d099495882e781078903ade285092461ae8ef41b2a8b606fac08e2ba',
    asset: 'models/v0.3/deferi_6.dlid',
  },
  major_20: {
    name: 'major_20',
    kind: 'cld3-pack',
    format: 'cld3q',
    languages: ['de', 'nl', 'ja', 'ko', 'th', 'pt', 'vi', 'tr', 'zh', 'id', 'it', 'ru', 'ur', 'hi', 'bn', 'fr', 'ar', 'en', 'es', 'pl'],
    bytes: 110576,
    sha256: '03503bf3e896d64a7276eb23172669b253e9e62b5a0b2e7b9a8bd3a46d004a24',
    asset: 'models/cld3-pq-dno/major_20.cld3q',
  },
  full: {
    name: 'full',
    kind: 'cld3-pack',
    format: 'cld3q',
    languages: ['eo', 'co', 'eu', 'ta', 'de', 'mt', 'ps', 'te', 'su', 'uz', 'zh-Latn', 'ne', 'nl', 'sw', 'sq', 'hmn', 'ja', 'no', 'mn', 'so', 'ko', 'kk', 'sl', 'ig', 'mr', 'th', 'zu', 'ml', 'hr', 'bs', 'lo', 'sd', 'cy', 'hy', 'uk', 'pt', 'lv', 'he', 'cs', 'vi', 'jv', 'be', 'km', 'mk', 'tr', 'fy', 'am', 'zh', 'da', 'sv', 'fi', 'ht', 'af', 'la', 'id', 'tl', 'sm', 'ca', 'el', 'ka', 'sr', 'it', 'sk', 'ru', 'ru-Latn', 'bg', 'ny', 'fa', 'haw', 'gl', 'et', 'ms', 'gd', 'bg-Latn', 'ha', 'is', 'ur', 'mi', 'hi', 'bn', 'hi-Latn', 'fr', 'yi', 'hu', 'xh', 'my', 'tg', 'ro', 'ar', 'lb', 'el-Latn', 'st', 'ceb', 'kn', 'az', 'si', 'ky', 'mg', 'en', 'gu', 'es', 'pl', 'ja-Latn', 'ga', 'lt', 'sn', 'yo', 'pa', 'ku'],
    bytes: 130548,
    sha256: '1c468715f981034d1bde0fc0191f6fc357dca36944e2aaf6853a76e23c43339f',
    asset: 'models/cld3-pq-dno/full.cld3q',
  },
};

/** Pack names in registry order. */
export const PACK_NAMES = Object.keys(PACKS) as PackName[];
