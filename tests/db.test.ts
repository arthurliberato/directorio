import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { datasetToSql } from '../src/lib/db-seed.ts';
import { loadFromSql } from '../src/lib/db-loader.ts';
import { seedDataset, setDataset } from '../src/lib/dataset.ts';
import { publishedDoctors, queryHub, getSpecialtyBySlug, getCityBySlug } from '../src/lib/data.ts';
import { resolveHub } from '../src/lib/hubs.ts';

const migration = readFileSync(new URL('../db/migrations/001_core.sql', import.meta.url), 'utf8').replace('create extension if not exists pgcrypto;', '');

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
