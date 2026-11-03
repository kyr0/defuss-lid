/**
 * Website e2e (docs/index.html): every section and interactive element, in Chromium, Firefox and WebKit.
 *
 * The page fixture (fixtures.mjs) answers the pinned Hugging Face model URLs from models/ and fails a test on any
 * console error, page error, failed request or HTTP >= 400, so every test here also proves the page loads cleanly.
 * Facts on the page are checked against their sources, not against copies: pack bytes and labels against the runtime
 * registry the page itself ships (assets/lib/dist/packs/index.js) and models.lock.json, the accuracy figures against
 * documentation/results-v0.3.md, documentation/results-dno-pq.md and documentation/results-fasttext-dno-pq.md. scripts/verify.mjs separately checks every generated block against a recomputation.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {lockedFiles} from '../scripts/lock.mjs';
import {CDN_BASE, HF_BASE, expect, repoRoot, test} from './fixtures.mjs';

const report = ['results-v0.3.md', 'results-dno-pq.md', 'results-fasttext-dno-pq.md'].map(name => readFileSync(join(repoRoot, 'documentation', name), 'utf8')).join('\n');
const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
const locked = lockedFiles(JSON.parse(readFileSync(join(repoRoot, 'models.lock.json'), 'utf8')));
const html = readFileSync(join(repoRoot, 'docs/index.html'), 'utf8');

/** The snippet contract shared with the README runner: [data-snippet tags, first line], in page order. */
const SNIPPETS = [
  ['install', 'npm install defuss-lid'],
  ['install', 'bun add defuss-lid'],
  ['node', "import {load} from 'defuss-lid/packs/der_3';"],
  ['bun', "import {load} from 'defuss-lid/packs/der_3';"],
  ['browser', "import {load} from 'defuss-lid/packs/der_3';"],
  ['browser', '<script type="module">'],
  ['node bun browser', "import {load} from 'defuss-lid/packs/full';"],
  ['node bun browser', "import {load} from 'defuss-lid/packs/deferi_6';"],
  ['node bun browser', "import {load} from 'defuss-lid/packs/major_20';"],
];
const TAGS = new Set(['node', 'bun', 'browser', 'install', 'run', 'cli']);

/** Each demo model, a sample only it (or it best) identifies, and the label count its file declares. */
const DEMO = [
  {model: 'der_3', sample: 'de', expected: 'de', labels: 3},
  {model: 'deferi_6', sample: 'fr', expected: 'fr', labels: 6},
  {model: 'major_20', sample: 'ja', expected: 'ja', labels: 20, cld3: true},
  {model: 'full', sample: 'ko', expected: 'ko', labels: 109, cld3: true},
];

const decode = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

async function open(page) {
  await page.goto('/docs/');
  await expect(page.locator('#demo-status')).toHaveText('Ready');
}

test.beforeEach(async ({page}) => {
  await page.emulateMedia({colorScheme: 'light', reducedMotion: 'reduce'});
});

test('header: brand, nav anchors, external links', async ({page}) => {
  await open(page);
  const links = page.locator('nav[aria-label="Main"] a');
  await expect(links).toHaveText(['Demo', 'Packs', 'How it works', 'Accuracy', 'Use it']);
  for (const href of await links.evaluateAll(items => items.map(item => item.getAttribute('href')))) {
    await expect(page.locator(href), `${href} exists once`).toHaveCount(1);
  }
  await links.filter({hasText: 'Accuracy'}).click();
  await expect(page).toHaveURL(/#accuracy$/);
  await expect(page.locator('#accuracy-title')).toBeInViewport();
  await expect(page.locator('header a[href="https://github.com/kyr0/defuss-lid"]').first()).toBeVisible();
  await expect(page.locator('header a[href="https://huggingface.co/kyr0/defuss-lid-1.0"]').first()).toBeVisible();
  await expect(page.locator('header a[href="https://www.npmjs.com/package/defuss-lid"]').first()).toBeVisible();
  await page.locator('.mk-header-brand').click();
  await expect(page).toHaveURL(/#top$/);
});

test('hero: claim, runtimes and calls to action', async ({page}) => {
  await open(page);
  await expect(page.locator('h1')).toHaveText('Extremely lightweight language identification');
  await expect(page.locator('.lid-runtimes li')).toHaveText(['Node.js', 'Bun', 'Browsers']);
  // The band and the note are generated (scripts/sizes.mjs, checked by verify.mjs); here they must agree with the
  // major_20 card and accuracy row of the same page, which the packs and accuracy tests check against their sources.
  const stats = page.locator('.lid-band .mk-stat-value');
  await expect(stats).toHaveCount(4);
  await expect(stats.nth(0)).toHaveText(/^\d+\.\d\u00a0kB$/);
  const first20 = await page.locator('#accuracy-table tr[data-pack="major_20"] [data-cell]').nth(5).textContent();
  await expect(stats.nth(1)).toHaveText(`${first20}%`);
  await expect(stats.nth(3)).toHaveText('0');
  const allIn = await page.locator('#packs [data-pack="major_20"] .lid-budget tbody tr').first().locator('td').first().textContent();
  await expect(page.locator('.lid-hero-note')).toContainText(`${allIn.replace(' (better)', '').replace(' ', '\u00a0')} gzipped with its WebAssembly runtime`);
  await page.getByRole('link', {name: 'Try the live demo'}).click();
  await expect(page.locator('#demo-title')).toBeInViewport();
  await expect(page.getByRole('link', {name: 'Use it in your app'})).toHaveAttribute('href', '#use');
  await page.locator('.mk-hero-pill').click();
  await expect(page.locator('#boost')).toBeInViewport();
});

test('theme toggle switches dark mode and persists across reloads', async ({page}) => {
  await open(page);
  const root = page.locator('html');
  const toggle = page.locator('#theme-toggle');
  await expect(root).not.toHaveClass(/\bdark\b/);
  await toggle.check();
  await expect(root).toHaveClass(/\bdark\b/);
  await page.reload();
  // the inline head script applies the saved choice before first paint
  await expect(root).toHaveClass(/\bdark\b/);
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(root).not.toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(root).not.toHaveClass(/\bdark\b/);
  await expect(toggle).not.toBeChecked();
});

test('demo: opens with major_20, one sample per major_20 language, each identified as itself', async ({page}) => {
  await open(page);
  const rows = page.locator('#demo-results li');
  const registry = await page.evaluate(async () => (await import(new URL('assets/lib/dist/packs/index.js', document.baseURI).href)).PACKS);
  await expect(page.locator('#demo-model')).toHaveValue('major_20');
  await expect(page.locator('#demo-bytes')).toHaveText(`${(registry.major_20.bytes / 1000).toFixed(1)} kB`);
  const samples = page.locator('.lid-samples [data-sample]');
  const codes = await samples.evaluateAll(items => items.map(item => item.dataset.sample));
  expect([...codes].sort()).toEqual([...registry.major_20.languages].sort());
  for (const button of await samples.all()) {
    const code = await button.getAttribute('data-sample');
    await button.click();
    await expect(rows.first(), `${code} sample`).toHaveAttribute('data-language', code);
    await expect(rows.first().locator('.badge'), `${code} sample`).toHaveText('reliable');
  }
});

test('demo: every model loads and identifies its sample', async ({page}) => {
  await open(page);
  const status = page.locator('#demo-status');
  const rows = page.locator('#demo-results li');
  const registry = await page.evaluate(async () => (await import(new URL('assets/lib/dist/packs/index.js', document.baseURI).href)).PACKS);
  for (const {model, sample, expected, labels, cld3} of DEMO) {
    await page.selectOption('#demo-model', model);
    await expect(status, `${model} loads`).toHaveText('Ready');
    await expect(page.locator('#demo-bytes')).toHaveText(`${(registry[model].bytes / 1000).toFixed(1)} kB`);
    await expect(page.locator('#demo-labels')).toHaveText(String(labels));
    // the file link names the pinned release file the registry describes
    await expect(page.locator('#demo-file')).toHaveAttribute('href', locked[registry[model].asset].page);
    const button = page.locator(`[data-sample="${sample}"]`);
    await button.click();
    await expect(page.locator('#demo-text')).toHaveValue(await button.getAttribute('data-text'));
    await expect(rows.first(), `${model} on the ${sample} sample`).toHaveAttribute('data-language', expected);
    if (cld3) {
      await expect(rows).toHaveCount(1);
      await expect(rows.first().locator('.badge')).toHaveText(/reliable/);
    } else {
      await expect(rows).toHaveCount(3);
    }
    await expect(page.locator('#demo-time')).toHaveText(/ms$/);
    await expect(rows.first().locator('progress')).toHaveAttribute('aria-label', /^Score for /);
  }
});

test('demo: the letter boost re-ranks by alphabet and clears reliable', async ({page}) => {
  // the weight of the runtime copy the page loads
  const {CLD3_BOOST_WEIGHT} = await import(pathToFileURL(join(repoRoot, 'docs/assets/lib/dist/cld3-pack.js')).href);
  await open(page);
  const rows = page.locator('#demo-results li');
  const boost = page.locator('#demo-boost');
  // on by default, like the runtimes
  await expect(boost).toBeChecked();
  await page.selectOption('#demo-model', 'major_20');
  await expect(page.locator('#demo-status')).toHaveText('Ready');
  await page.locator('[data-sample="vi-start"]').click();
  await expect(rows.first()).toHaveAttribute('data-language', 'vi');
  await expect(rows.first().locator('.badge')).toHaveText('not reliable');
  // the substituted answer's score is CLD3's weight × the share of letters its alphabet explains (all of them)
  await expect(rows.first().locator('.lid-result-score')).toHaveText(CLD3_BOOST_WEIGHT.toFixed(3));
  await expect(rows.first().locator('progress')).toHaveAttribute('max', String(1 + CLD3_BOOST_WEIGHT));
  // CLD3 alone calls the two Vietnamese words Hindi; the letter check takes away its reliable flag
  await boost.uncheck();
  await expect(rows.first()).toHaveAttribute('data-language', 'hi');
  await expect(rows.first().locator('.badge')).toHaveText('not reliable');
  await boost.check();
  // fastText: boosted scores add up to 1 for letters that fit completely
  await page.selectOption('#demo-model', 'der_3');
  await expect(page.locator('#demo-status')).toHaveText('Ready');
  await page.locator('#demo-text').fill('гроза');
  await expect(rows.first()).toHaveAttribute('data-language', 'ru');
  expect(Number(await rows.first().locator('.lid-result-score').textContent())).toBeGreaterThan(1);
  await boost.uncheck();
  expect(Number(await rows.first().locator('.lid-result-score').textContent())).toBeLessThan(1);
  await expect(rows.first().locator('progress')).toHaveAttribute('max', '1');
});

test('demo: typing predicts (debounced), blank text abstains, samples fill the textarea', async ({page}) => {
  await open(page);
  const text = page.locator('#demo-text');
  const rows = page.locator('#demo-results li');
  await expect(rows.first()).toHaveAttribute('data-language', 'de');
  await text.fill('Доброе утро! Как у вас дела сегодня?');
  await expect(rows.first()).toHaveAttribute('data-language', 'ru');
  await text.fill('');
  await expect(rows).toHaveCount(0);
  await expect(page.locator('#demo-empty')).toBeVisible();
  for (const button of await page.locator('[data-sample]').all()) {
    await button.click();
    await expect(text).toHaveValue(await button.getAttribute('data-text'));
    await expect(rows.first()).toHaveAttribute('data-language', /^[a-z]{2,3}(-[A-Za-z]+)?$/);
  }
  // an allowlisted pack never answers "none of these": Ukrainian comes out as Russian in der_3
  await page.selectOption('#demo-model', 'der_3');
  await expect(page.locator('#demo-status')).toHaveText('Ready');
  await text.fill('Завтра вранці ми зустрінемося в кав’ярні біля вокзалу.');
  await expect(rows.first()).toHaveAttribute('data-language', 'ru');
  // the file link names the pinned revision of the pack's release (models.lock.json)
  await expect(page.locator('#demo-file')).toHaveAttribute('href', `${HF_BASE['kyr0/fastText-pq-dno'].replace('/resolve/', '/blob/')}der_3.dlid`);
});

test('packs: cards match the runtime registry and models.lock.json', async ({page}) => {
  await open(page);
  const registry = await page.evaluate(async () => (await import(new URL('assets/lib/dist/packs/index.js', document.baseURI).href)).PACKS);
  expect(Object.keys(registry).sort()).toEqual(['deferi_6', 'der_3', 'full', 'major_20']);
  for (const pack of Object.values(registry)) {
    const card = page.locator(`#packs [data-pack="${pack.name}"]`);
    await expect(card).toHaveAttribute('data-bytes', String(pack.bytes));
    await expect(card.locator('[data-bytes-label]')).toHaveText((pack.bytes / 1000).toFixed(1));
    await expect(card.locator('.badge').first()).toHaveText(pack.kind === 'fasttext' ? 'fastText' : 'CLD3');
    const shown = await card.locator('.lid-langs .badge').allTextContents();
    expect(shown.sort(), `${pack.name} languages`).toEqual([...pack.languages].sort());
    await expect(card.locator('.lid-import')).toHaveText(`defuss-lid/packs/${pack.name}`);
    expect(locked[pack.asset].bytes).toBe(pack.bytes);
  }
  await expect(page.locator('#packs .lid-pack')).toHaveCount(4);
  // the budget table adds up: all-in = pack + runtime, in both columns, and each pair marks at most one side better
  for (const table of await page.locator('#packs .lid-budget').all()) {
    const kB = async (row, column) => Number((await table.locator(`tbody tr:nth-child(${row}) td:nth-of-type(${column})`).textContent()).replace(/ kB.*/, ''));
    await expect(table.locator('tbody tr').first().locator('th')).toHaveText('All-in, gzipped');
    // rows 2 to 4 are pack, runtime and all-in; each is rounded to 0.1 kB on its own, so the sum may be off by one step
    for (const column of [1, 2]) expect(Math.abs((await kB(4, column)) - (await kB(2, column)) - (await kB(3, column)))).toBeLessThan(0.11);
    for (const row of await table.locator('tbody tr').all()) expect(await row.locator('td[data-better]').count()).toBeLessThanOrEqual(1);
  }
  const all = page.locator('#packs [data-pack="full"] details');
  await expect(all.locator('.lid-langs')).toBeHidden();
  await all.locator('summary').click();
  await expect(all.locator('.lid-langs')).toBeVisible();
});

test('how it works: both paths, letter evidence, size reasons and limits', async ({page}) => {
  await open(page);
  await expect(page.locator('#how .lid-how-title')).toHaveText(['Letters as evidence', 'Why the packs are small', 'Honest limits']);
  // the letter-boost figures are the README's measured table, row by row
  const boostRows = page.locator('#boost-table tbody tr');
  await expect(boostRows).toHaveCount(4);
  for (const row of await boostRows.all()) {
    const cells = await row.locator('td').allTextContents();
    expect(readme, 'README letter-boost row').toContain(`| \`${await row.getAttribute('data-pack')}\` | ${cells.join(' | ')} |`);
  }
  await expect(page.locator('#how .mk-feature-title')).toHaveText(['fastText path', 'CLD3 path']);
  await expect(page.locator('#how .mk-feature').first().locator('.lid-steps li')).toHaveCount(5);
  await expect(page.locator('#how .mk-feature').nth(1).locator('.lid-steps li')).toHaveCount(4);
  await expect(page.locator('#how .mk-bento-tile h4')).toHaveText(['Output subsetting', 'PQ + int8', 'Feature pruning', 'Runtime once']);
  await expect(page.locator('#how .mk-feature-card-title')).toHaveText(['Size is not RAM', 'Pruning costs coverage', 'Short text is harder', 'Scores are not probabilities']);
  // every other percentage quoted in this section comes from the report
  const quoted = await page.locator('#how').evaluate(node => {
    const copy = node.cloneNode(true);
    copy.querySelector('#boost').remove();
    return copy.textContent.match(/\d+\.\d+%/g);
  });
  for (const value of quoted) {
    expect(report, value).toContain(value.slice(0, -1));
  }
});

test('accuracy and coverage: one row per shipped pack (report + registry), four coverage rings', async ({page}) => {
  await open(page);
  const registry = await page.evaluate(async () => (await import(new URL('assets/lib/dist/packs/index.js', document.baseURI).href)).PACKS);
  const rows = page.locator('#accuracy-table tbody tr');
  await expect(rows).toHaveCount(4);
  for (const row of await rows.all()) {
    const name = await row.getAttribute('data-pack');
    const [languages, method, packKB, , ...scores] = await row.locator('[data-cell]').allTextContents();
    expect(Number(languages)).toBe(registry[name].languages.length);
    expect(packKB).toBe((registry[name].bytes / 1000).toFixed(1));
    const set = {der_3: '3', deferi_6: '6', major_20: '20', full: 'full'}[name];
    expect(report, `${name} row of the report`).toContain(`| ${set} | ${method} | ${(registry[name].bytes / 1000).toFixed(2)} | ${scores.join(' | ')} |`);
  }
  // coverage block (generated by scripts/coverage.mjs, checked against the measurement by `make coverage`)
  const rings = page.locator('.lid-coverage [role="progressbar"]');
  await expect(rings).toHaveCount(4);
  for (const [i, label] of ['Lines', 'Branches', 'Functions', 'Statements'].entries()) {
    const ring = rings.nth(i);
    await expect(ring).toHaveAccessibleName(`${label} coverage`);
    const value = Number(await ring.getAttribute('aria-valuenow'));
    expect(value).toBeGreaterThanOrEqual(60);
    expect(value).toBeLessThanOrEqual(100);
    expect(Number((await ring.textContent()).replace('%', ''))).toBeCloseTo(value, 1);
  }
  expect(Number(await page.locator('.lid-coverage-note [data-fact="tests"]').textContent())).toBeGreaterThan(0);
  await expect(page.getByRole('link', {name: /Read the full v0\.3 report/})).toHaveAttribute('href', 'https://github.com/kyr0/defuss-lid/blob/main/documentation/results-v0.3.md');
  await expect(page.getByRole('link', {name: /Read the CLD3 DNO-PQ report/})).toHaveAttribute('href', 'https://github.com/kyr0/defuss-lid/blob/main/documentation/results-dno-pq.md');
  await expect(page.getByRole('link', {name: /Read the fastText DNO-PQ report/})).toHaveAttribute('href', 'https://github.com/kyr0/defuss-lid/blob/main/documentation/results-fasttext-dno-pq.md');
});

test('use it: snippet contract, tabs and copy buttons', async ({page, browserName, context}) => {
  await open(page);
  const blocks = page.locator('pre > code');
  const found = await blocks.evaluateAll(items => items.map(code => [code.dataset.snippet ?? null, code.textContent.split('\n')[0], code.className]));
  expect(found.map(([tags, first]) => [tags, first])).toEqual(SNIPPETS);
  for (const [tags, , className] of found) {
    for (const tag of tags.split(' ')) expect(TAGS.has(tag), `tag ${tag}`).toBe(true);
    expect(className).toMatch(/^language-(js|html|sh)$/);
  }
  // highlighting rewrites the DOM but must keep each block's text byte-identical to the markup the runner reads
  const source = [...html.matchAll(/<code class="language-[a-z]+" data-snippet="[^"]+">([\s\S]*?)<\/code>/g)].map(match => decode(match[1]));
  expect(await blocks.allTextContents()).toEqual(source);
  for (const code of source) {
    for (const line of code.split('\n').filter(item => item.trimStart().startsWith('console.log('))) {
      expect(line, 'every console.log states its exact output').toMatch(/^console\.log\(.+\); \/\/ \S.*$/);
    }
  }
  expect(source.join('\n')).toContain(`${CDN_BASE}dist/index.js`);
  expect(source.join('\n')).toContain(`${HF_BASE['kyr0/fastText-pq-dno']}der_3.dlid`);

  // runtime tabs (defuss-shadcn Tabs)
  for (const [tab, panel] of [['Bun', '#use-bun'], ['Bundler', '#use-bundler'], ['No build', '#use-cdn'], ['Node.js', '#use-node']]) {
    const trigger = page.getByRole('tab', {name: tab, exact: true});
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator(panel)).toBeVisible();
    await expect(page.locator('#use .tab-content:visible')).toHaveCount(1);
  }
  // package-manager radio tabs of the install block (CSS only)
  const install = page.locator('#use .mk-code-block').first();
  await expect(install.locator('pre[data-tab="npm"]')).toBeVisible();
  await install.getByText('bun', {exact: true}).click();
  await expect(install.locator('pre[data-tab="bun"]')).toBeVisible();
  await expect(install.locator('pre[data-tab="npm"]')).toBeHidden();

  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await install.locator('.mk-code-block-copy').click();
  await expect(install.locator('.mk-code-block-status')).toHaveText(/Copied|Copy failed/);
  if (browserName === 'chromium') expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('bun add defuss-lid');
  await expect(page.locator('#use table.lid-api tbody tr')).toHaveCount(7);
});

test('footer: licenses, links and author', async ({page}) => {
  await open(page);
  const footer = page.locator('footer.mk-footer');
  for (const href of [
    'https://github.com/kyr0/defuss-lid',
    'https://huggingface.co/kyr0/defuss-lid-1.0',
    'https://huggingface.co/kyr0/fastText-pq-dno',
    'https://huggingface.co/kyr0/cld3-pq-dno',
    'https://www.npmjs.com/package/defuss-lid',
    'https://github.com/kyr0/defuss-lid/tree/main/documentation',
    'https://github.com/kyr0/defuss-lid/blob/main/NOTICE.md',
  ]) await expect(footer.locator(`a[href="${href}"]`), href).toHaveCount(1);
  await expect(footer).toContainText('Code: MIT');
  await expect(footer).toContainText('fastText-derived weights: CC BY-SA 3.0');
  await expect(footer).toContainText('CLD3 weights: Apache-2.0');
  await expect(footer).toContainText('© 2026 Aron Homberg');
  // The consulting card: portrait loaded (not a broken image) and the LinkedIn link.
  const card = footer.locator('aside.lid-ad');
  await expect(card).toContainText('Aron Homberg');
  await expect(card.locator('a[href="https://www.linkedin.com/in/aronhomberg/"]')).toHaveText(/Connect on LinkedIn/);
  const portrait = card.locator('img');
  await portrait.scrollIntoViewIfNeeded();
  await expect.poll(() => portrait.evaluate(img => img.complete && img.naturalWidth)).toBe(400);
});

test('phone width (390px): no horizontal overflow in light and dark, menu sheet navigates', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await open(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBe(0);
  await page.locator('#theme-toggle').check();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect(await overflow()).toBe(0);
  // the sections keep a 16px gutter on phones
  const box = await page.locator('#demo .lid-demo').boundingBox();
  expect(Math.round(box.x)).toBe(16);
  expect(Math.round(390 - box.x - box.width)).toBe(16);

  await page.getByRole('button', {name: 'Open menu'}).click();
  const sheet = page.locator('#lid-menu');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('link', {name: /^Packs/}).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/#packs$/);
  await expect(page.locator('#packs-title')).toBeInViewport();
});

test('requests stay on this site, jsDelivr and Hugging Face', async ({page, baseURL}) => {
  const origins = new Set();
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol !== 'data:') origins.add(url.origin);
  });
  await open(page);
  await page.selectOption('#demo-model', 'full');
  await expect(page.locator('#demo-status')).toHaveText('Ready');
  expect([...origins].sort()).toEqual([new URL(baseURL).origin, 'https://cdn.jsdelivr.net', 'https://huggingface.co'].sort());
});
