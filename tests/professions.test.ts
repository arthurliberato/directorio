import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { getDoctorBySlug, publishedDoctors } from '../src/lib/data.ts';
import { loadFromSql } from '../src/lib/db-loader.ts';
import { datasetToSql } from '../src/lib/db-seed.ts';
import { seedDataset, setDataset } from '../src/lib/dataset.ts';
import { agentNoun, factSummary, profileTitle, showsCmd, titleOf, verifiedLabel } from '../src/lib/facts.ts';
import { physicianJsonLd } from '../src/lib/schema.ts';
import { respond } from '../src/lib/whatsapp/bot.ts';
import { schemaSql } from './schema-sql.ts';

const physician = () => getDoctorBySlug('dra-maria-perez-cardiologa')!;
const dentist = () => getDoctorBySlug('dra-lucia-mena-odontologa')!;
const psychologist = () => getDoctorBySlug('ana-pena-psicologo')!;

test('wording: only physicians are "Médico verificado"; psychologists get no title or article', () => {
  assert.equal(verifiedLabel(physician()), 'Médico verificado');
  assert.equal(verifiedLabel(dentist()), 'Profesional verificado');
  assert.equal(verifiedLabel(psychologist()), 'Profesional verificado');
  assert.equal(titleOf(physician()), 'Dra.'); assert.equal(titleOf(dentist()), 'Dra.');
  assert.equal(titleOf(psychologist()), '');
  assert.equal(agentNoun(psychologist()), 'psicólogo/a', 'gender is never guessed');
  const sum = factSummary(psychologist());
  assert.match(sum, /^Ana Peña es psicólogo\/a/); assert.doesNotMatch(sum, /^(La|El) |Dr/);
  assert.doesNotMatch(profileTitle(psychologist(), 'guiddo'), /Dr\./);
  assert.match(factSummary(dentist()), /^La Dra\. Lucía Mena es odontóloga/);
});

test('the Colegio Médico badge is for physicians only', () => {
  const p = physician(); assert.equal(showsCmd(p), !!(p.doctor.cmd_member && p.doctor.cmd_verified_at));
  const d = dentist(); d.doctor.cmd_member = true; d.doctor.cmd_verified_at = '2026-09-01';
  assert.equal(showsCmd(d), false);
  d.doctor.cmd_member = false; d.doctor.cmd_verified_at = null;
});

test('schema.org type follows the profession and only uses properties the type defines', () => {
  setDataset(seedDataset());
  const phys: any = physicianJsonLd(physician()); assert.equal(phys['@type'], 'IndividualPhysician'); assert.ok(phys.practicesAt);
  const dent: any = physicianJsonLd(dentist()); assert.equal(dent['@type'], 'Dentist');
  assert.equal(dent.medicalSpecialty, 'https://schema.org/Dentistry'); assert.ok(!('practicesAt' in dent));
  const psy: any = physicianJsonLd(psychologist()); assert.equal(psy['@type'], 'Person');
  assert.equal(psy.hasOccupation.name, 'Psicólogo/a');
  for (const k of ['medicalSpecialty', 'practicesAt', 'isAcceptingNewPatients', 'paymentAccepted', 'openingHoursSpecification', 'geo']) assert.ok(!(k in psy), `Person has no ${k}`);
});

test('the bot uses the same wording', () => {
  const card = (slug: string) => JSON.stringify(respond({ kind: 'reply', replyId: `d:${slug}` }).out);
  assert.match(card('dra-maria-perez-cardiologa'), /Médico verificado/);
  assert.match(card('dra-lucia-mena-odontologa'), /Profesional verificado/);
  assert.doesNotMatch(card('ana-pena-psicologo'), /Dr\.|Dra\./);
  assert.ok(publishedDoctors().some((v) => v.specialty.profession === 'psicologo'));
});

test('database: profession round-trips, migration 008 assigns the non-physician specialties, old schemas still load', async () => {
  const db = new PGlite();
  await db.exec(schemaSql());
  for (const s of datasetToSql(seedDataset())) await db.exec(s);
  const q = async (sql: string) => (await db.query(sql)).rows as any[];
  const loaded = await loadFromSql(q);
  assert.equal(loaded.specialties.find((s) => s.slug === 'psicologos')!.profession, 'psicologo');
  assert.equal(loaded.specialties.find((s) => s.slug === 'odontologos')!.profession, 'odontologo');
  assert.equal(loaded.specialties.find((s) => s.slug === 'cardiologos')!.profession, 'medico');
  await assert.rejects(() => db.exec(`update specialties set profession = 'veterinario' where id = 1`), /check/);
  // before migration 008 the column does not exist: everyone is treated as a physician
  await db.exec('alter table specialties drop column profession');
  const old = await loadFromSql(q);
  assert.ok(old.specialties.every((s) => s.profession === 'medico'));
  await db.close();
});
