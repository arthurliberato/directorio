import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pingIndexNow } from '../src/lib/indexnow.ts';
import { computeState, diffState, overdueReverification, type StateMap } from '../src/lib/nightly.ts';
import { doctorUrls, guideUrls, hubUrls, pageUrls, facilityUrls } from '../src/lib/sitemap.ts';
import { seedDataset, setDataset } from '../src/lib/dataset.ts';

test('nightly state and sitemaps agree: indexable URLs == sitemap URLs', () => {
  const indexable = new Set([...computeState()].filter(([, s]) => s.status === 'index').map(([u]) => u));
  const sitemap = new Set([...doctorUrls(), ...hubUrls(), ...guideUrls(), ...facilityUrls(), ...pageUrls()].map((u) => u.loc));
  assert.deepEqual([...indexable].sort(), [...sitemap].sort());
});

test('diff: pings new, changed, de-indexed and removed URLs only', () => {
  const prev: StateMap = new Map([
    ['https://x/a', { status: 'index', reason: '', lastmod: '2026-10-01' }],
    ['https://x/b', { status: 'index', reason: '', lastmod: '2026-10-01' }],
    ['https://x/c', { status: 'index', reason: '', lastmod: '2026-10-01' }],
    ['https://x/d', { status: 'noindex', reason: '', lastmod: '2026-10-01' }],
    ['https://x/gone', { status: 'index', reason: '', lastmod: '2026-10-01' }],
  ]);
  const next: StateMap = new Map([
    ['https://x/a', { status: 'index', reason: '', lastmod: '2026-10-01' }],   // unchanged -> no ping
    ['https://x/b', { status: 'index', reason: '', lastmod: '2026-10-09' }],   // lastmod changed -> ping
    ['https://x/c', { status: 'noindex', reason: 'thin', lastmod: '2026-10-01' }], // de-indexed -> ping + log
    ['https://x/d', { status: 'index', reason: '5 doctors', lastmod: '2026-10-01' }], // promoted -> ping + log
    ['https://x/new', { status: 'index', reason: '', lastmod: '2026-10-02' }], // new -> ping
    ['https://x/new-thin', { status: 'noindex', reason: '', lastmod: '2026-10-02' }], // new noindex -> log, no ping
  ]);
  const { changes, ping } = diffState(prev, next);
  assert.deepEqual(ping.sort(), ['https://x/b', 'https://x/c', 'https://x/d', 'https://x/gone', 'https://x/new']);
  assert.deepEqual(changes.map((c) => `${c.old}>${c.new}`).sort(), ['index>noindex', 'index>removed', 'noindex>index', 'null>index', 'null>noindex']);
  assert.equal(diffState(next, next).ping.length, 0, 'second run with no data change pings nothing');
});

test('IndexNow batches at 10,000 URLs and sends key + keyLocation', async () => {
  const calls: any[] = [];
  const fakeFetch = (async (_u: string, init: any) => { calls.push(JSON.parse(init.body)); return { status: 200 }; }) as any;
  const urls = Array.from({ length: 10_001 }, (_, i) => `https://guiddo.net/p${i}`);
  const r = await pingIndexNow(urls, { host: 'guiddo.net', key: 'abc123', fetchImpl: fakeFetch });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].urlList.length, 10_000);
  assert.equal(calls[0].keyLocation, 'https://guiddo.net/abc123.txt');
  assert.deepEqual(r.status, [200, 200]);
});

test('re-verification: flags exequátur verified more than 6 months ago', () => {
  const ds = seedDataset();
  ds.doctors = ds.doctors.map((d, i) => (i === 0 ? { ...d, exequatur_verified_at: '2026-03-01' } : d));
  setDataset(ds);
  const overdue = overdueReverification('2026-10-15');
  setDataset(seedDataset());
  assert.equal(overdue.length, 1);
  assert.equal(overdue[0].verified_at, '2026-03-01');
  assert.equal(overdueReverification('2026-10-15').length, 0);
});
