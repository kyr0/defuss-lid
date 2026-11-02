/**
 * Code examples of the README, the guides and the website, as data: every example is extracted, classified by the
 * tags its author declared, and later executed or checked by the e2e suite (scripts/e2e.mjs, e2e/snippets.spec.mjs).
 *
 * Why tags in the fence info string (```js node bun) instead of copying examples into tests: a copy drifts from the
 * page; executing the page itself cannot. GitHub ignores everything after the first word of the info string, so the
 * tags are invisible to readers. On the website the same tags live in `data-snippet` on `<code>`.
 *
 * Tags:
 *   node, bun   JS run as an ES module in a clean consumer project that installed the packed tarball.
 *   browser     JS run as a module script (import map for bare `defuss-lid/...` specifiers) or, for an html block,
 *               the page itself; in Chromium, Firefox and WebKit.
 *   install     package-manager lines; e2e installs the tarball with the same package manager.
 *   run         shell lines executed from the repository root against the built artifacts.
 *   cli         shell lines that need large downloads; the command, subcommand and every --flag must exist.
 *
 * Expected output: every executable JS example states what it prints, as `console.log(expr); // <line>`. The runner
 * compares the printed lines with these comments, so an example cannot silently start printing something else.
 *
 * VERIFIED: every code block of README.md, documentation/ and docs/index.html carries tags (scripts/verify.mjs
 * check 'snippets').
 */
import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';

/**
 * Pages whose examples are checked: the README, every guide in documentation/ (found by listing, so a new guide is
 * covered without editing this file) and the website.
 */
export async function sources(root) {
  const guides = (await readdir(join(root, 'documentation'))).filter(name => name.endsWith('.md')).sort();
  return ['README.md', ...guides.map(name => `documentation/${name}`), 'docs/index.html'];
}

/** Fence languages that are code and therefore need tags; prose-like blocks (text, json, bibtex…) need none. */
const CODE = new Set(['js', 'javascript', 'mjs', 'ts', 'typescript', 'html', 'sh', 'bash', 'shell', 'console', 'python', 'py']);
const TAGS = {
  js: ['node', 'bun', 'browser'], ts: ['node', 'bun', 'browser'], html: ['browser'], sh: ['install', 'run', 'cli'],
};
const LANGUAGE = {javascript: 'js', mjs: 'js', typescript: 'ts', bash: 'sh', shell: 'sh', console: 'sh'};

const decodeEntities = text => text
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** `console.log(...); // expected` → the expected stdout lines, in order. */
export function expectedOutput(code) {
  return [...code.matchAll(/console\.log\(.*\);?[ \t]*\/\/ (.*)$/gm)].map(match => match[1].trimEnd());
}

/** Extract every code example of one page. */
export function extract(source, text) {
  const blocks = [];
  if (source.endsWith('.md')) {
    for (const match of text.matchAll(/^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm)) {
      const [lang = '', ...tags] = match[1].trim().split(/\s+/).filter(Boolean);
      blocks.push({source, line: lineOf(text, match.index), lang: LANGUAGE[lang] ?? lang, tags, code: match[2]});
    }
  } else {
    for (const match of text.matchAll(/<pre[^>]*>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/g)) {
      const attributes = match[1];
      const lang = /class="[^"]*language-([\w-]+)/.exec(attributes)?.[1] ?? '';
      const tags = (/data-snippet="([^"]*)"/.exec(attributes)?.[1] ?? '').split(/\s+/).filter(Boolean);
      const code = decodeEntities(match[2].replace(/<[^>]+>/g, ''));
      blocks.push({source, line: lineOf(text, match.index), lang: LANGUAGE[lang] ?? lang, tags, code: code.endsWith('\n') ? code : code + '\n'});
    }
  }
  return blocks.map((block, i) => ({...block, id: `${block.source.replace(/[^\w]+/g, '-')}-${i + 1}`, expected: expectedOutput(block.code)}));
}

/** Contract violations of one block (empty when valid). */
export function problems(block) {
  const where = `${block.source}:${block.line}`;
  const out = [];
  const needsTags = CODE.has(block.lang) || block.lang === 'sh' || block.lang === 'js';
  if (!block.lang && block.tags.length === 0 && block.source.endsWith('.html')) out.push(`${where}: code block without a language class`);
  if (!needsTags) return out;
  const allowed = TAGS[block.lang];
  if (!allowed) return [...out, `${where}: ${block.lang} examples are not executable; use js, html or sh`];
  if (!block.tags.length) out.push(`${where}: ${block.lang} block without tags (allowed: ${allowed.join(', ')})`);
  for (const tag of block.tags) if (!allowed.includes(tag)) out.push(`${where}: unknown tag "${tag}" for ${block.lang}`);
  if ((block.lang === 'js' || block.lang === 'ts' || block.lang === 'html') && block.tags.length && !block.expected.length) {
    out.push(`${where}: executable example states no output; add \`console.log(x); // expected\``);
  }
  return out;
}

/** All examples of all sources; a missing README or website is an error, not an empty result. */
export async function collect(root) {
  const blocks = [];
  for (const source of await sources(root)) blocks.push(...extract(source, await readFile(join(root, source), 'utf8')));
  return blocks;
}
