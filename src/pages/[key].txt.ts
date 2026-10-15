import type { APIRoute } from 'astro';
import { INDEXNOW_KEY } from '../config.ts';
// IndexNow ownership file: /<INDEXNOW_KEY>.txt must return the key itself.
export const GET: APIRoute = ({ params }) =>
  INDEXNOW_KEY && params.key === INDEXNOW_KEY
    ? new Response(INDEXNOW_KEY, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    : new Response('Not found', { status: 404 });
