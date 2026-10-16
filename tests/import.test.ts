import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { hashCedula, importDoctors, normalizePhone, parseCsv, parseSchedule, type Run } from '../src/lib/import.ts';

const sqlFile = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('CSV parser: quotes, embedded delimiters/newlines, BOM, semicolon auto-detect', () => {
  const rows = parseCsv('﻿a;b;c\r\n1;"x;y";"line1\nline2"\r\n2;"q ""z""";\r\n');
  assert.deepEqual(rows, [{ a: '1', b: 'x;y', c: 'line1\nline2' }, { a: '2', b: 'q "z"', c: '' }]);
  assert.deepEqual(parseCsv('a,b\n1,2\n'), [{ a: '1', b: '2' }]);
});

test('schedule parser: ranges, lists, wraparound, validation', () => {
  assert.deepEqual(parseSchedule('lun-mie 8:00-12:00').map((e) => e.day), [1, 2, 3]);
  assert.deepEqual(parseSchedule('lun-mie 8:00-12:00')[0], { day: 1, open: '08:00', close: '12:00' });
  assert.deepEqual(parseSchedule('lun,mié,vie 14:00-18:00; sáb 09:00-12:00').map((e) => e.day), [1, 3, 5, 6]);
  assert.deepEqual(parseSchedule('vie-lun 08:00-12:00').map((e) => e.day), [1, 5, 6, 7]);
  assert.throws(() => parseSchedule('lunes todo el día'));
  assert.throws(() => parseSchedule('lun 12:00-08:00'));
  assert.throws(() => parseSchedule('xyz 08:00-12:00'));
});

test('phones normalize to DR format; cédula is hashed, never raw', () => {
  assert.deepEqual(normalizePhone('809-555-0100'), { display: '+1-809-555-0100', wa: '+18095550100' });
  assert.deepEqual(normalizePhone('(829) 555 0100'), { display: '+1-829-555-0100', wa: '+18295550100' });
  assert.equal(normalizePhone('12345'), null);
  const h = hashCedula('001-0000000-1', 'pepper');
  assert.match(h, /^[a-f0-9]{64}$/); assert.ok(!h.includes('0000000'));
  assert.equal(h, hashCedula('00100000001', 'pepper'));
  assert.notEqual(h, hashCedula('00100000001', 'other'));
  assert.throws(() => hashCedula('123', 'p'));
});

test('import: loads reference data + example CSV, never publishes, is idempotent, reports row errors', async () => {
  const db = new PGlite();
  await db.exec(sqlFile('../db/migrations/001_core.sql').replace('create extension if not exists pgcrypto;', ''));
  await db.exec(sqlFile('../db/reference/001_reference_data.sql'));
  const run: Run = async (q, p) => (await db.query(q, p as any[])).rows as any[];
  const csv = readFileSync(new URL('../templates/doctors.example.csv', import.meta.url), 'utf8');
  const rows = parseCsv(csv);

  const dry = await importDoctors(run, rows, { dryRun: true, pepper: 'p' });
  assert.deepEqual([dry.inserted, dry.errors.length], [1, 0]);
  assert.equal((await run('select count(*)::int n from doctors'))[0].n, 0, 'dry run rolls back');

  const rep = await importDoctors(run, rows, { pepper: 'p' });
  assert.deepEqual([rep.inserted, rep.updated, rep.errors.length], [1, 0, 0]);
  assert.deepEqual(rep.createdFacilities, ['Centro Médico Ejemplo']);
  const d = (await run('select * from doctors'))[0];
  assert.equal(d.slug, 'dra-ejemplo-prueba-cardiologa');
  assert.equal(d.exequatur_verified_at, null, 'imports are never verified/published');
  assert.match(d.cedula_hash, /^[a-f0-9]{64}$/);
  assert.equal(d.whatsapp, '+18095550100'); assert.equal(d.phone, '+1-809-555-0101');
  assert.deepEqual(d.languages, ['es', 'en']); assert.deepEqual(d.subspecialties, ['Ecocardiografía', 'Cardiología preventiva']);
  const loc = (await run('select schedule, facility_id from locations'))[0];
  assert.equal(loc.schedule.length, 5); assert.ok(loc.facility_id);
  assert.equal((await run('select count(*)::int n from doctor_ars'))[0].n, 3);

  // re-import updates, never duplicates
  rows[0].fee_min = '3000';
  const again = await importDoctors(run, rows, { pepper: 'p' });
  assert.deepEqual([again.inserted, again.updated], [0, 1]);
  assert.equal((await run('select count(*)::int n from doctors'))[0].n, 1);
  assert.equal((await run('select consultation_fee_min m from doctors'))[0].m, 3000);
  assert.equal((await run('select count(*)::int n from locations'))[0].n, 1);

  // bad rows are reported with line numbers and don't block good rows
  const bad = parseCsv(csv); const good = { ...bad[0], exequatur_number: 'EX-2', display_name: 'Dr. Otro Medico', full_legal_name: 'Otro Medico', specialty: 'pediatras', sector: 'Nuevo Sector' };
  const mixed = await importDoctors(run, [{ ...bad[0], exequatur_number: 'EX-3', specialty: 'brujos', city: 'Atlantis', schedule: 'siempre' }, good], { pepper: 'p' });
  assert.deepEqual([mixed.inserted, mixed.errors.length], [1, 1]);
  assert.equal(mixed.errors[0].line, 2); assert.ok(mixed.errors[0].messages.length >= 3);
  assert.deepEqual(mixed.createdSectors, ['Nuevo Sector (santo-domingo)']);
  // cédula without pepper is refused rather than stored raw
  const nopep = await importDoctors(run, [{ ...bad[0], exequatur_number: 'EX-4' }], {});
  assert.match(nopep.errors[0].messages.join(), /CEDULA_PEPPER/);
  // same-name doctors disambiguate with city, never "-2"
  const dup = await importDoctors(run, [{ ...bad[0], exequatur_number: 'EX-5', cedula: '' }], {});
  assert.equal(dup.inserted, 1);
  assert.deepEqual((await run('select slug from doctors where exequatur_number = $1', ['EX-5'])).map((r) => r.slug), ['dra-ejemplo-prueba-cardiologa-santo-domingo']);
  await db.close();
});
