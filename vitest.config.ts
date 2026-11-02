/**
 * Vitest: unit and integration tests of the TypeScript sources against the real, hash-locked model files.
 *
 * The same suite runs on Node.js (`bun run test`) and on Bun (`bun run test:bun`, which starts Vitest with
 * `bun --bun`), because the package claims both runtimes. Browser engines are covered by Playwright (e2e/), which
 * consumes the packed tarball instead of the sources.
 *
 * VERIFIED: the suite passes on Node.js 26 and on Bun 1.4.3 (`bun --bun vitest run`).
 */
import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // text: the gate reads its All files row; json-summary: scripts/coverage.mjs renders the website block
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {lines: 90, functions: 90, branches: 80, statements: 90},
    },
  },
});
