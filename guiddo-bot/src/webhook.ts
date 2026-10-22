// Meta WhatsApp Cloud API webhook logic, independent of the HTTP server so it can be tested without sockets.
// GET is checked with WHATSAPP_VERIFY_TOKEN, POST with the X-Hub-Signature-256 HMAC (WHATSAPP_APP_SECRET).
import { createHash, timingSafeEqual } from 'node:crypto';
import { ensureDataset } from './lib/dataset.ts';
import { productionDeps, submitRequest, type Deps } from './lib/whatsapp/appointments.ts';
import { respond } from './lib/whatsapp/bot.ts';
import { alreadySeen, hashSender, markRead, parseWebhook, sendMessages, verifySignature, waConfigured } from './lib/whatsapp/client.ts';
import { text, type Out } from './lib/whatsapp/messages.ts';

export interface Reply { status: number; body: string; type?: string }
export interface Io {
  ensure(): Promise<void>;
  markRead(id: string): Promise<void>;
  send(to: string, out: Out[]): Promise<void>;
  deps(): Promise<Deps>;
}
export const realIo: Io = { ensure: () => ensureDataset(), markRead, send: sendMessages, deps: productionDeps };

const sha = (s: string) => createHash('sha256').update(s).digest();
const plain = (status: number, body: string): Reply => ({ status, body, type: 'text/plain; charset=utf-8' });

export function verifyChallenge(params: URLSearchParams, env = process.env): Reply {
  const token = env.WHATSAPP_VERIFY_TOKEN;
  const given = params.get('hub.verify_token') ?? '';
  if (token && params.get('hub.mode') === 'subscribe' && timingSafeEqual(sha(given), sha(token))) return plain(200, params.get('hub.challenge') ?? '');
  return plain(403, 'Forbidden');
}

const UNAVAILABLE = 'Estamos con problemas técnicos en este momento. Intenta de nuevo en unos minutos, por favor.';

/**
 * Validates the request and answers right away (Meta retries slow webhooks); each message is answered in the background.
 * `done` resolves when every reply has been sent (used by tests and graceful shutdown).
 */
export function handleEvent(raw: string, signature: string | null, env = process.env, io: Io = realIo): Reply & { done: Promise<void> } {
  const secret = env.WHATSAPP_APP_SECRET;
  const fail = (r: Reply) => ({ ...r, done: Promise.resolve() });
  if (!secret) return fail(plain(503, 'WhatsApp disabled: set WHATSAPP_APP_SECRET'));
  if (!verifySignature(raw, signature, secret)) return fail(plain(401, 'Bad signature'));
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return fail(plain(400, 'Bad JSON')); }

  const jobs: Promise<void>[] = [];
  if (waConfigured(env)) {
    for (const m of parseWebhook(body)) {
      if (alreadySeen(m.id)) continue;
      jobs.push((async () => {
        try {
          try { await io.ensure(); } catch (e) {
            console.error('[wa] catalog unavailable', (e as Error).message);
            await io.send(m.from, [text(UNAVAILABLE)]);
            return;
          }
          const res = respond(m);
          console.log(`[wa] user=${hashSender(m.from)} intent=${res.intent}`);
          await io.markRead(m.id).catch(() => {});
          const out = res.request ? await submitRequest({ ...res.request, from: m.from }, await io.deps()) : res.out;
          await io.send(m.from, out);
        } catch (e) { console.error('[wa] failed', hashSender(m.from), (e as Error).message); }
      })());
    }
  }
  return { ...plain(200, 'ok'), done: Promise.all(jobs).then(() => {}) };
}
