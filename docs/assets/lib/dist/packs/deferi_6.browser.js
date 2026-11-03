import { loadModel } from '../index.js';
import { PACKS } from './index.js';
import '../boost-c99FlET5.js';
import '../container-sM-fBKLB.js';

const meta = PACKS.deferi_6;
const labels = meta.languages;
const url = new URL("../../models/v0.3/deferi_6.dlid", import.meta.url);
function load(options) {
  return loadModel(url, options);
}

export { labels, load, meta, url };
