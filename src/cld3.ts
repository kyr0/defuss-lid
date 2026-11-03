/**
 * Optional provider for the unmodified upstream CLD3 build from npm (`cld3-asm@4.0.0`, an optional peer dependency).
 *
 * Why keep it next to the packs: it is the independent reference. The test suite checks that the raw full-inventory
 * pack, reconstructed by `cld3-pack.ts`, returns exactly what this provider returns, which proves the pack pipeline
 * does not alter CLD3's behaviour. Prefer `defuss-lid/cld3-pack` in applications: the npm build is ~1 MB of JS with
 * base64-embedded WASM, while a pack plus the shared core is ~200 kB.
 *
 * VERIFIED: tests/cld3.test.ts compares the raw full pack against this provider text by text.
 *
 * @module
 */
import {CLD3_LAYOUT} from '../runtime/cld3-layout.js';
import {boostWeight, checkTop1, CLD3_BOOST_WEIGHT} from './boost.js';
import type {Cld3Prediction, Cld3PredictOptions} from './cld3-pack.js';

/** CLD3's 109 output labels, as the packs name them. */
const LABELS: readonly string[] = CLD3_LAYOUT.labels;

export interface Cld3Provider {
  /**
   * Top-1 language, same contract as a CLD3 pack (including `boost` and the letter check of `reliable`): `[]` for
   * blank text, `und` or a result below `threshold`.
   */
  predict(text: string, options?: Cld3PredictOptions): Cld3Prediction[];
  /** Free the native model. Idempotent. */
  dispose(): void;
}

interface Cld3AsmFactory {
  create(minBytes: number, maxBytes: number): {
    findLanguage(text: string): {language: string; probability: number; is_reliable: boolean};
    dispose(): void;
  };
}

/** Load the upstream CLD3 build. Requires `cld3-asm@4.0.0` to be installed; rejects otherwise. */
export async function loadCld3({minBytes = 0, maxBytes = 10000}: {minBytes?: number; maxBytes?: number} = {}): Promise<Cld3Provider> {
  if (!Number.isInteger(minBytes) || !Number.isInteger(maxBytes) || minBytes < 0 || maxBytes <= minBytes) {
    throw new RangeError('0 <= minBytes < maxBytes required');
  }
  // Dynamic import: the peer is loaded only when this provider is used. cld3-asm is CommonJS; Node exposes it under
  // `default`, bundlers sometimes as named exports.
  const imported = await import('cld3-asm') as unknown as {default?: {loadModule(): Promise<Cld3AsmFactory>}};
  const {loadModule} = (imported.default ?? imported) as {loadModule(): Promise<Cld3AsmFactory>};
  const factory = await loadModule();
  const model = factory.create(minBytes, maxBytes);
  let disposed = false;
  return {
    predict(text, {k = 1, threshold = 0, languages, boost}: {k?: number; threshold?: number; languages?: unknown; boost?: boolean | number} = {}) {
      if (disposed) throw new Error('CLD3 provider has been disposed');
      if (typeof text !== 'string') throw new TypeError('text must be a string');
      if (k !== 1) throw new RangeError('CLD3 exposes only the top language for a single span');
      if (languages !== undefined) throw new RangeError('use a build-time CLD3 pack allowlist');
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new RangeError('threshold must be in [0,1]');
      const weight = boostWeight(boost, CLD3_BOOST_WEIGHT);
      if (!text.trim()) return [];
      const result = model.findLanguage(text);
      if (!result.language || result.language === 'und') return [];
      // CLD3 still emits the old ISO 639 codes iw and fil; the packs use he and tl.
      const language = ({iw: 'he', fil: 'tl'} as Record<string, string>)[result.language] ?? result.language;
      const checked = checkTop1(text, LABELS, {language, score: result.probability, reliable: result.is_reliable}, weight);
      return checked.score < threshold ? [] : [checked];
    },
    dispose() {
      if (!disposed) {
        model.dispose();
        disposed = true;
      }
    },
  };
}
