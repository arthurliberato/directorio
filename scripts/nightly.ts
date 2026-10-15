// Nightly job: node scripts/nightly.ts   (cron / Vercel Cron / GitHub Action)
// Env: DATABASE_URL (optional; seed otherwise), SITE_MODE, PUBLIC_SITE_URL, INDEXNOW_KEY, DRY_RUN=1
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { INDEXNOW_KEY, SITE_MODE, SITE_URL } from '../src/config.ts';
import { ensureDataset } from '../src/lib/dataset.ts';
import { pingIndexNow } from '../src/lib/indexnow.ts';
import { computeState, diffState, overdueReverification, type StateMap } from '../src/lib/nightly.ts';

await ensureDataset(true);
const next = computeState();
const dry = process.env.DRY_RUN === '1';

// Previous state: Postgres table when DATABASE_URL is set, otherwise a local JSON file.
let prev: StateMap = new Map();
let sql: any = null;
const FILE = new URL('../.state/index-state.json', import.meta.url);
if (process.env.DATABASE_URL) {
  const { default: postgres } = await import('postgres');
  sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
  const rows = await sql`select url, status, reason, lastmod::text as lastmod from url_index_state`;
  prev = new Map(rows.map((r: any) => [r.url, { status: r.status, reason: r.reason, lastmod: r.lastmod }]));
} else if (existsSync(FILE)) prev = new Map(JSON.parse(readFileSync(FILE, 'utf8')));

const { changes, ping } = diffState(prev, next);
const count = (s: 'index' | 'noindex') => [...next.values()].filter((x) => x.status === s).length;
console.log(`URLs: ${next.size} (index ${count('index')}, noindex ${count('noindex')}) · status changes: ${changes.length} · IndexNow pings: ${ping.length}`);
for (const c of changes.slice(0, 20)) console.log(`  ${c.old ?? '∅'} → ${c.new}  ${c.url}  (${c.reason})`);
const overdue = overdueReverification();
if (overdue.length) console.log(`Re-verification overdue (> 6 months): ${overdue.length}`, overdue.slice(0, 10).map((d) => d.slug));

if (!dry) {
  if (sql) {
    await sql.begin(async (tx: any) => {
      for (const c of changes) await tx`insert into index_status_log (url, old_status, new_status, reason) values (${c.url}, ${c.old}, ${c.new}, ${c.reason})`;
      await tx`truncate url_index_state`;
      for (const [url, s] of next) await tx`insert into url_index_state (url, status, reason, lastmod) values (${url}, ${s.status}, ${s.reason}, ${s.lastmod})`;
    });
    await sql.end();
  } else {
    mkdirSync(new URL('../.state/', import.meta.url), { recursive: true });
    writeFileSync(FILE, JSON.stringify([...next]));
    writeFileSync(new URL('../.state/index-status-log.jsonl', import.meta.url), changes.map((c) => JSON.stringify({ at: new Date().toISOString(), ...c })).join('\n') + (changes.length ? '\n' : ''), { flag: 'a' });
  }
  if (SITE_MODE === 'production' && INDEXNOW_KEY && ping.length) {
    const r = await pingIndexNow(ping, { host: new URL(SITE_URL).host, key: INDEXNOW_KEY });
    console.log('IndexNow:', r);
  } else if (ping.length) console.log('IndexNow skipped (needs SITE_MODE=production and INDEXNOW_KEY).');
}
