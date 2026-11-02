/**
 * Browser/Node.js agreement for every released model file and every pack loader.
 *
 * Why: the same TypeScript runs in V8, SpiderMonkey and JavaScriptCore, whose Math.exp/Math.log may differ in the last
 * bit, and the CLD3 path depends on each engine's WebAssembly, Web Crypto and DecompressionStream. scripts/e2e.mjs
 * computes reference predictions with the installed package on Node.js (parity.json); here each engine loads the same
 * files over HTTP through the installed package's browser entry points and must return the same labels with scores
 * within 1e-9.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect, test} from './fixtures.mjs';

test.skip(!process.env.E2E_ROOT, 'parity runs through scripts/e2e.mjs (make e2e)');
const reference = process.env.E2E_ROOT ? JSON.parse(readFileSync(join(process.env.E2E_ROOT, 'parity.json'), 'utf8')) : {expected: {}};
const PKG = '/consumer/node_modules/defuss-lid';

function compare(actual, expected, label) {
  expect(actual.length, label).toBe(expected.length);
  actual.forEach((ranked, i) => {
    expect(ranked.map(p => p.language), `${label} text ${i}`).toEqual(expected[i].map(p => p.language));
    ranked.forEach((p, j) => expect(Math.abs(p.score - expected[i][j].score), `${label} text ${i}`).toBeLessThanOrEqual(1e-9));
  });
}

test('every released model predicts like Node.js', async ({page}) => {
  test.setTimeout(180_000);
  await page.goto('/snippets/manifest.json');
  for (const [file, expected] of Object.entries(reference.expected)) {
    const actual = await page.evaluate(async ({file, texts, PKG}) => {
      const cld3 = file.endsWith('.cld3q');
      const {loadModel} = await import(`${PKG}/dist/index.js`);
      const {loadCld3Pack} = await import(`${PKG}/dist/cld3-pack.js`);
      const model = cld3 ? await loadCld3Pack(`${PKG}/models/v0.3/${file}`) : await loadModel(`${PKG}/models/v0.3/${file}`);
      try {
        return texts.map(text => model.predict(text, {k: cld3 ? 1 : 3}));
      } finally {
        model.dispose?.();
      }
    }, {file, texts: reference.texts, PKG});
    compare(actual, expected, file);
  }
});

test('the four browser pack loaders fetch their asset and predict like Node.js', async ({page}) => {
  await page.goto('/snippets/manifest.json');
  for (const name of ['der_3', 'deferi_6', 'major_20', 'full']) {
    const actual = await page.evaluate(async ({name, texts, PKG}) => {
      const pack = await import(`${PKG}/dist/packs/${name}.browser.js`);
      const model = await pack.load();
      try {
        return {labels: pack.labels, url: pack.url.href, predictions: texts.map(text => model.predict(text, {k: pack.meta.kind === 'fasttext' ? 3 : 1}))};
      } finally {
        model.dispose?.();
      }
    }, {name, texts: reference.texts, PKG});
    expect(actual.url).toContain(`${PKG}/models/v0.3/${name}.`);
    compare(actual.predictions, reference.expected[`${name}.${actual.url.endsWith('.dlid') ? 'dlid' : 'cld3q'}`], name);
  }
});
