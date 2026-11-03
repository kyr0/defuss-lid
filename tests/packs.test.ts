import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';
import * as deferiBrowser from '../src/packs/deferi_6.browser.js';
import * as deferi from '../src/packs/deferi_6.node.js';
import * as derBrowser from '../src/packs/der_3.browser.js';
import * as der from '../src/packs/der_3.node.js';
import * as fullBrowser from '../src/packs/full.browser.js';
import * as full from '../src/packs/full.node.js';
import {PACK_NAMES, PACKS} from '../src/packs/index.js';
import * as majorBrowser from '../src/packs/major_20.browser.js';
import * as major from '../src/packs/major_20.node.js';
import {read} from './helpers/dlid.js';

type Release = {target: string; files: Record<string, {bytes: number; sha256: string}>};
const {releases}: {releases: Release[]} = JSON.parse(readFileSync(new URL('../models.lock.json', import.meta.url), 'utf8'));
/** Package path (`models/<release>/<file>`) → locked bytes and SHA-256. */
const locked = Object.fromEntries(releases.flatMap(r => Object.entries(r.files).map(([path, file]) => [`${r.target}/${path}`, file])));

describe('pack registry', () => {
  test('lists the four packs and agrees with models.lock.json and the files', () => {
    expect(PACK_NAMES).toEqual(['der_3', 'deferi_6', 'major_20', 'full']);
    for (const meta of Object.values(PACKS)) {
      expect(locked[meta.asset], meta.asset).toEqual({bytes: meta.bytes, sha256: meta.sha256});
      const bytes = read(meta.asset);
      expect(bytes.length).toBe(meta.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(meta.sha256);
    }
  });

  test('node and browser loaders point at the registry asset', () => {
    for (const [mod, browser] of [[der, derBrowser], [deferi, deferiBrowser], [major, majorBrowser], [full, fullBrowser]] as const) {
      expect(mod.url.href.endsWith(mod.meta.asset), mod.meta.name).toBe(true);
      expect(browser.url.href).toBe(mod.url.href);
      expect(browser.labels).toBe(mod.meta.languages);
    }
  });
});

describe('pack loaders (Node/Bun disk variants)', () => {
  test('der_3 and deferi_6 predict their languages', async () => {
    const three = await der.load();
    expect(three.meta.labels).toEqual(der.labels);
    expect(three.predict('Guten Morgen!')[0]!.language).toBe('de');
    expect(three.predict('Hello, how are you today?')[0]!.language).toBe('en');
    expect(three.predict('Как у тебя дела?')[0]!.language).toBe('ru');
    const six = await deferi.load({cacheSize: 0});
    expect(six.predict('Bonjour tout le monde.')[0]!.language).toBe('fr');
    expect(six.predict('Buenos días, ¿cómo estás?')[0]!.language).toBe('es');
    expect(six.predict('Buongiorno, come stai?')[0]!.language).toBe('it');
    expect(six.predict('Доброе утро!')[0]!.language).toBe('ru');
  });

  test('major_20 and full run CLD3 and dispose cleanly', async () => {
    const twenty = await major.load();
    try {
      expect(twenty.predict('Das ist ein deutscher Satz.')[0]!.language).toBe('de');
      expect(twenty.predict('これは日本語の文章です。')[0]!.language).toBe('ja');
      expect(twenty.predict('هذه جملة باللغة العربية.')[0]!.language).toBe('ar');
    } finally {
      twenty.dispose();
    }
    const every = await full.load({coreURL: new URL('../runtime/cld3-core.bin.gz', import.meta.url)});
    try {
      expect(every.predict('Bonjour tout le monde.')[0]!.language).toBe('fr');
      expect(every.predict('Gallia est omnis divisa in partes tres.')[0]!.language).toBe('la');
      expect(every.meta.labels).toHaveLength(109);
    } finally {
      every.dispose();
    }
  });
});
