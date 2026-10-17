import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { schemaSql } from './schema-sql.ts';
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
  await db.exec(schemaSql());
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
  // specialty may be written naturally
  const natural = await importDoctors(run, [{ ...bad[0], exequatur_number: 'EX-6', cedula: '', specialty: 'Cardióloga', display_name: 'Dra. Natural Prueba', full_legal_name: 'Natural Prueba' }, { ...bad[0], exequatur_number: 'EX-7', cedula: '', specialty: 'Pediatría', display_name: 'Dr. Natural Dos', full_legal_name: 'Natural Dos' }], {});
  assert.deepEqual([natural.inserted, natural.errors.length], [2, 0]);
  // cédula without pepper is refused rather than stored raw
  const nopep = await importDoctors(run, [{ ...bad[0], exequatur_number: 'EX-4' }], {});
  assert.match(nopep.errors[0].messages.join(), /CEDULA_PEPPER/);
  // same-name doctors disambiguate with city, never "-2"
  const dup = await importDoctors(run, [{ ...bad[0], exequatur_number: 'EX-5', cedula: '' }], {});
  assert.equal(dup.inserted, 1);
  assert.deepEqual((await run('select slug from doctors where exequatur_number = $1', ['EX-5'])).map((r) => r.slug), ['dra-ejemplo-prueba-cardiologa-santo-domingo']);
  await db.close();
});

import { importFacilities, isFacilitiesCsv } from '../src/lib/import.ts';
test('public-source listings: facilities first, then doctors without exequátur/gender/sector; never affiliated; no assumed languages', async () => {
  const db = new PGlite();
  await db.exec(schemaSql());
  await db.exec(sqlFile('../db/reference/001_reference_data.sql'));
  await db.exec(sqlFile('../db/reference/002_more_specialties.sql'));
  const run: Run = async (q, p) => (await db.query(q, p as any[])).rows as any[];

  const facCsv = 'name;type;address;city;sector;phone;website;lat;lng\nHospital Metropolitano de Santiago;Hospital;Autopista Juan Pablo Duarte Km 2.8;Santiago;;+1 829‑947‑2222;https://homs.com.do;;\nClínica Corominas;Clínica;Calle Restauración 57;Santiago;;809‑580‑1171;;;\n';
  const facRows = parseCsv(facCsv);
  assert.ok(isFacilitiesCsv(facRows));
  const fr = await importFacilities(run, facRows);
  assert.deepEqual([fr.inserted, fr.errors.length], [2, 0]);
  assert.deepEqual((await run('select name, type, phone from facilities order by name')).map((r) => `${r.name}|${r.type}|${r.phone}`), ['Clínica Corominas|MedicalClinic|+1-809-580-1171', 'Hospital Metropolitano de Santiago|Hospital|+1-829-947-2222']);

  const rows = parseCsv([
    'display_name,specialty,city,facility,suite,phone_ext,clinic_phone,source_name,source_url,source_retrieved_at,listing_status,subspecialties,education',
    'Eddy A. Peralta Jiménez,Psiquiatría,Santiago,Hospital Metropolitano de Santiago,"405, HOMS Health and Wellness Center, 4.º",,+1 829‑947‑2222,HOMS,https://homs.com.do/medico/eddy-a-peralta-jimenez/,2026-10-16,listed,Estimulación magnética transcraneal,"MD PUCMM; posgrado en Psiquiatría"',
    'Glenny Paulino,Medicina interna,Santiago,Hospital Metropolitano de Santiago,"1010, Edificio Profesional, 10.º",60402,829-947-2222,HOMS,https://homs.com.do/medico/glenny/,2026-10-16,listed,,',
    'Dra. Ana Prueba,Cardiología,Santiago,Clínica Corominas,torre A,,809-580-1171,Corominas,https://directoriocorominas.com/doctor/ana,2026-10-16,affiliated,,',
  ].join('\n'));
  const rep = await importDoctors(run, rows, {});
  assert.deepEqual([rep.inserted, rep.errors.length], [2, 1]);
  assert.match(rep.errors[0].messages.join(), /affiliated.*no se puede importar/);
  const d = (await run(`select d.*, l.suite, l.phone_ext, l.phone lphone, l.address, l.sector_id from doctors d join locations l on l.doctor_id = d.id where d.display_name = 'Eddy A. Peralta Jiménez'`))[0];
  assert.equal(d.slug, 'eddy-a-peralta-jimenez-psiquiatria', 'unknown gender => neutral slug');
  assert.equal(d.gender, null); assert.equal(d.exequatur_number, null); assert.equal(d.listing_status, 'listed');
  assert.deepEqual(d.languages, [], 'languages are not assumed');
  assert.equal(d.phone, null, 'the clinic switchboard is never stored as the doctor\'s own phone');
  assert.equal(d.lphone, '+1-829-947-2222'); assert.equal(d.suite, '405, HOMS Health and Wellness Center, 4.º');
  assert.equal(d.address, 'Autopista Juan Pablo Duarte Km 2.8', 'address falls back to the clinic\'s'); assert.equal(d.sector_id, null);
  assert.equal(d.source_name, 'HOMS'); assert.equal(d.source_retrieved_at.toISOString().slice(0, 10), '2026-10-16');
  assert.equal((await run(`select phone_ext from locations l join doctors d on d.id = l.doctor_id where d.display_name = 'Glenny Paulino'`))[0].phone_ext, '60402');

  // re-import is idempotent for doctors without an exequátur number (same name + specialty + city)
  const again = await importDoctors(run, rows.slice(0, 2), {});
  assert.deepEqual([again.inserted, again.updated], [0, 2]);
  assert.equal((await run('select count(*)::int n from doctors'))[0].n, 2);
  await db.close();
});
