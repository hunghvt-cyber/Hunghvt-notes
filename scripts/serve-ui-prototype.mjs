import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = new Map([
  ['/prototype/ui-responsive/', ['prototype/ui-responsive/index.html', 'text/html; charset=utf-8']],
  ['/prototype/ui-responsive/index.html', ['prototype/ui-responsive/index.html', 'text/html; charset=utf-8']],
  ['/prototype/ui-responsive/prototype.css', ['prototype/ui-responsive/prototype.css', 'text/css; charset=utf-8']],
  ['/prototype/ui-responsive/prototype.js', ['prototype/ui-responsive/prototype.js', 'text/javascript; charset=utf-8']],
  ['/public/app.css', ['public/app.css', 'text/css; charset=utf-8']],
]);
const host = process.argv[2] ?? '127.0.0.1';
const port = Number(process.env.PROTOTYPE_PORT ?? 4173);
if (!/^(?:127\.0\.0\.1|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3})$/.test(host)) throw new Error('BIND_ADDRESS_MUST_BE_LOOPBACK_OR_TAILSCALE_IPV4');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('INVALID_PREVIEW_PORT');

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  const entry = files.get(pathname);
  const headers = {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  };
  if (!entry) { res.writeHead(404, headers); res.end('not found'); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { ...headers, allow: 'GET, HEAD' }); res.end(); return; }
  try {
    const body = await readFile(resolve(root, entry[0]));
    res.writeHead(200, { ...headers, 'content-type': entry[1], 'content-length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(500, headers); res.end('preview unavailable');
  }
});
server.listen(port, host, () => process.stdout.write(`Synthetic UI preview listening on http://${host}:${port}/prototype/ui-responsive/\n`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
