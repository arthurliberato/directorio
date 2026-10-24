import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { addMention, deleteMention, updateMention } from '../src/lib/admin-db.ts';
import { doctorMentions, getDoctorBySlug, publishedDoctors } from '../src/lib/data.ts';
import { loadFromSql } from '../src/lib/db-loader.ts';
import { datasetToSql } from '../src/lib/db-seed.ts';
import { seedDataset, setDataset } from '../src/lib/dataset.ts';
import { validateMention, type MentionInput } from '../src/lib/mentions.ts';
import { physicianJsonLd } from '../src/lib/schema.ts';
import { schemaSql } from './schema-sql.ts';

const ok: MentionInput = { kind: 'press', title: 'Entrevista', source_name: 'Medio', url: 'https://medio.example.com/a', published_on: '2026-09-01', image_url: '/img/foto.jpg', summary: 'Texto', summary_origin: 'summary', published: true };

test('validation: https only, text needs an origin, bounds', () => {
  assert.deepEqual(validateMention(ok), []);
  assert.ok(validateMention({ ...ok, url: 'http://medio.example.com/a' }).length);
  assert.ok(validateMention({ ...ok, url: 'javascript:alert(1)' }).length);
  assert.ok(validateMention({ ...ok, kind: 'blog' }).length);
  assert.ok(validateMention({ ...ok, title: 'ab' }).length);
  assert.ok(validateMention({ ...ok, summary: 'x'.repeat(601) }).length);
  assert.ok(validateMention({ ...ok, summary_origin: null }).length, 'text without origin');
  assert.deepEqual(validateMention({ ...ok, summary: null, summary_origin: null }), []);
  assert.ok(validateMention({ ...ok, published_on: '2026-13-45' }).length);
  assert.ok(validateMention({ ...ok, image_url: null }).length, 'publishing needs a photo');
  assert.deepEqual(validateMention({ ...ok, image_url: null, published: false }), [], 'drafts may lack it');
  assert.ok(validateMention({ ...ok, image_url: 'http://x.example.com/a.jpg' }).length);
  assert.ok(validateMention({ ...ok, image_url: 'javascript:alert(1)' }).length);
  assert.deepEqual(validateMention({ ...ok, image_url: 'https://cdn.example.com/a.jpg' }), []);
});

test('profile shows only published, reviewed items of verified doctors, newest first', () => {
  setDataset(seedDataset());
  const verified = publishedDoctors()[0];
  const list = doctorMentions(verified);
  assert.deepEqual(list.map((m) => m.id), [2, 1], 'draft hidden, newest first');
  // listed doctors never carry third-party content, even if a published row exists
  const listed = getDoctorBySlug('marcos-tejeda-liriano-cardiologia')!;
  assert.equal(listed.doctor.listing_status, 'listed');
  assert.deepEqual(doctorMentions(listed), []);
  // a published item without a photo is not shown
  const noPhoto = seedDataset(); noPhoto.mentions = noPhoto.mentions.map((m) => (m.id === 1 ? { ...m, image_url: null } : m)); setDataset(noPhoto);
  assert.deepEqual(doctorMentions(publishedDoctors()[0]).map((m) => m.id), [2]);
  setDataset(seedDataset());
  // a published row without a review date is not shown
  const ds = seedDataset(); ds.mentions = ds.mentions.map((m) => (m.id === 1 ? { ...m, checked_at: null } : m)); setDataset(ds);
  assert.deepEqual(doctorMentions(publishedDoctors()[0]).map((m) => m.id), [2]);
  setDataset(seedDataset());
});

test('JSON-LD lists exactly the visible items, and nothing for listed doctors', () => {
  setDataset(seedDataset());
  const ld: any = physicianJsonLd(publishedDoctors()[0]);
  assert.equal(ld.subjectOf.length, 2);
  assert.deepEqual(ld.subjectOf.map((x: any) => x.url), ['https://instagram.example.com/p/ejemplo', 'https://noticias.example.com/entrevista-prevencion']);
  assert.equal(ld.subjectOf[0]['@type'], 'SocialMediaPosting');
  assert.match(ld.subjectOf[0].image, /^https?:\/\/.+\/img\/ejemplo-publicacion\.svg$/);
  assert.ok(!('review' in ld) && !('aggregateRating' in ld));
  assert.ok(!('subjectOf' in (physicianJsonLd(getDoctorBySlug('marcos-tejeda-liriano-cardiologia')!) as any)));
});

test('database: constraints, admin writes, loader round trip, missing table tolerated', async () => {
  const db = new PGlite();
  await db.exec(schemaSql());
  for (const s of datasetToSql(seedDataset())) await db.exec(s);
  const run = async (q: string, p?: unknown[]) => (await db.query(q, p as any[])).rows as any[];

  const id = await addMention(run, 1, { ...ok, url: 'https://medio.example.com/nuevo' });
  let row = (await run('select published, checked_at from doctor_mentions where id = $1', [id]))[0];
  assert.equal(row.published, true); assert.ok(row.checked_at, 'publishing stamps the review date');
  await updateMention(run, id, { ...ok, url: 'https://medio.example.com/nuevo', published: false });
  row = (await run('select published, checked_at from doctor_mentions where id = $1', [id]))[0];
  assert.equal(row.published, false); assert.equal(row.checked_at, null);
  await assert.rejects(() => addMention(run, 1, { ...ok, url: 'https://medio.example.com/nuevo' }), /ya está guardado/);
  await assert.rejects(() => addMention(run, 1, { ...ok, url: 'http://x.example.com' }), /https/);
  // the database refuses what the form should never send
  await assert.rejects(() => db.exec(`insert into doctor_mentions (doctor_id, kind, title, source_name, url, published) values (1, 'press', 'Titulo', 'Medio', 'https://a.example.com/z', true)`), /check/);
  await assert.rejects(() => db.exec(`insert into doctor_mentions (doctor_id, kind, title, source_name, url, published, checked_at) values (1, 'press', 'Titulo', 'Medio', 'https://a.example.com/x', true, current_date)`), /check/, 'published needs a photo');
  await assert.rejects(() => db.exec(`insert into doctor_mentions (doctor_id, kind, title, source_name, url, image_url) values (1, 'press', 'Titulo', 'Medio', 'https://a.example.com/w', 'http://a.example.com/i.jpg')`), /check/);
  await assert.rejects(() => db.exec(`insert into doctor_mentions (doctor_id, kind, title, source_name, url, summary) values (1, 'press', 'Titulo', 'Medio', 'https://a.example.com/y', 'texto sin origen')`), /check/);
  await assert.rejects(() => db.exec(`insert into doctor_mentions (doctor_id, kind, title, source_name, url) values (1, 'press', 'Titulo', 'Medio', 'ftp://a.example.com/y')`), /check/);

  const loaded = await loadFromSql(async (q) => (await db.query(q)).rows as any[]);
  assert.equal(loaded.mentions.length, seedDataset().mentions.length + 1);
  assert.equal(typeof loaded.mentions[0].id, 'number'); assert.match(loaded.mentions[0].checked_at ?? '2026-01-01', /^\d{4}-\d{2}-\d{2}$/);
  await deleteMention(run, id);
  assert.equal((await run('select count(*)::int as n from doctor_mentions where id = $1', [id]))[0].n, 0);

  // rollout safety: before the migration (or the grant) exists, the snapshot still loads
  await db.exec('drop table doctor_mentions');
  const before = await loadFromSql(async (q) => (await db.query(q)).rows as any[]);
  assert.deepEqual(before.mentions, []);
  await db.close();
});
