import type { APIRoute } from 'astro';
import { createHash, timingSafeEqual } from 'node:crypto';
import { respond } from '../../lib/whatsapp/bot.ts';
import { alreadySeen, hashSender, markRead, parseWebhook, sendMessages, verifySignature, waConfigured } from '../../lib/whatsapp/client.ts';

// Meta WhatsApp Cloud API webhook. Not behind Basic auth (middleware exempts this path): GET is checked with
// WHATSAPP_VERIFY_TOKEN, POST with the X-Hub-Signature-256 HMAC (WHATSAPP_APP_SECRET).
const sha = (s: string) => createHash('sha256').update(s).digest();

export const GET: APIRoute = ({ url }) => {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  const given = url.searchParams.get('hub.verify_token') ?? '';
  if (token && url.searchParams.get('hub.mode') === 'subscribe' && timingSafeEqual(sha(given), sha(token))) {
    return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
  }
  return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
};

export const POST: APIRoute = async ({ request }) => {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return new Response('WhatsApp disabled: set WHATSAPP_APP_SECRET', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'), secret)) return new Response('Bad signature', { status: 401 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return new Response('Bad JSON', { status: 400 }); }

  // Answer 200 right away (Meta retries slow webhooks); reply in the background.
  if (waConfigured()) {
    for (const m of parseWebhook(body)) {
      if (alreadySeen(m.id)) continue;
      void (async () => {
        try {
          const { out, intent } = respond(m);
          console.log(`[wa] user=${hashSender(m.from)} intent=${intent} replies=${out.length}`);
          await markRead(m.id).catch(() => {});
          await sendMessages(m.from, out);
        } catch (e) { console.error('[wa] failed', hashSender(m.from), (e as Error).message); }
      })();
    }
  }
  return new Response('ok', { status: 200 });
};
