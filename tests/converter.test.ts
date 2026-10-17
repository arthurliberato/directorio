import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convert, mapSpecialty } from '../scripts/compilation-to-csv.ts';

const MD = `
### A. Hospital Metropolitano de Santiago (HOMS), Santiago

| Nombre | Especialidad | Clínica | Dirección (consultorio) | Teléfono | Formación | Fuente |
|---|---|---|---|---|---|---|
| Elio A. Prueba Jiménez | Psiquiatría | HOMS | 405, HOMS Health and Wellness Center, 4.º | Central 829‑947‑2222 | MD PUCMM; posgrado en Psiquiatría | https://homs.com.do/medico/elio-a-prueba-jimenez/ \\[20\\] |
| Andrés Ficticio Núñez | Ortopedia y Traumatología (columna, cadera) | HOMS | 402, Edificio Profesional, 4.º | 829‑947‑2222 ext. 60402; 829‑947‑2402 | ND | ídem\\[22\\] |
| Cecilia Ejemplo | Neurología (Parkinson) | HOMS y CEDIMAT | 312, HHWC, 3.º | Central 829‑947‑2222 | ND | https://homs.com.do/medico/cecilia-ejemplo/ |
| Karla Del Ejemplo | Neurología | HOMS | 713, HHWC, 7.º | 809‑707‑0621 (publicado en ficha) | ND | https://homs.com.do/medico/karla-del-ejemplo/ |

### D. Clínica Unión Médica del Norte, Santiago

| Nombre | Especialidad | Consultorio | Teléfono | Formación | Fuente |
|---|---|---|---|---|---|
| Rita Ejemplo Acevedo | Otorrinolaringología | Torre B, nivel 3, suite 315 | (809) 226‑8686 ext. 4315 | ND | https://sociedaddominicanaotorrino.org.do/doctores/dra-rita-ejemplo-acevedo/ |
| Yara Ficticia Ruiz | ORL – cirugía endoscópica nasal y de base de cráneo; tel. (809) 540‑9775 | Torre A | Central | ND | https://sociedaddominicanaotorrino.org.do/doctores/yara-ficticia-ruiz/ |

### H. Santo Domingo – CEDIMAT (C/ Pepillo Salcedo)

| Nombre | Especialidad / cargo | Fuente |
|---|---|---|
| Camilo Ejemplo; Mauro Ficticio | Urología | https://diariosalud.do/x |
| Rafael Ficticio; Walter Ejemplo | Cardiología; Urología (tel. 809‑565‑9989) | https://www.eda.admin.ch/x.pdf |
| Alba De Ejemplo | Directora Médica | https://linkedin.com/x |
`;

test('specialty mapping picks the specific specialty and drops roles/phones', () => {
  assert.deepEqual(mapSpecialty('Medicina Interna, Neumología'), { slug: 'neumologos', subs: ['Medicina Interna'] });
  assert.equal(mapSpecialty('Cardiología, Medicina Interna')?.slug, 'cardiologos');
  assert.equal(mapSpecialty('Medicina Interna, Terapia Intensiva')?.slug, 'internistas');
  assert.equal(mapSpecialty('ORL – Cabeza y Cuello')?.slug, 'otorrinolaringologos');
  assert.equal(mapSpecialty('Directora Médica'), null);
  assert.ok(!mapSpecialty('Neumología / Medicina Interna; director médico')!.subs.some((s) => /director/i.test(s)));
});

test('compilation converter: clinics, extensions, gender only from explicit evidence, no personal numbers', () => {
  const { doctors, facilities, report } = convert(MD);
  const by = (n: string) => doctors.find((d) => d.display_name === n)!;
  assert.deepEqual(facilities.map((f) => f.name).sort(), ['CEDIMAT', 'Clínica Unión Médica del Norte', 'Hospital Metropolitano de Santiago']);
  const eddy = by('Elio A. Prueba Jiménez');
  assert.deepEqual([eddy.specialty, eddy.city, eddy.facility, eddy.suite, eddy.clinic_phone, eddy.source_name, eddy.listing_status], ['psiquiatras', 'Santiago', 'Hospital Metropolitano de Santiago', '405, HOMS Health and Wellness Center, 4.º', '+1 829-947-2222', 'HOMS', 'listed']);
  assert.equal(eddy.gender, '', 'HOMS URL has no dr/dra evidence: gender stays unknown');
  const andres = by('Andrés Ficticio Núñez');
  assert.equal(andres.phone_ext, '60402'); assert.equal(andres.source_url, 'https://homs.com.do/medico/elio-a-prueba-jimenez/', 'ídem inherits the previous source');
  assert.match(andres.subspecialties, /columna/);
  assert.match(by('Cecilia Ejemplo').bio, /También consta en: CEDIMAT/);
  assert.equal(by('Rita Ejemplo Acevedo').gender, 'f'); assert.equal(by('Rita Ejemplo Acevedo').phone_ext, '4315');
  const yancy = by('Yara Ficticia Ruiz');
  assert.ok(!/540|9775/.test(JSON.stringify(yancy)), 'the doctor\'s direct number from the source text never leaks into a field');
  assert.equal(yancy.gender, '');
  // no personal/mobile numbers anywhere in the output
  assert.ok(!JSON.stringify(doctors).includes('707') && !JSON.stringify(doctors).includes('2402'));
  // multi-name rows: shared and pairwise specialties
  assert.equal(by('Camilo Ejemplo').specialty, 'urologos'); assert.equal(by('Mauro Ficticio').specialty, 'urologos');
  assert.equal(by('Rafael Ficticio').specialty, 'cardiologos'); assert.equal(by('Walter Ejemplo').specialty, 'urologos');
  assert.ok(report.unmapped.some((u) => u.includes('Alba De Ejemplo')));
});
