/**
 * Letter evidence for language identification: which candidate languages a text's letters fit.
 *
 * Both models read letters statistically, so a short text can come out in a language whose alphabet it does not even
 * use: the `major_20` CLD3 pack calls the Russian word "гроза" Portuguese with CLD3's `reliable` flag set. The writing
 * system is hard evidence the model may miss. {@link letterSupport} measures it with the table of `charsets.ts`, and
 * the runtimes use it twice: the `boost` option, on by default, adds `weight × support` to each candidate's model score before
 * ranking, and CLD3's `reliable` flag is cleared when another language of the table fits the letters better than the
 * predicted one.
 *
 * How a letter counts (text NFC-normalized and lowercased; one count per code point):
 * - a letter listed in the table supports exactly the languages whose line lists it (ß: de, bar, nds, pfl; ы: ru, be, kk…);
 * - an unlisted letter of a script the table uses supports every language that writes that script (ASCII letters:
 *   every Latin-script language; a rare Han character: zh, ja, yue, wuu);
 * - anything else (digits, punctuation, emoji, combining accents, scripts the table does not use) is ignored.
 *
 * Why shares and an additive boost instead of a probability model of letters: the support is the fraction of the
 * text's letters a language explains, so it is comparable between texts of any length and between scripts, and the
 * boost lifts all languages that share the evidence equally ("гроза" lifts every Cyrillic-script candidate), leaving
 * the model to decide among them. The model's ranking still decides between languages whose letters fit equally well.
 *
 * Why on by default: VERIFIED: weight 1 improved or kept the top-1 accuracy of all four packs on every v0.3 benchmark
 * slice (FLORES sentences, their first 20 code points, MASSIVE; `scripts/boost_eval.mjs`, 2026-11-02), and of both
 * DNO-PQ CLD3 packs on every slice of their model card (`kyr0/cld3-pq-dno`), two-word starts and NTREX news included
 * (2026-11-03). The default weights ({@link BOOST_WEIGHT} for fastText, {@link CLD3_BOOST_WEIGHT} for CLD3) were then
 * tuned on held-out selection text, never on a benchmark or test text.
 * `boost: false` gives the models' own scores.
 *
 * @module
 */
import {CHARSETS} from './charsets.js';

/**
 * Scripts a table line can declare, by Unicode Script property name. A language writes the scripts of the letters
 * its line lists, plus Latin when it lists Latin letters or no letter of any other script.
 */
const SCRIPTS = ['Latin', 'Cyrillic', 'Greek', 'Armenian', 'Georgian', 'Hebrew', 'Arabic', 'Thaana', 'Devanagari',
  'Bengali', 'Gurmukhi', 'Gujarati', 'Oriya', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Sinhala', 'Thai', 'Lao',
  'Tibetan', 'Myanmar', 'Khmer', 'Ethiopic', 'Hangul', 'Hiragana', 'Katakana', 'Han'] as const;
const LATIN = 0;
const SCRIPT_PATTERNS = SCRIPTS.map(name => new RegExp(`^\\p{Script=${name}}$`, 'u'));

interface Table {
  /** Map languages in table order. */
  languages: string[];
  /**
   * Language → its writing systems, each a list of script indexes. One system for most languages (Japanese: Han,
   * Hiragana and Katakana together); two for a language whose line lists Latin and another script (Serbian), because
   * a text uses one of them, not a mix: counting both would let Latin names in a Cyrillic text favour Serbian.
   */
  systems: Map<string, number[][]>;
  /** Listed letter → the languages that list it, and the letter's script (-1 for none, e.g. ʻ or ー). */
  listed: Map<string, {languages: string[]; script: number}>;
  /** Code point → script index, or -1 for none; filled lazily. */
  scriptCache: Map<string, number>;
}

let table: Table | undefined;

function scriptOf(char: string, cache: Map<string, number>): number {
  let script = cache.get(char);
  if (script === undefined) {
    script = SCRIPT_PATTERNS.findIndex(pattern => pattern.test(char));
    cache.set(char, script);
  }
  return script;
}

/** Parse `charsets.ts` once, on first use, so importing a runtime costs nothing until the evidence is asked for. */
function getTable(): Table {
  if (table) return table;
  const scriptCache = new Map<string, number>();
  const languages: string[] = [], systems = new Map<string, number[][]>(), listed: Table['listed'] = new Map();
  for (const line of CHARSETS.split('\n')) {
    const [language = '', letters = ''] = line.split(' ');
    if (!language) continue;
    const own = new Set<number>();
    for (const char of letters) {
      const script = scriptOf(char, scriptCache);
      const entry = listed.get(char);
      if (entry) entry.languages.push(language);
      else listed.set(char, {languages: [language], script});
      if (script >= 0) own.add(script);
    }
    const other = [...own].filter(script => script !== LATIN);
    languages.push(language);
    systems.set(language, !other.length ? [[LATIN]] : own.has(LATIN) ? [other, [LATIN]] : [other]);
  }
  table = {languages, systems, listed, scriptCache};
  return table;
}

/** Letter counts of one text: per language and script for listed letters, per script for unlisted ones. */
interface Evidence {
  total: number;
  /** Language → script index (or -1) → count of listed letters. */
  listed: Map<string, Map<number, number>>;
  unlisted: Float64Array;
}

function evidence(text: string): Evidence {
  const t = getTable(), listed: Evidence['listed'] = new Map(), unlisted = new Float64Array(SCRIPTS.length);
  let total = 0;
  for (const char of text.normalize('NFC').toLowerCase()) {
    const entry = t.listed.get(char);
    if (entry) {
      total++;
      for (const language of entry.languages) {
        let counts = listed.get(language);
        if (!counts) listed.set(language, counts = new Map());
        counts.set(entry.script, (counts.get(entry.script) ?? 0) + 1);
      }
      continue;
    }
    const script = scriptOf(char, t.scriptCache);
    if (script >= 0) {
      total++;
      unlisted[script]!++;
    }
  }
  return {total, listed, unlisted};
}

/** Support of one language: its best-fitting writing system's letters over all counted letters. */
function share(e: Evidence, language: string): number {
  const systems = getTable().systems.get(language);
  if (!systems || !e.total) return 0;
  const counts = e.listed.get(language);
  let best = 0;
  for (const scripts of systems) {
    // Listed letters without a script (ʻ, ー) belong to every system of the language that lists them.
    let hits = counts?.get(-1) ?? 0;
    for (const script of scripts) hits += (counts?.get(script) ?? 0) + e.unlisted[script]!;
    best = Math.max(best, hits);
  }
  return best / e.total;
}

/**
 * The share of `text`'s letters, in [0, 1], that each language's writing system explains, by the rules of the
 * module documentation. Languages without a table line get 0; so does every language when the text has no letters.
 *
 * @example letterSupport('гроза', ['ru', 'uk', 'pt']) // Map {ru → 1, uk → 1, pt → 0}
 */
export function letterSupport(text: string, languages: readonly string[]): Map<string, number> {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const e = evidence(text);
  return new Map(languages.map(language => [language, share(e, language)]));
}

/**
 * Default boost weight of the fastText runtime; `boost: true` uses it. At 1, letters that fit a language completely
 * count as much as the model's whole probability range, so a language whose alphabet explains the text outranks one
 * whose alphabet does not, while the model still ranks languages whose letters fit almost equally well.
 *
 * VERIFIED: on the selection split of the DNO-PQ work (34,914 and 68,883 held-out texts, all lengths; Wikinews
 * included; `dnp-tools/boost/tune.mjs`, 2026-11-03) weight 1 was the best tried or within noise of it for the `der_3`
 * pack (96.58%; 2 lost 10 texts net, p = 0.02) and both fastText DNO-PQ packs (98.29% and 94.33%; 0.25 to 4 within
 * noise, 10 significantly lower). Only the `deferi_6` pack gained from more (90.38% at 1, 90.49% at 10).
 */
export const BOOST_WEIGHT = 1;

/**
 * Default boost weight of the CLD3 runtimes (packs and the npm provider); `boost: true` uses it. CLD3 returns only
 * its top language, so the boost can only keep that answer or replace it with a language whose letters fit better;
 * at 20 a language replaces the answer only when its letter share exceeds the answer's by more than the answer's
 * score / 20 (at most 5 points).
 *
 * VERIFIED: on the selection split (corpora.py selection rows of each pack's labels, 106,753 texts for `major_20`,
 * 400,481 for `full`; `dnp-tools/boost/tune.mjs`, 2026-11-03) accuracy rose with the weight up to 20 and then stayed
 * flat: `major_20` 94.38% at 1, 94.57% at 20 (209 texts fixed, 2 broken); `full` 82.16% at 1, 82.54% at 20 (1,513
 * fixed, 12 broken), with no language losing significantly; from 50 on Hindi lost 7 texts. The v0.3 CLD3 files for
 * 3 and 6 languages gained too (57 fixed and 1 broken; 410 fixed and 23 broken).
 */
export const CLD3_BOOST_WEIGHT = 20;

/**
 * The weight a `boost` option stands for: `fallback` (the runtime's default weight) when absent or `true`, 0 for
 * `false`, else the number.
 */
export function boostWeight(boost: boolean | number | undefined, fallback = BOOST_WEIGHT): number {
  if (boost === undefined || boost === true) return fallback;
  if (boost === false) return 0;
  if (typeof boost !== 'number' || !Number.isFinite(boost) || boost < 0) throw new RangeError('boost must be a boolean or a finite number >= 0');
  return boost;
}

/**
 * Whether no language of the table fits the letters better than `language`. Text without letters, and languages
 * without a table line, always fit: there is no evidence against them.
 */
function fits(e: Evidence, language: string): boolean {
  const t = getTable();
  if (!t.systems.has(language)) return true;
  const own = share(e, language);
  return t.languages.every(other => share(e, other) <= own);
}

/**
 * Letter check of a top-1 answer (CLD3 returns only its top language, so the other candidates have no model score).
 *
 * `reliable` survives only when the letters fit the answer (see {@link fits}). With a weight, the answer's score
 * becomes `score + weight × support`, and a candidate whose `weight × support` alone is higher replaces it, with
 * `reliable: false` because the model never ranked it. When several candidates share that highest score (Arabic
 * letters fit both `ar` and `ur`), nothing ranks them: the first in label order replaces the answer only if the
 * answer's writing system explains none of the letters, since any of them is then a better guess; otherwise the
 * model's answer stays.
 *
 * VERIFIED: at weight 1 on FLORES-200 dev, this rule scored at least as high as ties always replacing the answer and
 * higher than ties never replacing it (`major_20`, 8-code-point prefixes: 76.91%, 76.91%, 76.16%; 20: 92.15%, 92.13%,
 * 92.07%). At weight 10 always replacing scored higher for `full` (54.74% against 54.25%) and lower for `major_20`
 * (78.26% against 78.34%), 2026-11-02.
 */
export function checkTop1(text: string, candidates: readonly string[], top: {language: string; score: number; reliable: boolean},
  weight: number): {language: string; score: number; reliable: boolean} {
  const e = evidence(text), own = share(e, top.language);
  const result = {language: top.language, score: top.score + weight * own, reliable: top.reliable && fits(e, top.language)};
  if (!weight) return result;
  let best = result.score, winner: string | undefined, tied = false;
  for (const language of candidates) {
    const score = weight * share(e, language);
    if (score > best) [best, winner, tied] = [score, language, false];
    else if (score === best && winner !== undefined) tied = true;
  }
  return winner !== undefined && (!tied || own === 0) ? {language: winner, score: best, reliable: false} : result;
}
