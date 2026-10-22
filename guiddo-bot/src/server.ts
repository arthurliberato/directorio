// guiddo-bot: tiny node:http server. Routes: GET|POST /webhook (alias /api/whatsapp), GET /healthz, GET /admin/simulator.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { getDataset, ensureDataset } from './lib/dataset.ts';
import { checkAuth, renderSimulator, SIMULATOR_PATH } from './simulator.ts';
import { handleEvent, verifyChallenge, type Reply } from './webhook.ts';

const MAX_BODY = 1_000_000;
const inflight = new Set<Promise<void>>();

function send(res: ServerResponse, r: Reply, extra: Record<string, string> = {}) {
  res.writeHead(r.status, { 'Content-Type': r.type ?? 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(r.body);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => { size += c.length; if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/healthz' && req.method === 'GET') {
    const d = getDataset();
    return send(res, { status: 200, body: JSON.stringify({ ok: true, source: d.source, loadedAt: new Date(d.loadedAt).toISOString() }), type: 'application/json' });
  }
  if (path === '/webhook' || path === '/api/whatsapp') {
    if (req.method === 'GET') return send(res, verifyChallenge(url.searchParams));
    if (req.method === 'POST') {
      let raw: string;
      try { raw = await readBody(req); } catch { return send(res, { status: 413, body: 'Payload too large' }); }
      const r = handleEvent(raw, req.headers['x-hub-signature-256'] as string | undefined ?? null);
      inflight.add(r.done); void r.done.finally(() => inflight.delete(r.done));
      return send(res, r);
    }
    return send(res, { status: 405, body: 'Method not allowed' }, { Allow: 'GET, POST' });
  }
  if (path === SIMULATOR_PATH && req.method === 'GET') {
    const denied = checkAuth(req.headers.authorization ?? null);
    if (denied) return send(res, denied, denied.status === 401 ? { 'WWW-Authenticate': 'Basic realm="guiddo-bot"' } : {});
    try { await ensureDataset(); } catch { return send(res, { status: 503, body: 'Catalog unavailable' }); }
    return send(res, renderSimulator(url.searchParams));
  }
  return send(res, { status: 404, body: 'Not found' });
}

export async function main() {
  // Never answer patients from the illustrative seed in production.
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL && process.env.ALLOW_SEED !== '1') {
    throw new Error('DATABASE_URL is required in production (set ALLOW_SEED=1 only for a demo)');
  }
  await ensureDataset(); // fail fast at boot when the database is unreachable
  const port = Number(process.env.PORT ?? 8787);
  const server = createServer((req, res) => { route(req, res).catch((e) => { console.error('[http]', (e as Error).message); if (!res.headersSent) send(res, { status: 500, body: 'Error' }); else res.end(); }); });
  server.listen(port, '0.0.0.0', () => console.log(`[guiddo-bot] listening on :${port} (catalog: ${getDataset().source})`));
  const stop = () => { server.close(); void Promise.allSettled([...inflight]).then(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch((e) => { console.error(e); process.exit(1); });
