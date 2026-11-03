/**
 * major_20 pack (20 major languages; CLD3 DNO-PQ): Node.js and Bun loader, reading the pack and the shared CLD3 core from disk.
 *
 * Resolved through the `node` export condition, because Node's `fetch` cannot read `file:` URLs.
 *
 * VERIFIED: loads and predicts through the `node` export condition of the packed tarball (scripts/e2e.mjs,
 * tests/packs.test.ts).
 *
 * @module
 */
import {readFile} from 'node:fs/promises';
import {type Cld3Pack, type Cld3PackOptions, createCld3Pack} from '../cld3-pack.js';
import {PACKS} from './index.js';

export const meta = PACKS.major_20;
export const labels = meta.languages;
/** The bundled pack file. A literal `new URL(…, import.meta.url)` lets bundlers find and emit the asset. */
export const url = new URL('../../models/cld3-pq-dno/major_20.cld3q', import.meta.url);
const CORE = new URL('../../runtime/cld3-core.bin.gz', import.meta.url);

/** Read the pack and the core (or `coreURL`), verify and instantiate. Call `dispose()` on the result when done. */
export async function load({coreURL = CORE, ...options}: Cld3PackOptions & {coreURL?: string | URL} = {}): Promise<Cld3Pack> {
  const [pack, core] = await Promise.all([readFile(url), readFile(coreURL)]);
  return createCld3Pack(pack, {...options, core});
}
