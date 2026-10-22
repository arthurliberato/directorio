// Admin simulator: runs the same bot as the webhook against the live catalog; nothing is sent to WhatsApp.
// Protected with Basic auth (ADMIN_USER / ADMIN_PASSWORD); disabled (404) when no password is configured.
import { createHash, timingSafeEqual } from 'node:crypto';
import { BOT_NAME } from './config.ts';
import { respond } from './lib/whatsapp/bot.ts';
import { waConfigured } from './lib/whatsapp/client.ts';
import type { Reply } from './webhook.ts';

const sha = (s: string) => createHash('sha256').update(s).digest();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const SIMULATOR_PATH = '/admin/simulator';

/** null when allowed, otherwise the response to send. */
export function checkAuth(header: string | null, env = process.env): Reply | null {
  const pass = env.ADMIN_PASSWORD;
  if (!pass) return { status: 404, body: 'Not found', type: 'text/plain; charset=utf-8' };
  const [scheme, b64] = (header ?? '').split(' ');
  const [user, ...rest] = scheme === 'Basic' && b64 ? Buffer.from(b64, 'base64').toString('utf8').split(':') : [''];
  const ok = timingSafeEqual(sha(user + '\0' + rest.join(':')), sha((env.ADMIN_USER ?? 'admin') + '\0' + pass));
  return ok ? null : { status: 401, body: 'Unauthorized', type: 'text/plain; charset=utf-8' };
}

export function renderSimulator(params: URLSearchParams, env = process.env): Reply {
  const q = params.get('q'); const id = params.get('id');
  const reply = id ? respond({ kind: 'reply', replyId: id }) : respond({ kind: 'text', text: q ?? 'hola' });
  const vars = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'DATABASE_URL'].map((k) => [k, !!env[k]] as const);
  const href = (rid: string) => `${SIMULATOR_PATH}?id=${encodeURIComponent(rid)}`;
  const bubble = (m: (typeof reply.out)[number]) => {
    switch (m.type) {
      case 'text': return esc(m.body);
      case 'image': return `<img src="${esc(m.link)}" alt="" style="max-width:100%;border-radius:8px">\n${esc(m.caption)}`;
      case 'buttons': return `${esc(m.body)}<div style="display:grid;gap:6px;margin-top:8px">${m.buttons.map((b) => `<a href="${href(b.id)}" style="text-align:center;border:1px solid #35607f;border-radius:8px;padding:6px;text-decoration:none">${esc(b.title)}</a>`).join('')}</div>`;
      case 'list': return `${esc(m.body)}<ul style="list-style:none;padding:0;margin:8px 0 0;display:grid;gap:4px">${m.rows.map((r) => `<li><a href="${href(r.id)}" style="text-decoration:none"><b>${esc(r.title)}</b>${r.description ? `<br><small>${esc(r.description)}</small>` : ''}</a></li>`).join('')}</ul><small>Botón: «${esc(m.button)}»</small>`;
    }
  };
  const body = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Simulador de WhatsApp · ${esc(BOT_NAME)}</title>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:1rem auto;padding:0 1rem">
<h1>Simulador de WhatsApp · ${esc(BOT_NAME)}</h1>
<p>Webhook: <code>/webhook</code> · ${waConfigured(env) ? 'envío configurado' : 'sin credenciales: solo simulador'}. Variables: ${vars.map(([k, ok]) => `<span style="padding:2px 6px;border-radius:6px;background:${ok ? '#e4f4e8' : '#eee'}">${k} ${ok ? '✓' : '✗'}</span>`).join(' ')}</p>
<form method="get" action="${SIMULATOR_PATH}"><label for="q">Escribe como un paciente</label><br><input id="q" name="q" value="${esc(q ?? '')}" placeholder="cardiólogo en Santo Domingo" style="width:100%;padding:6px"><p><button>Enviar</button> <a href="${SIMULATOR_PATH}">Reiniciar</a></p></form>
<div style="max-width:28rem;background:#e9efe6;border-radius:12px;padding:12px;display:grid;gap:8px">${reply.out.map((m) => `<div style="background:#fff;border-radius:10px;padding:10px;white-space:pre-wrap;word-break:break-word">${bubble(m)}</div>`).join('')}</div>
<p><small>Intención registrada: ${esc(reply.intent)} (el log del servidor guarda solo la intención y un id anónimo, nunca el número ni el texto).</small></p></body></html>`;
  return { status: 200, body, type: 'text/html; charset=utf-8' };
}
