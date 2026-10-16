import type { Run } from './admin-db.ts';
import { ensureDataset, getDataset } from './dataset.ts';

export const adminCanWrite = () => getDataset().source === 'postgres';

/** One short-lived single connection (begin/commit stay in one session); reloads the snapshot and purges the CDN after. */
export async function withDb<T>(fn: (run: Run) => Promise<T>, opts: { reload?: boolean } = { reload: true }): Promise<T> {
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const out = await fn((q, p) => sql.unsafe(q, p as any[]) as unknown as Promise<any[]>);
    if (opts.reload !== false) {
      await ensureDataset(true);
      if (process.env.PURGE_WEBHOOK_URL) await fetch(process.env.PURGE_WEBHOOK_URL, { method: 'POST' }).catch(() => {});
    }
    return out;
  } finally { await sql.end(); }
}
