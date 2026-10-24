import type { Run } from './admin-db.ts';
import { ensureDataset, getDataset } from './dataset.ts';

export const adminCanWrite = () => getDataset().source === 'postgres';

/** One short-lived single connection (begin/commit stay in one session); reloads the snapshot and purges the CDN after. */
export async function withDb<T>(fn: (run: Run) => Promise<T>, opts: { reload?: boolean; tx?: boolean } = { reload: true }): Promise<T> {
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const run: Run = (q, p) => sql.unsafe(q, p as any[]) as unknown as Promise<any[]>;
    let out: T;
    if (opts.tx) { // all-or-nothing: a rejected step (e.g. affiliate without a verified exequátur) leaves nothing half-saved
      await run('begin');
      try { out = await fn(run); await run('commit'); } catch (e) { await run('rollback').catch(() => {}); throw e; }
    } else out = await fn(run);
    if (opts.reload !== false) {
      await ensureDataset(true);
      if (process.env.PURGE_WEBHOOK_URL) await fetch(process.env.PURGE_WEBHOOK_URL, { method: 'POST' }).catch(() => {});
    }
    return out;
  } finally { await sql.end(); }
}
