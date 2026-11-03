/**
 * Shared Playwright fixtures.
 *
 * - Model URLs on the pinned Hugging Face revisions are answered from the local, hash-verified models/ files, and
 *   `cdn.jsdelivr.net/npm/defuss-lid@<version>/…` from the package under test. Why: the e2e suite must prove the code
 *   that is about to be published, before it exists on npm, and must not flake on third-party availability. The bytes
 *   are the same: models.lock.json pins the Hugging Face files by SHA-256 and `node scripts/fetch-models.mjs --live`
 *   (CI job "release-mirror") checks the remote copy. Set E2E_LIVE=1 to let model requests reach Hugging Face.
 * - Every page fails its test on a console error, an uncaught exception or a failed request, so a broken asset or a
 *   runtime exception cannot hide behind a passing assertion.
 *
 * VERIFIED: with E2E_LIVE=1 the site demo loaded every model from Hugging Face in all three engines (2026-11-02).
 */
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {extname, join, resolve} from 'node:path';
import {test as base, expect} from '@playwright/test';
import {lockedFiles} from '../scripts/lock.mjs';

export const repoRoot = resolve(import.meta.dirname, '..');
const lock = JSON.parse(readFileSync(join(repoRoot, 'models.lock.json'), 'utf8'));
/** Pinned Hugging Face URL → package path of the local copy. */
const byURL = new Map(Object.entries(lockedFiles(lock)).map(([path, file]) => [file.url, path]));
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

/** Root of the package under test: the installed tarball in e2e runs, else this checkout. */
export const packageRoot = process.env.E2E_ROOT
  ? resolve(process.env.E2E_ROOT, 'consumer/node_modules/defuss-lid')
  : repoRoot;
/** Base URL of each pinned release, by repository (`kyr0/defuss-lid-1.0`, `kyr0/fastText-pq-dno`, `kyr0/cld3-pq-dno`). */
export const HF_BASE = Object.fromEntries(lock.releases.map(r => [r.repository, `https://huggingface.co/${r.repository}/resolve/${r.revision}/`]));
export const CDN_BASE = `https://cdn.jsdelivr.net/npm/defuss-lid@${pkg.version}/`;

const TYPES = {'.js': 'text/javascript', '.json': 'application/json', '.gz': 'application/gzip'};

export const test = base.extend({
  page: async ({page}, use) => {
    const problems = [];
    page.on('console', message => {
      if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
    });
    page.on('pageerror', error => problems.push(`page error: ${error.message}`));
    page.on('requestfailed', request => problems.push(`request failed: ${request.url()} ${request.failure()?.errorText}`));
    page.on('response', response => {
      if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    if (!process.env.E2E_LIVE) {
      for (const base of Object.values(HF_BASE)) {
        await page.route(`${base}**`, async route => {
          const path = byURL.get(decodeURIComponent(route.request().url().split('?')[0]));
          if (!path) return route.fulfill({status: 404, body: 'not in models.lock.json'});
          await route.fulfill({
            status: 200,
            contentType: 'application/octet-stream',
            headers: {'Access-Control-Allow-Origin': '*'},
            body: await readFile(join(repoRoot, path)),
          });
        });
      }
    }
    await page.route(`${CDN_BASE}**`, async route => {
      const path = decodeURIComponent(route.request().url().slice(CDN_BASE.length).split('?')[0]);
      try {
        await route.fulfill({
          status: 200,
          contentType: TYPES[extname(path)] ?? 'application/octet-stream',
          headers: {'Access-Control-Allow-Origin': '*'},
          body: await readFile(join(packageRoot, path)),
        });
      } catch {
        await route.fulfill({status: 404, body: `not in package: ${path}`});
      }
    });
    await use(page);
    expect(problems, 'the page must not log errors or fail requests').toEqual([]);
  },
});

export {expect};
