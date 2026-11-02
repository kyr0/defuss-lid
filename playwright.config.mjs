/**
 * Playwright: every browser test runs in Chromium, Firefox and WebKit.
 *
 * Why three engines: the runtime relies on WebAssembly, Web Crypto (`crypto.subtle`) and `DecompressionStream`, whose
 * availability and numeric behaviour differ per engine; Chromium alone would not prove the "modern browsers" claim.
 *
 * The server root is E2E_ROOT: `scripts/e2e.mjs` points it at tmp/e2e/www, which holds the website and a clean
 * consumer project with the packed tarball installed, so the browser tests consume the publishable artifact. Without
 * E2E_ROOT the repository root is served, which is the fast loop while editing the site (`bunx playwright test`).
 *
 * VERIFIED: an unrelated server on port 4173 was reused by the old default, which is why reuse is off.
 */
import {defineConfig, devices} from '@playwright/test';

const port = Number(process.env.E2E_PORT || 4317);
const root = process.env.E2E_ROOT || '.';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'output/e2e/test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [
    ['list'],
    ['html', {outputFolder: 'output/e2e/report', open: 'never'}],
    ['json', {outputFile: 'output/e2e/results.json'}],
  ],
  use: {baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure'},
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome']}},
    {name: 'firefox', use: {...devices['Desktop Firefox']}},
    {name: 'webkit', use: {...devices['Desktop Safari']}},
  ],
  webServer: {
    command: `node scripts/serve.mjs --root ${JSON.stringify(root)} --port ${port}`,
    url: `http://127.0.0.1:${port}/docs/`,
    // Never reuse: an unrelated server on the same port would be tested instead of this site.
    reuseExistingServer: false,
    stdout: 'ignore',
  },
});
