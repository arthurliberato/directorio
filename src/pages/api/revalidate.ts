import type { APIRoute } from 'astro';
import { ensureDataset, getDataset } from '../../lib/dataset.ts';
// POST: reload the in-memory snapshot now (call after writes). CDN purge is host-specific: set PURGE_WEBHOOK_URL.
export const POST: APIRoute = async () => {
  await ensureDataset(true);
  if (process.env.PURGE_WEBHOOK_URL) await fetch(process.env.PURGE_WEBHOOK_URL, { method: 'POST' }).catch(() => {});
  return Response.json({ ok: true, source: getDataset().source, doctors: getDataset().doctors.length });
};
