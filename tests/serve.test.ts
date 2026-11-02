import {fileURLToPath} from 'node:url';
import {describe, expect, test} from 'vitest';
// @ts-expect-error scripts/ are plain ES modules without declarations
import {createStaticServer} from '../scripts/serve.mjs';

describe('static server (website and e2e)', () => {
  test('serves files with module and gzip-as-bytes types, rejects traversal and malformed escapes', async () => {
    // fileURLToPath, not URL#pathname: on Windows the pathname is /D:/a/…, which resolves to the wrong directory.
    const server = createStaticServer(fileURLToPath(new URL('../', import.meta.url)));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
    try {
      const page = await fetch(`${base}/docs/`);
      expect(page.status).toBe(200);
      expect(page.headers.get('content-type')).toContain('text/html');
      const core = await fetch(`${base}/runtime/cld3-core.bin.gz`);
      expect(core.headers.get('content-type')).toBe('application/gzip');
      expect(core.headers.get('content-encoding')).toBeNull();
      expect((await fetch(`${base}/docs/assets/site.js`)).headers.get('content-type')).toContain('text/javascript');
      expect((await fetch(`${base}/missing.txt`)).status).toBe(404);
      expect((await fetch(`${base}/..%2fetc%2fpasswd`)).status).toBe(403);
      // Regression: a malformed escape used to throw in the async handler and terminate the server.
      expect((await fetch(`${base}/%E0%A4%A`)).status).toBe(400);
      expect((await fetch(`${base}/docs/`)).status).toBe(200);
    } finally {
      server.close();
    }
  });
});
