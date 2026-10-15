import { defineMiddleware } from 'astro:middleware';
import { ensureDataset } from './lib/dataset.ts';
import { getRedirect } from './lib/data.ts';
import { checkAdminAuth } from './lib/admin-auth.ts';
import { botLogLine, classifyBot } from './lib/bots.ts';

// Order: canonical path form (lowercase, no trailing slash) -> redirects table -> render -> cache headers.
export const onRequest = defineMiddleware(async (ctx, next) => {
  await ensureDataset();
  const url = new URL(ctx.request.url);
  let path = url.pathname;

  if (/^\/(admin|api)(\/|$)/.test(path)) {
    const denied = checkAdminAuth(ctx.request.headers.get('authorization'));
    if (denied) return denied;
  }

  let canonical = path;
  if (canonical.length > 1 && canonical.endsWith('/')) canonical = canonical.replace(/\/+$/, '') || '/';
  if (!/^\/(admin|api)\b/.test(canonical)) canonical = canonical.toLowerCase();
  const row = getRedirect(canonical);
  if (row) canonical = row.to_path;

  if (canonical !== path && !path.startsWith('/_astro/')) {
    return new Response(null, { status: 301, headers: { Location: canonical + url.search, 'Cache-Control': 'public, max-age=3600' } });
  }

  const bot = classifyBot(ctx.request.headers.get('user-agent'));
  const res = await next();
  if (bot) console.log(botLogLine(bot, res.status, path));
  if (!res.headers.has('Cache-Control') && (res.headers.get('content-type') ?? '').includes('text/html')) {
    const noStore = path === '/buscar' || path.startsWith('/admin');
    res.headers.set('Cache-Control', noStore ? 'no-store' : res.status === 200
      ? 'public, s-maxage=3600, stale-while-revalidate=86400'
      : 'public, s-maxage=300');
  }
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  return res;
});
