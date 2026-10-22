// Minimal withDb for whatsapp/appointments.ts: the bot writes only appointment_requests, through the restricted role in db/bot-role.sql.
// Same signature as the site's admin-run.ts; there is no snapshot reload or CDN purge here.
import type { Run } from './admin-db.ts';

let sql: any = null;

export async function withDb<T>(fn: (run: Run) => Promise<T>, _opts: { reload?: boolean; tx?: boolean } = {}): Promise<T> {
  if (!sql) {
    const { default: postgres } = await import('postgres');
    sql = postgres(process.env.DATABASE_URL!, { max: 2, idle_timeout: 20, onnotice: () => {} });
  }
  const run: Run = (q, p) => sql.unsafe(q, p as any[]) as Promise<any[]>;
  return fn(run);
}
