#!/usr/bin/env node
/**
 * Minimal static file server for the website (docs/) and the examples, bound to 127.0.0.1.
 *
 * Why not `python -m http.server` or a dev-server dependency: the CLD3 core ships as `.gz` bytes that the runtime
 * hash-checks and decompresses itself, so the server must send it as `application/gzip` WITHOUT
 * `Content-Encoding: gzip` (a browser would otherwise inflate it before the hash check). Module scripts also need a
 * JavaScript MIME type. This file does both with Node's standard library only and is reused by the e2e tests.
 *
 * Usage: node scripts/serve.mjs [--root <dir>] [--port <n>]   (PORT env var also works; default 8080)
 *
 * VERIFIED: serves the core without Content-Encoding and answers a malformed escape with 400 instead of exiting
 * (tests/serve.test.ts).
 */
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.gz': 'application/gzip', '.wasm': 'application/wasm', '.dlid': 'application/octet-stream', '.cld3q': 'application/octet-stream',
};

/** Create (not start) a server for `root`; requests outside `root` get 403, directories serve their index.html. */
export function createStaticServer(root) {
  const base = resolve(root);
  return createServer(async (request, response) => {
    let path;
    try {
      path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      // A malformed %-escape must not throw inside this async handler: the rejection would end the process.
      response.writeHead(400, {'Content-Type': 'text/plain'}).end('bad request');
      return;
    }
    let file = resolve(join(base, path));
    if (file !== base && !file.startsWith(base + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      await stat(file);
      response.writeHead(200, {'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store'});
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404, {'Content-Type': 'text/plain'}).end('not found');
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const arg = name => {
    const index = process.argv.indexOf(name);
    return index > 0 ? process.argv[index + 1] : undefined;
  };
  const root = resolve(arg('--root') ?? fileURLToPath(new URL('../', import.meta.url)));
  const port = Number(arg('--port') || process.env.PORT || 8080);
  createStaticServer(root).listen(port, '127.0.0.1', () => {
    console.log(`${new Date().toISOString()} info serving root=${root} url=http://127.0.0.1:${port}/docs/`);
  });
  process.on('SIGTERM', () => process.exit(0));
}
