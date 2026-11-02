/**
 * Every browser example of README.md, documentation/ and the website, run as a page in each engine.
 *
 * scripts/e2e.mjs writes one page per example (an import map resolves bare `defuss-lid/...` specifiers to the installed
 * tarball's browser entry points, as a bundler would) and a manifest with the output each example states. The test
 * waits for that many console lines and compares them exactly; the fixture fails it on any error or failed request.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect, test} from './fixtures.mjs';

const manifest = process.env.E2E_ROOT
  ? JSON.parse(readFileSync(join(process.env.E2E_ROOT, 'snippets/manifest.json'), 'utf8'))
  : [];

test.skip(!process.env.E2E_ROOT, 'browser examples run through scripts/e2e.mjs (make e2e)');

for (const example of manifest) {
  test(`example ${example.source}`, async ({page}) => {
    const printed = [];
    page.on('console', message => {
      if (message.type() === 'log') printed.push(message.text());
    });
    await page.goto(`/snippets/${example.id}.html`);
    await expect.poll(() => printed.length, {timeout: 20_000}).toBeGreaterThanOrEqual(example.expected.length);
    expect(printed).toEqual(example.expected);
  });
}
