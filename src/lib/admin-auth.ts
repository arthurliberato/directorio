import { createHash, timingSafeEqual } from 'node:crypto';

const sha = (s: string) => createHash('sha256').update(s).digest();
const safeEq = (a: string, b: string) => timingSafeEqual(sha(a), sha(b));

/** HTTP Basic auth against ADMIN_USER / ADMIN_PASSWORD. Returns null when allowed, else a Response to send. */
export function checkAdminAuth(header: string | null, env = process.env): Response | null {
  const pass = env.ADMIN_PASSWORD;
  if (!pass) return new Response('Admin disabled: set ADMIN_PASSWORD', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const m = header?.match(/^Basic (.+)$/i);
  if (m) {
    const [u, ...rest] = Buffer.from(m[1], 'base64').toString('utf8').split(':');
    if (safeEq(u, env.ADMIN_USER ?? 'admin') && safeEq(rest.join(':'), pass)) return null;
  }
  return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="admin", charset="UTF-8"', 'Cache-Control': 'no-store' } });
}

/** The signed-in admin's username (recorded as `checked_by` in the verification log). */
export function adminUser(header: string | null): string {
  const m = header?.match(/^Basic (.+)$/i);
  return m ? Buffer.from(m[1], 'base64').toString('utf8').split(':')[0] || 'admin' : 'admin';
}
