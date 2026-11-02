import { loadCld3Pack } from '../cld3-pack.js';
import { PACKS } from './index.js';
import '../cld3-layout-D_LgBzys.js';
import '../boost-Bsc1WEV_.js';
import '../container-sM-fBKLB.js';

const meta = PACKS.major_20;
const labels = meta.languages;
const url = new URL("../../models/v0.3/major_20.cld3q", import.meta.url);
function load(options) {
  return loadCld3Pack(url, options);
}

export { labels, load, meta, url };
