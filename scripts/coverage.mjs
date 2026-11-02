#!/usr/bin/env node
/**
 * The website's "Unit test coverage" block, computed from the last `bun run coverage`: `node scripts/coverage.mjs`
 * prints it, `--write` replaces it in docs/index.html, `--check` exits 1 when the page differs (run by `make coverage`
 * right after the measurement, so a stale figure fails the gate).
 *
 * Inputs: coverage/coverage-summary.json (Vitest v8 `json-summary` reporter, totals over src/) and coverage/tests.json
 * (Vitest `json` reporter, test counts), both written by `bun run coverage`; the thresholds come from vitest.config.ts.
 *
 * Why generated and checked instead of a badge service: the figures stay on the page without a third-party request,
 * and they cannot drift from the code, because the gate compares them after every coverage run. A hand-copied number
 * would be wrong after the next added test.
 *
 * VERIFIED: V8 coverage of the same sources and tests gives the same totals on repeated runs on the pinned Node.js
 * (2026-11-02); CI measures coverage only in the `verify` job, which uses the mise-pinned version.
 */
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {replaceBlock} from './sizes.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const METRICS = [['lines', 'Lines'], ['branches', 'Branches'], ['functions', 'Functions'], ['statements', 'Statements']];

/** Ring colour: high at 90% and above, mid down to defuss-vae's 60% gate floor, low below it. */
const level = pct => pct >= 90 ? 'high' : pct >= 60 ? 'mid' : 'low';
const percent = pct => `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;

/** Totals, test count and thresholds of the last coverage run; throws with the fix when an input is missing. */
export async function coverageFigures() {
  const read = async (file, hint) => {
    try {
      return JSON.parse(await readFile(join(root, file), 'utf8'));
    } catch {
      throw new Error(`${file} missing: run bun run coverage (${hint})`);
    }
  };
  const summary = await read('coverage/coverage-summary.json', 'json-summary reporter of vitest.config.ts');
  const results = await read('coverage/tests.json', 'json reporter of the coverage script');
  if (!results.success) throw new Error('the last coverage run had failing tests; fix them before publishing figures');
  const config = await readFile(join(root, 'vitest.config.ts'), 'utf8');
  const thresholds = Object.fromEntries(METRICS.map(([key]) => [key, Number(new RegExp(`\\b${key}: (\\d+)`).exec(config)?.[1])]));
  if (METRICS.some(([key]) => !Number.isFinite(thresholds[key]))) throw new Error('vitest.config.ts: coverage.thresholds not found');
  return {totals: Object.fromEntries(METRICS.map(([key]) => [key, summary.total[key].pct])), tests: results.numTotalTests, thresholds};
}

/** The block between `<!-- coverage:start -->` and `<!-- coverage:end -->`. */
export async function coverageBlock() {
  const {totals, tests, thresholds} = await coverageFigures();
  const ring = ([key, label]) => {
    const pct = totals[key];
    return `<div class="mk-stat"><div class="radial-progress" role="progressbar" data-tone="auto" data-level="${level(pct)}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${label} coverage" style="--value: ${pct}; --size: 6rem">${percent(pct)}</div><span class="mk-stat-label">${label}</span></div>`;
  };
  // Group metrics that share a threshold ("90 % of lines, functions and statements or 80 % of branches"), so the
  // sentence stays true for any config.
  const list = items => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
  const byValue = new Map();
  for (const [key] of METRICS) byValue.set(thresholds[key], [...(byValue.get(thresholds[key]) ?? []), key]);
  const floors = [...byValue].sort(([a], [b]) => b - a).map(([value, keys]) => `${value}&nbsp;% of ${list(keys)}`).join(' or ');
  return [
    '<div class="mk-stats lid-coverage">',
    '  <div class="mk-stats-rings">',
    ...METRICS.map(metric => `    ${ring(metric)}`),
    '  </div>',
    '</div>',
    `<p class="lid-coverage-note"><span data-fact="tests">${tests}</span> unit tests of <code>src/</code> run on Node.js and on Bun; V8 measures the coverage on Node.js, and the build fails below ${floors}.</p>`,
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = 'docs/index.html';
  const block = await coverageBlock();
  const write = process.argv.includes('--write'), check = process.argv.includes('--check');
  const text = write || check ? await readFile(join(root, file), 'utf8') : '';
  const updated = write || check ? replaceBlock(text, 'coverage', block, file) : '';
  if (write) await writeFile(join(root, file), updated);
  else if (check) {
    if (updated !== text) {
      console.error(`${new Date().toISOString()} error check=coverage-block file=${file} fix="node scripts/coverage.mjs --write"`);
      process.exit(1);
    }
    console.log(`${new Date().toISOString()} info check=coverage-block ok`);
  } else console.log(block);
}
