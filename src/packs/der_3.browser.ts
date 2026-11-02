/**
 * der_3 pack (de, en, ru; fastText native PQ + int8): browser loader, fetching the packaged file.
 *
 * Serve or bundle `models/v0.3/der_3.dlid` with your application; bundlers that understand
 * `new URL(…, import.meta.url)` (Vite, webpack 5, Parcel, esbuild with a loader) emit it automatically.
 *
 * VERIFIED: fetches its asset and matches Node.js predictions in Chromium, Firefox and WebKit
 * (e2e/parity.spec.mjs).
 *
 * @module
 */
import {type LidModel, type LoadOptions, loadModel} from '../index.js';
import {PACKS} from './index.js';

export const meta = PACKS.der_3;
export const labels = meta.languages;
/** The packaged model file. A literal `new URL(…, import.meta.url)` lets bundlers find and emit the asset. */
export const url = new URL('../../models/v0.3/der_3.dlid', import.meta.url);

/** Fetch and validate the model. */
export function load(options?: LoadOptions): Promise<LidModel> {
  return loadModel(url, options);
}
