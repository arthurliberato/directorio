import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { checkAdminAuth } from '../src/lib/admin-auth.ts';
import { markExequaturVerified, setIndexStatus, type Run } from '../src/lib/admin-db.ts';
import { datasetToSql } from '../src/lib/db-seed.ts';
import { seedDataset } from '../src/lib/dataset.ts';

const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;

test('admin auth: disabled without password, 401 on bad creds, allowed on good creds', () => {
  assert.equal(checkAdminAuth(null, {} as any)!.status, 503);
  const env = { ADMIN_PASSWORD: 's3cret', ADMIN_USER: 'ana' } as any;
  assert.equal(checkAdminAuth(null, env)!.status, 401);
  assert.equal(checkAdminAuth(basic('ana', 'wrong'), env)!.status, 401);
  assert.equal(checkAdminAuth(basic('bob', 's3cret'), env)!.status, 401);
  assert.equal(checkAdminAuth(basic('ana', 's3cret'), env), null);
  assert.equal(checkAdminAuth(basic('ana', 's3:cret'), { ...env, ADMIN_PASSWORD: 's3:cret' }), null, 'passwords may contain colons');
});

test('admin writes: index_status toggle and auditable verification', async () => {
  const db = new PGlite();
  await db.exec(readFileSync(new URL('../db/migrations/001_core.sql', import.meta.url), 'utf8').replace('create extension if not exists pgcrypto;', ''));
  for (const s of datasetToSql(seedDataset())) await db.exec(s);
  const run: Run = async (q, p) => (await db.query(q, p as any[])).rows as any[];

  await setIndexStatus(run, 901, 'force_index');
  assert.equal((await run('select index_status::text s from doctors where id = 901'))[0].s, 'force_index');
  await assert.rejects(() => setIndexStatus(run, 901, "x'; drop table doctors;--"), /invalid index_status/);
  await assert.rejects(() => setIndexStatus(run, 99999, 'auto'), /not found/);

  assert.equal((await run('select exequatur_verified_at from doctors where id = 900'))[0].exequatur_verified_at, null);
  await markExequaturVerified(run, 900, { checkedBy: 'ana', method: 'pgr-consultar-exequatur', result: 'valid', evidenceHash: 'a'.repeat(64) });
  assert.notEqual((await run('select exequatur_verified_at from doctors where id = 900'))[0].exequatur_verified_at, null);
  const log = await run('select type, checked_by from verification_log where doctor_id = 900');
  assert.deepEqual(log, [{ type: 'exequatur', checked_by: 'ana' }]);
  await assert.rejects(() => markExequaturVerified(run, 900, { checkedBy: 'ana', method: 'm', result: 'valid', evidenceHash: 'not-hex!' }), /evidenceHash/);
  await db.close();
});
