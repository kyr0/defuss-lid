/**
 * examples/browser.html, the minimal no-build page, served from inside the installed package (its imports are
 * package-relative: ../dist/, ../models/). Every model option must load and identify German.
 */
import {expect, test} from './fixtures.mjs';

test.skip(!process.env.E2E_ROOT, 'runs inside the installed package through scripts/e2e.mjs (make e2e)');

test('every model option of the minimal example identifies German', async ({page}) => {
  await page.goto('/consumer/node_modules/defuss-lid/examples/browser.html');
  const options = await page.locator('#model option').evaluateAll(nodes => nodes.map(node => node.value));
  expect(options).toHaveLength(4);
  for (const value of options) {
    await page.selectOption('#model', value);
    await page.click('#predict');
    await expect(page.locator('#result'), value).toContainText('"language": "de"');
  }
});
