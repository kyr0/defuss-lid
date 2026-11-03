/**
 * deferi_6 pack (de, en, fr, es, ru, it; fastText DNO-PQ): Node.js and Bun loader, reading the bundled file from disk.
 *
 * Resolved through the `node` export condition. A separate disk loader exists because Node's `fetch` cannot read
 * `file:` URLs; the browser variant fetches the same asset.
 *
 * VERIFIED: loads and predicts through the `node` export condition of the packed tarball (scripts/e2e.mjs,
 * tests/packs.test.ts).
 *
 * @module
 */
import {readFile} from 'node:fs/promises';
import {LidModel, type LoadOptions} from '../index.js';
import {PACKS} from './index.js';

export const meta = PACKS.deferi_6;
export const labels = meta.languages;
/** The bundled model file. A literal `new URL(…, import.meta.url)` lets bundlers find and emit the asset. */
export const url = new URL('../../models/fastText-pq-dno/deferi_6.dlid', import.meta.url);

/** Read and validate the bundled model. */
export async function load(options?: LoadOptions): Promise<LidModel> {
  return LidModel.fromBuffer(await readFile(url), options);
}
