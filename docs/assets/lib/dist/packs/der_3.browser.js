import { loadModel } from '../index.js';
import { PACKS } from './index.js';
import '../container-sM-fBKLB.js';

const meta = PACKS.der_3;
const labels = meta.languages;
const url = new URL("../../models/v0.3/der_3.dlid", import.meta.url);
function load(options) {
  return loadModel(url, options);
}

export { labels, load, meta, url };
