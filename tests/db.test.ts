import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { schemaSql } from './schema-sql.ts';
import { PGlite } from '@electric-sql/pglite';
import { datasetToSql } from '../src/lib/db-seed.ts';
import { loadFromSql } from '../src/lib/db-loader.ts';
import { seedDataset, setDataset } from '../src/lib/dataset.ts';
import { publishedDoctors, queryHub, getSpecialtyBySlug, getCityBySlug } from '../src/lib/data.ts';
import { resolveHub } from '../src/lib/hubs.ts';

const migration = schemaSql();

test('schema migrates, seed round-trips through Postgres, and the app reads identical results', async () => {
  const db = new PGlite();
  await db.exec(migration);
  const seed = seedDataset();
  for (const stmt of datasetToSql(seed)) await db.exec(stmt);
  const loaded = await loadFromSql(async (q) => (await db.query(q)).rows as any[]);
  assert.equal(loaded.source, 'postgres');
  assert.equal(loaded.doctors.length, seed.doctors.length);

  const counts = () => ({
    published: publishedDoctors().length,
    cardioSD: queryHub({ specialty: getSpecialtyBySlug('cardiologos')!, city: getCityBySlug('santo-domingo')! }).length,
    hub: (() => { const r = resolveHub(['cardiologos', 'santo-domingo']); return r.status === 'ok' ? r.stats.feeMedian : null; })(),
  });
  setDataset(seed); const fromSeed = counts();
  setDataset(loaded); const fromPg = counts();
  setDataset(seed);
  assert.deepEqual(fromPg, fromSeed);
  await db.close();
});

test('DB rejects reserved doctor slugs and records 301s on slug change', async () => {
  const db = new PGlite();
  await db.exec(migration);
  for (const stmt of datasetToSql(seedDataset())) await db.exec(stmt);
  await assert.rejects(() => db.exec(`update doctors set slug = 'guia' where id = 1`), /reserved/);
  await assert.rejects(() => db.exec(`update doctors set slug = 'cardiologos' where id = 1`), /reserved/);
  await assert.rejects(() => db.exec(`update doctors set slug = 'Bad Slug' where id = 1`));
  await db.exec(`update doctors set slug = 'dra-nueva-cardiologa' where id = 1`);
  const r = await db.query(`select to_path from redirects where to_path = '/dra-nueva-cardiologa'`);
  assert.equal(r.rows.length, 1);
  const overdue = await db.query(`select count(*)::int as n from doctors_needing_reverification`);
  assert.ok(overdue.rows.length === 1);
  await db.close();
});

test('appointment requests: insert, mark forwarded, list (migration 006)', async () => {
  const { insertRequest, markRequest, listRequests } = await import('../src/lib/whatsapp/appointments.ts');
  const db = new PGlite();
  await db.exec(migration);
  for (const stmt of datasetToSql(seedDataset())) await db.exec(stmt);
  const run = async (q: string, p?: unknown[]) => (await db.query(q, p as any[])).rows as any[];
  const doctorId = seedDataset().doctors.find((d) => d.listing_status === 'affiliated')!.id;
  const id = await insertRequest(run, { doctorId, phone: '18095557777', message: 'María, martes' });
  await markRequest(run, id, 'forwarded');
  const rows = await listRequests(run);
  assert.equal(rows.length, 1); assert.equal(rows[0].status, 'forwarded'); assert.ok(rows[0].forwarded_at);
  await markRequest(run, id, 'failed', 'boom');
  assert.equal((await listRequests(run))[0].error, 'boom');
});

test('bot_pending store and hourly request count (migration 007)', async () => {
  const { dbPending, insertRequest, countRecent } = await import('../src/lib/whatsapp/appointments.ts');
  const db = new PGlite();
  await db.exec(migration);
  for (const stmt of datasetToSql(seedDataset())) await db.exec(stmt);
  const run = async (q: string, p?: unknown[]) => (await db.query(q, p as any[])).rows as any[];
  const store = dbPending(run);
  assert.equal(await store.get('1809'), null);
  await store.set('1809', 'dra-x'); await store.set('1809', 'dra-y');
  assert.equal(await store.get('1809'), 'dra-y');
  await run("update bot_pending set created_at = now() - interval '31 minutes'");
  assert.equal(await store.get('1809'), null, 'expires after 30 minutes');
  await store.set('1809', 'dra-x'); await store.clear('1809');
  assert.equal(await store.get('1809'), null);
  const doctorId = seedDataset().doctors.find((d) => d.listing_status === 'affiliated')!.id;
  await insertRequest(run, { doctorId, phone: '1809', message: 'a' }); await insertRequest(run, { doctorId, phone: '1809', message: 'b' });
  assert.equal(await countRecent(run, '1809'), 2); assert.equal(await countRecent(run, '1810'), 0);
});
