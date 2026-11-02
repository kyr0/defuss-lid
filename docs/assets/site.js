// defuss-lid website: theme toggle, code blocks (highlighting + copy) and the live demo.
// Why plain ES modules and no framework: GitHub Pages serves docs/ as static files without a build step.
// The runtime is imported lazily, so a failed model or runtime download never breaks the rest of the page.
// VERIFIED: e2e/site.spec.mjs drives every section in Chromium, Firefox and WebKit, against local and live models.

const $ = id => document.getElementById(id);
const THEME_KEY = 'defuss-shadcn-theme';

// ---- theme ------------------------------------------------------------------------------------------------------------
// The inline <head> script already applied the saved choice before the first paint; this only keeps it in sync.
const toggle = $('theme-toggle');
const savedTheme = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(THEME_KEY));
    return raw && raw.format === 'defuss-store' ? raw.value : raw;
  } catch {
    return '';
  }
};
const applyTheme = dark => {
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  toggle.checked = dark;
};
toggle.checked = document.documentElement.classList.contains('dark');
toggle.addEventListener('change', () => {
  applyTheme(toggle.checked);
  try { localStorage.setItem(THEME_KEY, JSON.stringify(toggle.checked ? 'dark' : 'light')); } catch {}
});
// Follow the OS only while the visitor has not chosen.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => { if (!savedTheme()) applyTheme(event.matches); });

// ---- code blocks ------------------------------------------------------------------------------------------------------
// The markup holds plain text (the e2e snippet runner executes it). Here each block becomes one span per line, as the
// code-block component expects, with a few coloured tokens. textContent stays byte-identical: lines are re-joined by
// the same "\n" text nodes, so copying and the snippet runner see the original code.
const TOKEN = /(\/\/[^\n]*)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|(<\/?[a-z][\w-]*|\b(?:import|from|const|await|new|return|true|false)\b)|\b(\d+(?:\.\d+)?)\b/g;
const KIND = ['c', 's', 'k', 'n'];
const highlight = code => {
  const lines = code.textContent.split('\n');
  const fragment = document.createDocumentFragment();
  lines.forEach((line, index) => {
    if (index) fragment.append('\n');
    const row = document.createElement('span');
    let last = 0;
    // shell commands carry no tokens worth colouring (and "bun add" has no keywords)
    if (!code.classList.contains('language-sh')) {
      for (const match of line.matchAll(TOKEN)) {
        row.append(line.slice(last, match.index));
        const token = document.createElement('span');
        token.className = `mk-code-block-${KIND[match.slice(1).findIndex(Boolean)]}`;
        token.textContent = match[0];
        row.append(token);
        last = match.index + match[0].length;
      }
    }
    row.append(line.slice(last));
    fragment.append(row);
  });
  code.replaceChildren(fragment);
  code.dataset.lines = String(lines.length);
};
for (const code of document.querySelectorAll('.mk-code-block code')) highlight(code);

for (const button of document.querySelectorAll('.mk-code-block-copy')) {
  const block = button.closest('.mk-code-block');
  const status = block.querySelector('.mk-code-block-status');
  button.addEventListener('click', async () => {
    // tabbed blocks (npm / bun) hide the other commands with CSS: copy the visible one
    const pre = [...block.querySelectorAll('pre')].find(item => getComputedStyle(item).display !== 'none');
    try {
      await navigator.clipboard.writeText(pre.querySelector('code').textContent);
      status.textContent = 'Copied';
      button.dataset.copied = '';
    } catch {
      status.textContent = 'Copy failed: select the code and copy it by hand';
    }
    setTimeout(() => { status.textContent = ''; delete button.dataset.copied; }, 2000);
  });
}

// ---- live demo --------------------------------------------------------------------------------------------------------
const HF = 'https://huggingface.co/kyr0/defuss-lid-1.0/resolve/24d27e5b42d002d69fded6301607160919151370/';
const HF_PAGE = 'https://huggingface.co/kyr0/defuss-lid-1.0/blob/24d27e5b42d002d69fded6301607160919151370/';
const MODELS = {
  der_3: {file: 'der_3.dlid'},
  deferi_6: {file: 'deferi_6.dlid'},
  major_20: {file: 'major_20.cld3q', cld3: true},
  full: {file: 'full.cld3q', cld3: true},
};

const ui = {
  text: $('demo-text'), model: $('demo-model'), results: $('demo-results'), empty: $('demo-empty'),
  state: $('demo-state'), status: $('demo-status'), retry: $('demo-retry'), file: $('demo-file'), fileName: $('demo-file-name'),
  bytes: $('demo-bytes'), labels: $('demo-labels'), load: $('demo-load'), time: $('demo-time'), boost: $('demo-boost'),
};
const number = new Intl.NumberFormat('en');
const ms = value => (value < 10 ? value.toFixed(2) : number.format(Math.round(value))) + ' ms';
let names;
try { names = new Intl.DisplayNames(['en'], {type: 'language'}); } catch {}
const languageName = code => {
  try { return names?.of(code) ?? code; } catch { return code; }
};

let runtime;
const getRuntime = () => (runtime ??= Promise.all([
  import('./lib/dist/index.js'), import('./lib/dist/cld3-pack.js'), import('./lib/dist/packs/index.js'),
]).then(([fastText, cld3, packs]) => ({
  loadModel: fastText.loadModel, loadCld3Pack: cld3.loadCld3Pack, PACKS: packs.PACKS, boostWeight: fastText.BOOST_WEIGHT,
})).catch(error => {
  runtime = undefined; // a later retry imports again
  throw error;
}));

const fastTextCache = new Map(); // fastText models are plain typed arrays: safe to keep while switching
let active = null; // {name, model, cld3, boostWeight}
let generation = 0; // the newest model request wins; older ones are dropped when they finish

const setStatus = (state, text) => {
  ui.state.dataset.state = state;
  ui.status.textContent = text;
  ui.retry.hidden = state !== 'error';
  ui.results.setAttribute('aria-busy', String(state === 'loading'));
};

const showFile = name => {
  const {file} = MODELS[name];
  ui.file.href = HF_PAGE + file;
  ui.fileName.textContent = file;
};

async function selectModel(name) {
  const ticket = ++generation;
  const spec = MODELS[name];
  showFile(name);
  ui.labels.textContent = ui.load.textContent = ui.time.textContent = 'pending';
  setStatus('loading', `Loading ${name}…`);
  try {
    const {loadModel, loadCld3Pack, PACKS, boostWeight} = await getRuntime();
    const {bytes} = PACKS[name];
    if (ticket === generation) ui.bytes.textContent = `${(bytes / 1000).toFixed(1)} kB`;
    const started = performance.now();
    let model = fastTextCache.get(name);
    if (!model) {
      // CLD3: the shared core resolves relative to cld3-pack.js (assets/lib/runtime/cld3-core.bin.gz)
      model = spec.cld3 ? await loadCld3Pack(HF + spec.file) : await loadModel(HF + spec.file);
      if (!spec.cld3) fastTextCache.set(name, model);
    }
    const loadTime = performance.now() - started;
    if (ticket !== generation) {
      if (spec.cld3) model.dispose(); // superseded while loading: free its WebAssembly instance
      return;
    }
    if (active?.cld3) active.model.dispose(); // each CLD3 pack owns a WebAssembly instance
    active = {name, model, cld3: Boolean(spec.cld3), boostWeight};
    ui.labels.textContent = number.format(model.meta.labels.length);
    ui.load.textContent = ms(loadTime);
    setStatus('ready', 'Ready');
    predict();
  } catch (error) {
    if (ticket !== generation) return;
    if (active?.cld3) active.model.dispose();
    active = null;
    ui.results.replaceChildren();
    ui.empty.hidden = true;
    setStatus('error', `Could not load ${name}: ${error.message}`);
  }
}

const row = ({language, score, reliable}, max) => {
  const item = document.createElement('li');
  item.className = 'lid-result';
  item.dataset.language = language;
  const label = document.createElement('span');
  label.className = 'lid-result-lang';
  const name = document.createElement('span');
  name.className = 'lid-result-name';
  name.textContent = languageName(language);
  const code = document.createElement('code');
  code.textContent = language;
  label.append(name, code);
  if (reliable !== undefined) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.dataset.variant = reliable ? 'secondary' : 'outline';
    badge.dataset.size = 'sm';
    badge.textContent = reliable ? 'reliable' : 'not reliable';
    label.append(badge);
  }
  const value = document.createElement('span');
  value.className = 'lid-result-score';
  value.textContent = score.toFixed(3);
  const bar = document.createElement('progress');
  bar.className = 'progress';
  bar.dataset.size = 'sm';
  bar.max = max;
  bar.value = Math.min(max, score); // fastText scores can exceed 1 by fastText's 1e-5 log epsilon
  bar.setAttribute('aria-label', `Score for ${name.textContent}`);
  item.append(label, value, bar);
  return item;
};

function predict() {
  if (!active) return;
  const text = ui.text.value;
  const boost = ui.boost.checked;
  const options = active.cld3 ? {boost} : {k: 3, boost};
  let predictions;
  try {
    // Time a short batch, not one call: one prediction often takes less than the browser's timer resolution.
    let runs = 0;
    const started = performance.now();
    do {
      predictions = active.model.predict(text, options);
      runs++;
    } while (performance.now() - started < 4 && runs < 100);
    ui.time.textContent = predictions.length ? ms((performance.now() - started) / runs) : 'n/a';
  } catch (error) {
    ui.results.replaceChildren();
    ui.empty.hidden = false;
    ui.empty.textContent = `This text cannot be classified: ${error.message}`;
    return;
  }
  // a boosted score is the model score plus up to the boost weight (letters that fit completely)
  const max = boost ? 1 + active.boostWeight : 1;
  ui.results.replaceChildren(...predictions.map(prediction => row(prediction, max)));
  ui.empty.hidden = predictions.length > 0;
  ui.empty.textContent = text.trim() ? 'No language passed the threshold.' : 'Type or paste some text to identify its language.';
}

let timer;
ui.text.addEventListener('input', () => {
  for (const button of document.querySelectorAll('[data-sample]')) delete button.dataset.active;
  clearTimeout(timer);
  timer = setTimeout(predict, 120); // debounce: one prediction per typing pause, not per key
});
ui.model.addEventListener('change', () => selectModel(ui.model.value));
ui.boost.addEventListener('change', predict);
ui.retry.addEventListener('click', () => selectModel(ui.model.value));
for (const button of document.querySelectorAll('[data-sample]')) {
  button.addEventListener('click', () => {
    ui.text.value = button.dataset.text;
    // visual marker only: the textarea itself tells assistive technology which text is loaded
    for (const other of document.querySelectorAll('[data-sample]')) other.toggleAttribute('data-active', other === button);
    clearTimeout(timer);
    predict();
  });
}

selectModel(ui.model.value);
