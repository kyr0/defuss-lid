/**
 * deferi_6 pack (de, en, fr, es, ru, it; fastText DNO-PQ): browser loader, fetching the packaged file.
 *
 * Serve or bundle `models/fastText-pq-dno/deferi_6.dlid` with your application; bundlers that understand
 * `new URL(…, import.meta.url)` (Vite, webpack 5, Parcel, esbuild with a loader) emit it automatically.
 *
 * VERIFIED: fetches its asset and matches Node.js predictions in Chromium, Firefox and WebKit
 * (e2e/parity.spec.mjs).
 *
 * @module
 */
import {type LidModel, type LoadOptions, loadModel} from '../index.js';
import {PACKS} from './index.js';

export const meta = PACKS.deferi_6;
export const labels = meta.languages;
/** The packaged model file. A literal `new URL(…, import.meta.url)` lets bundlers find and emit the asset. */
export const url = new URL('../../models/fastText-pq-dno/deferi_6.dlid', import.meta.url);

/** Fetch and validate the model. */
export function load(options?: LoadOptions): Promise<LidModel> {
  return loadModel(url, options);
}
