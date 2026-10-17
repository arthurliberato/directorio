import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { schemaSql } from './schema-sql.ts';
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
  await db.exec(schemaSql());
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

import { setDoctorArs, updateDoctor, validateEdit } from '../src/lib/admin-db.ts';
test('doctor edit: validation, whitelisted update, slug rename creates 301, ARS replace', async () => {
  assert.ok(validateEdit({ slug: 'Bad Slug' }).length);
  assert.ok(validateEdit({ consultation_fee_min: 3000, consultation_fee_max: 2000 }).length);
  assert.ok(validateEdit({ phone: 'abc' }).length);
  assert.deepEqual(validateEdit({ slug: 'dra-ok-cardiologa', consultation_fee_min: 2500, phone: '+1-809-555-1234', languages: ['es', 'en'] }), []);

  const db = new PGlite();
  await db.exec(schemaSql());
  for (const s of datasetToSql(seedDataset())) await db.exec(s);
  const run: Run = async (q, p) => (await db.query(q, p as any[])).rows as any[];

  await updateDoctor(run, 1, { consultation_fee_min: 4000, consultation_fee_max: 5000, accepting_new_patients: false, languages: ['es', 'fr'] });
  const d = (await run('select consultation_fee_min, accepting_new_patients, languages from doctors where id = 1'))[0];
  assert.deepEqual(d, { consultation_fee_min: 4000, accepting_new_patients: false, languages: ['es', 'fr'] });
  await assert.rejects(() => updateDoctor(run, 1, { slug: 'guia' }), /reserved/);
  const before = (await run('select exequatur_verified_at e from doctors where id = 1'))[0].e;
  await updateDoctor(run, 1, { exequatur_verified_at: '2020-01-01' } as any); // ignored: not whitelisted
  assert.deepEqual((await run('select exequatur_verified_at e from doctors where id = 1'))[0].e, before, 'verification can only change through the audited action');
  await updateDoctor(run, 1, { slug: 'dra-renombrada-cardiologa' });
  assert.equal((await run(`select count(*)::int n from redirects where to_path = '/dra-renombrada-cardiologa'`))[0].n, 1);
  await assert.rejects(() => updateDoctor(run, 424242, { display_name: 'Dr. Nadie' }), /not found/);

  await setDoctorArs(run, 1, [4, 5]);
  assert.deepEqual((await run('select ars_id from doctor_ars where doctor_id = 1 order by 1')).map((r) => r.ars_id), [4, 5]);
  await db.close();
});

import { setConfirmedWithDoctor, updateFacility, validateFacilityEdit } from '../src/lib/admin-db.ts';
import { adminUser } from '../src/lib/admin-auth.ts';
import { missingPoints, verifiedPoints } from '../src/lib/indexing.ts';
import { getDoctorBySlug } from '../src/lib/data.ts';
test('facility edit validation + update, confirmed-with-doctor flag, missing-data helper, admin username', async () => {
  assert.ok(validateFacilityEdit({ lat: 18.47 }).length, 'lat without lng');
  assert.ok(validateFacilityEdit({ lat: 40.7, lng: -74 }).length, 'outside DR');
  assert.ok(validateFacilityEdit({ lat: -69.9, lng: 18.4 }).length, 'swapped lat/lng');
  assert.deepEqual(validateFacilityEdit({ name: 'Centro Médico X', type: 'Hospital', lat: 18.47, lng: -69.94, phone: '+1-809-555-0000' }), []);
  assert.equal(adminUser(basic('ana', 'x')), 'ana');
  const thin = getDoctorBySlug('dr-datos-minimos-pediatra')!;
  assert.deepEqual(missingPoints(thin).sort(), ['ars', 'bio', 'foto', 'horario']);
  assert.equal(5 - missingPoints(thin).length, verifiedPoints(thin));

  const db = new PGlite();
  await db.exec(schemaSql());
  for (const s of datasetToSql(seedDataset())) await db.exec(s);
  const run: Run = async (q, p) => (await db.query(q, p as any[])).rows as any[];
  await updateFacility(run, 1, { name: 'Centro Médico Nuevo', type: 'Hospital', lat: 18.5, lng: -69.9, website: 'https://x.do' });
  assert.deepEqual((await run('select name, type, lat from facilities where id = 1'))[0], { name: 'Centro Médico Nuevo', type: 'Hospital', lat: 18.5 });
  await assert.rejects(() => updateFacility(run, 1, { type: 'Spa' }), /type/);
  await assert.rejects(() => updateFacility(run, 999, { name: 'No existe' }), /not found/);
  await setConfirmedWithDoctor(run, 1, true);
  assert.equal((await run('select claimed, claimed_at is not null as at from doctors where id = 1'))[0].at, true);
  await setConfirmedWithDoctor(run, 1, false);
  assert.equal((await run('select claimed, claimed_at from doctors where id = 1'))[0].claimed, false);
  await db.close();
});


import { setListingStatus } from '../src/lib/admin-db.ts';
test('listing status: affiliated requires a verified exequátur; verifying a draft makes it listed', async () => {
  const db = new PGlite();
  await db.exec(schemaSql());
  for (const st of datasetToSql(seedDataset())) await db.exec(st);
  const run: Run = async (q, p) => (await db.query(q, p as any[])).rows as any[];
  // id 900 is an unverified draft in the seed
  await assert.rejects(() => setListingStatus(run, 900, 'affiliated'), /primero verifica el exequátur/);
  await assert.rejects(() => setListingStatus(run, 900, 'vip'), /invalid listing_status/);
  await markExequaturVerified(run, 900, { checkedBy: 'ana', method: 'pgr', result: 'valid', evidenceHash: 'b'.repeat(64) });
  assert.equal((await run('select listing_status::text s from doctors where id = 900'))[0].s, 'listed');
  await setListingStatus(run, 900, 'affiliated');
  assert.equal((await run('select listing_status::text s from doctors where id = 900'))[0].s, 'affiliated');
  await setListingStatus(run, 900, 'draft');
  assert.equal((await run('select listing_status::text s from doctors where id = 900'))[0].s, 'draft');
  await db.close();
});
