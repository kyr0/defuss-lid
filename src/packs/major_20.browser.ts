/**
 * major_20 pack (20 major languages; CLD3 PQ + int8): browser loader, fetching the pack and the shared CLD3 core.
 *
 * Serve or bundle `models/v0.3/major_20.cld3q` and `runtime/cld3-core.bin.gz`; pass `coreURL` when the core lives
 * elsewhere. Serve the `.gz` without `Content-Encoding: gzip` (the loader checks its hash before decompressing).
 *
 * VERIFIED: fetches its asset and matches Node.js predictions in Chromium, Firefox and WebKit
 * (e2e/parity.spec.mjs).
 *
 * @module
 */
import {type Cld3Pack, type Cld3PackOptions, loadCld3Pack} from '../cld3-pack.js';
import {PACKS} from './index.js';

export const meta = PACKS.major_20;
export const labels = meta.languages;
/** The packaged pack file. A literal `new URL(…, import.meta.url)` lets bundlers find and emit the asset. */
export const url = new URL('../../models/v0.3/major_20.cld3q', import.meta.url);

/** Fetch the pack and the core, verify and instantiate. Call `dispose()` on the result when done. */
export function load(options?: Cld3PackOptions & {coreURL?: string | URL}): Promise<Cld3Pack> {
  return loadCld3Pack(url, options);
}
