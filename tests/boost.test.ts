import {describe, expect, test} from 'vitest';
import {CHARSETS} from '../src/charsets.js';
import {loadCld3} from '../src/cld3.js';
import {BOOST_WEIGHT, letterSupport} from '../src/index.js';
import * as der from '../src/packs/der_3.node.js';
import * as major from '../src/packs/major_20.node.js';

const CYRILLIC = ['ru', 'uk', 'be', 'bg', 'mk', 'sr', 'kk', 'ky', 'tg', 'mn'];
/** fastText lid.176 labels, the inventory the table must cover (plus CLD3's extra labels). */
const LID176 = 'af als am an ar arz as ast av az azb ba bar bcl be bg bh bn bo bpy br bs bxr ca cbk ce ceb ckb co cs cv cy da de diq dsb dty dv el eml en eo es et eu fa fi fr frr fy ga gd gl gn gom gu gv he hi hif hr hsb ht hu hy ia id ie ilo io is it ja jbo jv ka kk km kn ko krc ku kv kw ky la lb lez li lmo lo lrc lt lv mai mg mhr min mk ml mn mr mrj ms mt mwl my myv mzn nah nap nds ne new nl nn no oc or os pa pam pfl pl pms pnb ps pt qu rm ro ru rue sa sah sc scn sco sd sh si sk sl so sq sr su sv sw ta te tg th tk tl tr tt tyv ug uk ur uz vec vep vi vls vo wa war wuu xal xmf yi yo yue zh'.split(' ');

describe('letter table', () => {
  test('has one line per lid.176 and CLD3 label, letters lowercase NFC and unique', async () => {
    const {CLD3_LAYOUT} = await import('../runtime/cld3-layout.js');
    const lines = CHARSETS.trim().split('\n').map(line => line.split(' '));
    const codes = lines.map(([code]) => code!);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(codes)).toEqual(new Set([...LID176, ...CLD3_LAYOUT.labels]));
    for (const [code, letters = ''] of lines) {
      expect(letters, code).toBe(letters.normalize('NFC').toLowerCase());
      expect(new Set(letters).size, code).toBe([...letters].length);
    }
  });
});

describe('letterSupport', () => {
  test('Cyrillic letters support every Cyrillic-script language alike, and no Latin one', () => {
    const support = letterSupport('гроза', [...CYRILLIC, 'pt', 'en', 'de']);
    for (const language of CYRILLIC) expect(support.get(language), language).toBe(1);
    for (const language of ['pt', 'en', 'de']) expect(support.get(language), language).toBe(0);
  });

  test('a listed letter supports only the languages that list it', () => {
    expect(letterSupport('Straße', ['de', 'en', 'tr'])).toEqual(new Map([['de', 1], ['en', 5 / 6], ['tr', 5 / 6]]));
    // ї is Ukrainian, ы Russian (and Belarusian), not the other way round.
    expect(letterSupport('їжак', ['uk', 'ru'])).toEqual(new Map([['uk', 1], ['ru', 0.75]]));
    expect(letterSupport('ты', ['ru', 'uk', 'be'])).toEqual(new Map([['ru', 1], ['uk', 0.5], ['be', 1]]));
  });

  test('a language written in Latin or another script counts the better-fitting one, not both', () => {
    // Serbian lists Cyrillic and Latin letters; Latin names in Russian text must not make it fit better than Russian.
    const support = letterSupport('Компания Apple', ['ru', 'sr']);
    expect(support.get('ru')).toBe(8 / 13);
    expect(support.get('sr')).toBe(7 / 13);
  });

  test('Japanese counts kana and Han together', () => {
    const support = letterSupport('これは日本語です', ['ja', 'zh', 'ko']);
    expect(support.get('ja')).toBe(1);
    expect(support.get('zh')).toBe(3 / 8);
    expect(support.get('ko')).toBe(0);
  });

  test('normalizes case and composition, ignores non-letters and unknown languages', () => {
    expect(letterSupport('GRÜSSE', ['de', 'en']).get('de')).toBe(1);
    expect(letterSupport('Grüsse', ['de', 'en'])).toEqual(letterSupport('Grüsse', ['de', 'en']));
    expect(letterSupport('123 !? 🙂', ['de', 'en'])).toEqual(new Map([['de', 0], ['en', 0]]));
    expect(letterSupport('Haus', ['xx']).get('xx')).toBe(0);
    expect(() => letterSupport(1 as unknown as string, ['de'])).toThrow(TypeError);
  });
});

describe('fastText boost', () => {
  test('adds weight × support to every label before ranking', async () => {
    const model = await der.load();
    // der_3 ranks this German prefix as Russian; its letters fit only the Latin-script labels.
    expect(model.predict('Etwa zeh')[0]!.language).toBe('ru');
    const raw = new Map(model.predict('Etwa zeh', {k: 3}).map(p => [p.language, p.score]));
    const support = letterSupport('Etwa zeh', model.meta.labels);
    for (const boost of [true, 2]) {
      const weight = boost === true ? BOOST_WEIGHT : boost;
      const boosted = model.predict('Etwa zeh', {k: 3, boost});
      expect(boosted[0]!.language).toBe('de');
      for (const p of boosted) expect(p.score).toBeCloseTo(raw.get(p.language)! + weight * support.get(p.language)!, 12);
    }
    expect(model.predict('Etwa zeh', {boost: false})).toEqual(model.predict('Etwa zeh'));
    expect(model.predict('Etwa zeh', {boost: 0})).toEqual(model.predict('Etwa zeh'));
  });

  test('threshold applies to the boosted score; invalid weights throw', async () => {
    const model = await der.load();
    expect(model.predict('Etwa zeh', {threshold: 0.9})).toEqual([]);
    expect(model.predict('Etwa zeh', {threshold: 0.9, boost: true})[0]!.language).toBe('de');
    for (const boost of [-1, Number.NaN, Number.POSITIVE_INFINITY, '1']) {
      expect(() => model.predict('Etwa zeh', {boost: boost as number})).toThrow(RangeError);
    }
  });
});

describe('CLD3 letter check', () => {
  test('reliable is cleared when the letters do not fit the answer (major_20: "гроза" is not Portuguese)', async () => {
    const pack = await major.load();
    try {
      expect(pack.predict('гроза')).toEqual([{language: 'pt', score: expect.any(Number), reliable: false}]);
      expect(pack.predict('Das ist ein deutscher Satz.')[0]).toMatchObject({language: 'de', reliable: true});
      expect(pack.predict('Das ist ein deutscher Satz.', {boost: true})[0]).toMatchObject({language: 'de', reliable: true});
    } finally {
      pack.dispose();
    }
  });

  test('boost replaces an answer whose alphabet the text does not use', async () => {
    const pack = await major.load();
    try {
      expect(pack.predict('гроза', {boost: true})).toEqual([{language: 'ru', score: BOOST_WEIGHT, reliable: false}]);
      expect(pack.predict('Москва', {boost: 3})).toEqual([{language: 'ru', score: 3, reliable: false}]);
      // The answer's own support is added to its score.
      const [plain] = pack.predict('Das ist ein Haus.'), [boosted] = pack.predict('Das ist ein Haus.', {boost: true});
      expect(boosted!.score).toBeCloseTo(plain!.score + 1, 6);
      expect(pack.predict('гроза', {boost: true, threshold: 1})).toHaveLength(1);
      expect(() => pack.predict('гроза', {boost: -1})).toThrow(RangeError);
    } finally {
      pack.dispose();
    }
  });

  test('tied candidates replace the answer only when it explains none of the letters', async () => {
    const pack = await major.load();
    try {
      // Arabic letters fit ar and ur alike; Japanese explains none of them.
      expect(pack.predict('وثائق ب')[0]!.language).toBe('ja');
      const [arabic] = pack.predict('وثائق ب', {boost: true});
      expect(['ar', 'ur']).toContain(arabic!.language);
      expect(arabic!.reliable).toBe(false);
      // Latin letters fit 11 candidates alike, but the kana fit only Japanese: the model's answer stays.
      expect(pack.predict('eBayやCraigsl', {boost: true})[0]!.language).toBe('ja');
    } finally {
      pack.dispose();
    }
  });

  test('the npm provider applies the same check', async () => {
    const provider = await loadCld3();
    try {
      expect(provider.predict('гроза')[0]).toMatchObject({language: 'mk', reliable: true});
      // CLD3 calls "Grüße" Kurdish; ü and ß fit German better, so the answer is not reliable.
      expect(provider.predict('Grüße')[0]).toMatchObject({language: 'ku', reliable: false});
      expect(provider.predict('гроза', {boost: true})[0]!.language).toBe('mk');
      expect(() => provider.predict('гроза', {boost: -1})).toThrow(RangeError);
    } finally {
      provider.dispose();
    }
  });
});
