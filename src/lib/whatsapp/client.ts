import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { toApiPayload, type Out } from './messages.ts';

export interface Inbound { from: string; id: string; kind: 'text' | 'reply' | 'other'; text?: string; replyId?: string; name?: string }

/** X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(rawBody, appSecret). Constant-time compare. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith('sha256=') || !appSecret) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest();
  const given = Buffer.from(header.slice(7), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Pulls user messages out of a webhook payload; delivery/read statuses are ignored. */
export function parseWebhook(body: any): Inbound[] {
  const out: Inbound[] = [];
  for (const entry of body?.entry ?? []) for (const ch of entry?.changes ?? []) {
    const v = ch?.value; if (!v?.messages) continue;
    const names = new Map<string, string>((v.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name]));
    for (const m of v.messages) {
      const base = { from: String(m.from), id: String(m.id), name: names.get(m.from) };
      if (m.type === 'text') out.push({ ...base, kind: 'text', text: String(m.text?.body ?? '') });
      else if (m.type === 'interactive') {
        const r = m.interactive?.button_reply ?? m.interactive?.list_reply;
        out.push(r?.id ? { ...base, kind: 'reply', replyId: String(r.id), text: String(r.title ?? '') } : { ...base, kind: 'other' });
      } else if (m.type === 'button' && m.button?.payload) out.push({ ...base, kind: 'reply', replyId: String(m.button.payload) });
      else out.push({ ...base, kind: 'other' });
    }
  }
  return out;
}

/** Anonymous id for logs: we never log numbers or message text. */
export const hashSender = (from: string, pepper = process.env.CEDULA_PEPPER ?? '') => createHash('sha256').update(pepper + from).digest('hex').slice(0, 12);

const seen = new Map<string, number>();
/** WhatsApp redelivers webhooks; true when this message id was already handled in the last hour. */
export function alreadySeen(id: string, now = Date.now()): boolean {
  for (const [k, t] of seen) if (now - t > 3_600_000) seen.delete(k);
  if (seen.has(id)) return true;
  seen.set(id, now);
  return false;
}

export const waConfigured = (env = process.env) => !!(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);

async function graph(body: unknown, env = process.env): Promise<void> {
  const v = env.WHATSAPP_API_VERSION ?? 'v24.0';
  const res = await fetch(`https://graph.facebook.com/${v}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function sendMessages(to: string, msgs: Out[], env = process.env): Promise<void> {
  for (const m of msgs) await graph(toApiPayload(to, m), env); // sequential: WhatsApp shows them in send order
}
export const markRead = (messageId: string, env = process.env) => graph({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }, env);
