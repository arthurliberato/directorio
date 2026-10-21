// Outbound WhatsApp message shapes + builders. Limits are Meta's (Cloud API, interactive messages);
// builders clip instead of failing so a long clinic name never makes a whole reply bounce.

export interface Row { id: string; title: string; description?: string }
export type Out =
  | { type: 'text'; body: string }
  | { type: 'image'; link: string; caption: string }
  | { type: 'buttons'; body: string; buttons: { id: string; title: string }[] }
  | { type: 'list'; body: string; button: string; rows: Row[]; footer?: string };

export const clip = (s: string, n: number) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…'; };

export const text = (body: string): Out => ({ type: 'text', body: clip4096(body) });
const clip4096 = (s: string) => (s.length <= 4096 ? s : s.slice(0, 4095) + '…');
export const image = (link: string, caption: string): Out => ({ type: 'image', link, caption: clip(caption, 1024) });

/** Reply buttons: max 3, title <= 20 chars, body <= 1024. */
export function buttons(body: string, items: { id: string; title: string }[]): Out {
  return { type: 'buttons', body: clip(body, 1024), buttons: items.slice(0, 3).map((b) => ({ id: b.id.slice(0, 256), title: clip(b.title, 20) })) };
}

/** List message: max 10 rows in total, row title <= 24, description <= 72, button label <= 20. */
export function list(body: string, button: string, rows: Row[], footer?: string): Out {
  return {
    type: 'list', body: clip(body, 1024), button: clip(button, 20), footer: footer ? clip(footer, 60) : undefined,
    rows: rows.slice(0, 10).map((r) => ({ id: r.id.slice(0, 200), title: clip(r.title, 24), description: r.description ? clip(r.description, 72) : undefined })),
  };
}

/** Cloud API request body for a message to `to` (digits only, no +). */
export function toApiPayload(to: string, m: Out): Record<string, unknown> {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to };
  switch (m.type) {
    case 'text': return { ...base, type: 'text', text: { body: m.body, preview_url: true } };
    case 'image': return { ...base, type: 'image', image: { link: m.link, caption: m.caption } };
    case 'buttons': return { ...base, type: 'interactive', interactive: { type: 'button', body: { text: m.body }, action: { buttons: m.buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) } } };
    case 'list': return {
      ...base, type: 'interactive',
      interactive: {
        type: 'list', body: { text: m.body }, ...(m.footer ? { footer: { text: m.footer } } : {}),
        action: { button: m.button, sections: [{ title: 'Opciones', rows: m.rows.map((r) => ({ id: r.id, title: r.title, ...(r.description ? { description: r.description } : {}) })) }] },
      },
    };
  }
}
