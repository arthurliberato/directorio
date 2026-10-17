// Converts the research compilation (markdown tables of clinics and doctors) into two import-ready CSVs:
//   centros.csv  (facilities)   and   medicos-listados.csv  (public-source "listed" doctors)
// Usage: node scripts/compilation-to-csv.ts compilation.md out-dir
// Conservative by design: no direct/mobile numbers (only the clinic switchboard + extension), no guessed gender,
// ambiguous rows are skipped and reported. The output is personal-data-bearing: do not commit it.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { slugify } from '../src/lib/slugs.ts';

const RETRIEVED = '2026-10-01'; // the compilation's cut-off date

// ---- Clinic registry (facts stated in the compilation itself; unknown details are left blank) ---------------------
interface Clinic { key: string; name: string; type: 'Hospital' | 'Clínica'; address: string; city: string; sector: string; phone: string; website: string; note?: string }
const CLINICS: Clinic[] = [
  { key: 'homs', name: 'Hospital Metropolitano de Santiago', type: 'Hospital', address: 'Autopista Juan Pablo Duarte Km 2.8', city: 'Santiago', sector: '', phone: '+1 829-947-2222', website: 'https://homs.com.do' },
  { key: 'corominas', name: 'Clínica Corominas', type: 'Clínica', address: 'Calle Restauración 57', city: 'Santiago', sector: '', phone: '809-580-1171', website: '' },
  { key: 'cibao', name: 'Centro Médico Cibao-UTESA', type: 'Clínica', address: 'Av. Juan Pablo Duarte', city: 'Santiago', sector: '', phone: '809-582-6661', website: '', note: 'número de la dirección por confirmar' },
  { key: 'union', name: 'Clínica Unión Médica del Norte', type: 'Clínica', address: 'Av. Juan Pablo Duarte 176', city: 'Santiago', sector: '', phone: '809-226-8686', website: '' },
  { key: 'hospiten-sd', name: 'Hospiten Santo Domingo', type: 'Hospital', address: 'Av. Alma Máter esq. Av. Simón Bolívar', city: 'Santo Domingo', sector: '', phone: '+1 809-541-3000', website: 'https://hospiten.com' },
  { key: 'hospiten-bavaro', name: 'Hospiten Bávaro', type: 'Hospital', address: 'Carretera Verón–Punta Cana 106', city: 'Bávaro', sector: '', phone: '', website: 'https://hospiten.com' },
  { key: 'img', name: 'Hospital IMG', type: 'Hospital', address: 'Bávaro, La Altagracia', city: 'Bávaro', sector: '', phone: '', website: 'https://www.img.hospital', note: 'dirección por completar' },
  { key: 'cmpc', name: 'Centro Médico Punta Cana', type: 'Clínica', address: 'Bávaro, La Altagracia', city: 'Bávaro', sector: '', phone: '', website: '', note: 'dirección por completar' },
  { key: 'bournigal', name: 'Centro Médico Bournigal', type: 'Clínica', address: 'Calle Antera Mota esq. Dr. Zafra', city: 'Puerto Plata', sector: '', phone: '809-586-2342', website: '' },
  { key: 'cedimat', name: 'CEDIMAT', type: 'Hospital', address: 'C/ Pepillo Salcedo esq. Arturo Logroño, Plaza de la Salud', city: 'Santo Domingo', sector: 'Ensanche La Fe', phone: '809-565-9989', website: 'https://cedimat.com' },
  { key: 'hgps', name: 'Hospital General de la Plaza de la Salud', type: 'Hospital', address: 'Av. Ortega y Gasset', city: 'Santo Domingo', sector: 'Ensanche La Fe', phone: '809-565-7477', website: '' },
  { key: 'moderno', name: 'Centro Médico Moderno', type: 'Clínica', address: 'Av. Charles Sumner esq. José López', city: 'Santo Domingo', sector: 'Los Prados', phone: '', website: '' },
  { key: 'uce', name: 'Centro Médico UCE', type: 'Clínica', address: 'Av. Pedro H. Ureña 79', city: 'Santo Domingo', sector: 'La Esperilla', phone: '', website: '' },
  { key: 'abreu', name: 'Clínica Abreu', type: 'Clínica', address: 'Calle Arzobispo Portes 853', city: 'Santo Domingo', sector: 'Gazcue', phone: '809-688-4411', website: '' },
  { key: 'corazones', name: 'Clínica Corazones Unidos', type: 'Clínica', address: 'Calle Padre Fantino Falco 21', city: 'Santo Domingo', sector: 'Naco', phone: '809-567-4421', website: '' },
  { key: 'real', name: 'Centro Médico Real', type: 'Clínica', address: 'Av. Rómulo Betancourt 515', city: 'Santo Domingo', sector: '', phone: '809-537-3940', website: '' },
  { key: 'dominicano', name: 'Centro Médico Dominicano', type: 'Clínica', address: 'Santo Domingo, D.N.', city: 'Santo Domingo', sector: '', phone: '', website: '', note: 'dirección por completar' },
  { key: 'corominas-pepin', name: 'Centro Médico Corominas Pepín', type: 'Clínica', address: 'C/ Prof. Aliro Paulino 11', city: 'Santo Domingo', sector: 'Naco', phone: '809-221-5501', website: '' },
];
const CLINIC_ALIASES: [RegExp, string][] = [
  [/corominas pep[ií]n/i, 'corominas-pepin'], [/\bcorominas\b/i, 'corominas'], [/\bHOMS\b|metropolitano de santiago/i, 'homs'], [/cibao/i, 'cibao'], [/uni[oó]n m[eé]dica/i, 'union'],
  [/hospiten b[aá]varo/i, 'hospiten-bavaro'], [/hospiten/i, 'hospiten-sd'], [/\bIMG\b/, 'img'], [/centro m[eé]dico punta cana/i, 'cmpc'], [/bournigal/i, 'bournigal'],
  [/cedimat/i, 'cedimat'], [/\bHGPS\b|plaza de la salud(?!,)/i, 'hgps'], [/moderno/i, 'moderno'], [/\bUCE\b/, 'uce'], [/abreu/i, 'abreu'], [/corazones unidos/i, 'corazones'],
  [/centro m[eé]dico real/i, 'real'], [/centro m[eé]dico dominicano/i, 'dominicano'],
];
const clinicOf = (cell: string): { primary: Clinic | null; others: string[] } => {
  // every clinic mentioned, in order of appearance; matched text is blanked so "Corominas Pepín" does not also match "Corominas"
  let work = cell; const hits: { at: number; clinic: Clinic }[] = [];
  for (const [re, key] of CLINIC_ALIASES) {
    const m = re.exec(work);
    if (m) { hits.push({ at: m.index, clinic: CLINICS.find((x) => x.key === key)! }); work = work.slice(0, m.index) + ' '.repeat(m[0].length) + work.slice(m.index + m[0].length); }
  }
  const found = hits.sort((a, b) => a.at - b.at).map((h) => h.clinic).filter((c, i, a) => a.indexOf(c) === i);
  return { primary: found[0] ?? null, others: found.slice(1).map((c) => c.name) };
};

// ---- Specialty mapping ------------------------------------------------------------------------------------------
const SPEC_RULES: [RegExp, string][] = [
  [/hematolog[ií]a/i, 'hematologos'], [/cirug[ií]a oncol[oó]gica/i, 'cirujanos-oncologos'], [/ginecolog[ií]a oncol[oó]gica/i, 'ginecologos'],
  [/cardiolog[ií]a|hemodinamia/i, 'cardiologos'], [/neumolog[ií]a/i, 'neumologos'], [/otorrino|\bORL\b/i, 'otorrinolaringologos'],
  [/ortopedia|traumatolog[ií]a/i, 'ortopedas'], [/ginecolog[ií]a|obstetricia|perinatolog[ií]a/i, 'ginecologos'], [/neonatolog[ií]a/i, 'neonatologos'],
  [/pediatr[ií]a/i, 'pediatras'], [/hepatolog[ií]a/i, 'hepatologos'], [/gastroenterolog[ií]a/i, 'gastroenterologos'], [/dermatolog[ií]a/i, 'dermatologos'],
  [/neurocirug[ií]a/i, 'neurocirujanos'], [/neurolog[ií]a/i, 'neurologos'], [/psiquiatr[ií]a/i, 'psiquiatras'], [/reumatolog[ií]a/i, 'reumatologos'],
  [/nefrolog[ií]a/i, 'nefrologos'], [/endocrinolog[ií]a/i, 'endocrinologos'], [/infectolog[ií]a/i, 'infectologos'], [/oncolog[ií]a/i, 'oncologos'],
  [/urolog[ií]a/i, 'urologos'], [/cirug[ií]a pl[aá]stica/i, 'cirujanos-plasticos'], [/cirug[ií]a maxilofacial|bucomaxilofacial|craneofacial/i, 'cirujanos-maxilofaciales'],
  [/cirug[ií]a tor[aá]cica/i, 'cirujanos-toracicos'], [/cirug[ií]a (general|de trasplante)/i, 'cirujanos-generales'], [/flebolog[ií]a/i, 'cirujanos-vasculares'],
  [/geriatr[ií]a/i, 'geriatras'], [/nutrici[oó]n|nutriolog[ií]a/i, 'nutriologos'], [/radiolog[ií]a|sonograf[ií]a|im[aá]genes/i, 'radiologos'], [/anestesiolog[ií]a/i, 'anestesiologos'],
  [/oftalmolog[ií]a/i, 'oftalmologos'], [/medicina interna/i, 'internistas'], [/terapia intensiva|intensivista|medicina cr[ií]tica|\bUCI\b/i, 'intensivistas'],
];
const GENERIC = new Set(['internistas', 'intensivistas']);
export function mapSpecialty(cell: string): { slug: string; subs: string[] } | null {
  const clean = cell.replace(/\((?:también|tambi[eé]n)[^)]*\)?/gi, '').replace(/\(([^)]*)\)/g, (_m, inner) => `, ${inner}`).replace(/Cabeza y Cuello/gi, 'Cabeza\u0001y\u0001Cuello');
  const tokens = clean.split(/[,;–—/]| y (?=[A-ZÁÉÍÓÚ])/).map((t) => t.replace(/\u0001/g, ' ').trim()).filter(Boolean);
  const mapped = tokens.map((t) => ({ t, slug: SPEC_RULES.find(([re]) => re.test(t))?.[1] ?? null }));
  const known = mapped.filter((m) => m.slug);
  if (!known.length) return null;
  const specific = known.filter((m) => !GENERIC.has(m.slug!));
  const primary = (specific[0] ?? known[0]);
  const noise = /director|directora|coordina|jefe|encargad|tambi[eé]n|consultorio|calle |torre |^\W*$|^.{0,2}$/i;
  const subs = tokens.filter((t) => t !== primary.t && !noise.test(t) && !/^(internista|hospiten|naco|neumología|neumologia)$/i.test(t) || /^terapia intensiva$/i.test(t));
  return { slug: primary.slug!, subs: [...new Set(subs.map((s) => s.replace(/\s+/g, ' ')))] };
}

// ---- Markdown parsing -------------------------------------------------------------------------------------------
const clean = (s: string) => s.replace(/\\\[\d+\\\]/g, '').replace(/\\\[|\\\]/g, '').replace(/‑/g, '-').replace(/\s+/g, ' ').trim();
const isND = (s: string) => !s || /^(ND|—|-|n\/d)$/i.test(s);
interface Table { section: string; header: string[]; rows: string[][] }
function parseTables(md: string): Table[] {
  const out: Table[] = []; let section = ''; let cur: Table | null = null;
  for (const line of md.split(/\r?\n/)) {
    if (/^###? /.test(line)) { section = line.replace(/^#+\s*/, ''); cur = null; continue; }
    if (!line.startsWith('|')) { cur = null; continue; }
    const cells = line.replace(/^\||\|\s*$/g, '').split('|').map((c) => clean(c));
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
    if (!cur) { cur = { section, header: cells.map((h) => h.toLowerCase()), rows: [] }; out.push(cur); } else cur.rows.push(cells);
  }
  return out.filter((t) => t.header[0] === 'nombre');
}
const col = (t: Table, ...names: string[]) => t.header.findIndex((h) => names.some((n) => h.startsWith(n)));

const SOURCE_NAMES: [RegExp, string][] = [
  [/homs\.com\.do/, 'HOMS'], [/directoriocorominas/, 'Directorio Corominas'], [/centromedicocibao|cmc\.com\.do/, 'Centro Médico Cibao-UTESA'], [/hospiten\.com/, 'Hospiten'],
  [/sociedaddominicanaotorrino/, 'Sociedad Dominicana de Otorrinolaringología'], [/sdnct/, 'Sociedad Dominicana de Neumología y Cirugía de Tórax'], [/corazonesunidos/, 'Clínica Corazones Unidos'],
  [/img\.hospital/, 'Hospital IMG'], [/cedimat\.com/, 'CEDIMAT'], [/listindiario/, 'Listín Diario'], [/diariosalud/, 'Diario Salud'], [/whatclinic/, 'WhatClinic'], [/linkedin/, 'LinkedIn'],
  [/paginasamarillas/, 'Páginas Amarillas'], [/eda\.admin\.ch/, 'Embajada de Suiza'], [/drhernan/, 'Sitio del médico'],
];
const firstUrl = (cell: string) => cell.match(/https?:\/\/[^\s;)\],]+/)?.[0] ?? '';
const sourceName = (url: string) => SOURCE_NAMES.find(([re]) => re.test(url))?.[1] ?? (url ? new URL(url).hostname.replace(/^www\./, '') : '');
const genderFromUrl = (url: string) => (/\/dra-/.test(url) ? 'f' : /\/dr-/.test(url) ? 'm' : '');

// ---- Build rows -------------------------------------------------------------------------------------------------
const csvEsc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const toCsv = (cols: string[], rows: Record<string, string>[]) => '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvEsc(r[c] ?? '')).join(','))].join('\n') + '\n';

const DOCTOR_COLS = ['display_name', 'full_legal_name', 'gender', 'specialty', 'subspecialties', 'education', 'bio', 'city', 'facility', 'suite', 'phone_ext', 'clinic_phone', 'source_name', 'source_url', 'source_retrieved_at', 'listing_status'];
const FACILITY_COLS = ['name', 'type', 'address', 'city', 'sector', 'phone', 'website'];

const SECTION_DEFAULT: [RegExp, string][] = [[/^A\./, 'homs'], [/^B\./, 'corominas'], [/^C\./, 'cibao'], [/^D\./, 'union'], [/^E\./, 'hospiten-sd'], [/^G\./, 'bournigal'], [/^H\./, 'cedimat']];

export function convert(md: string) {
  const report = { skipped: [] as string[], unmapped: [] as string[], merged: 0, noClinic: [] as string[] };
  const byKey = new Map<string, Record<string, string>>();
  const usedClinics = new Set<string>();

  for (const t of parseTables(md)) {
    const iName = col(t, 'nombre'), iSpec = col(t, 'especialidad'), iClin = col(t, 'clínica'), iSuite = col(t, 'consultorio', 'dirección (consultorio)'), iPhone = col(t, 'teléfono'), iEdu = col(t, 'formación'), iSrc = col(t, 'fuente');
    const defaultKey = SECTION_DEFAULT.find(([re]) => re.test(t.section))?.[1] ?? null;
    let lastSrc = '';
    for (const row of t.rows) {
      const cell = (i: number) => (i >= 0 ? row[i] ?? '' : '');
      let src = cell(iSrc); if (/^ídem/i.test(src) || !src) src = lastSrc; else lastSrc = src;
      const url = firstUrl(src);
      const rawNames = cell(iName).split(';').map((n) => n.replace(/\([^)]*\)/g, '').trim()).filter(Boolean);
      const rawSpecs = cell(iSpec).split(';').map((x) => x.trim()).filter(Boolean);
      const pairwise = rawNames.length > 1 && rawNames.length === rawSpecs.length;
      for (const [k, name] of rawNames.entries()) {
        const specCell = pairwise ? rawSpecs[k] : rawNames.length > 1 ? rawSpecs.join('; ') : cell(iSpec);
        const spec = mapSpecialty(specCell.replace(/\btel\.?[^;)]*/gi, '').replace(/\(?\d[\d\s().-]{6,}\)?/g, ''));
        if (!spec) { report.unmapped.push(`${name}: "${specCell}"`); continue; }
        let clinicCell = iClin >= 0 ? cell(iClin) : ''; let clinic: Clinic | null = null; let others: string[] = [];
        if (clinicCell) ({ primary: clinic, others } = clinicOf(clinicCell));
        if (!clinic && defaultKey) clinic = CLINICS.find((c) => c.key === defaultKey)!;
        if (!clinic) { report.noClinic.push(name); continue; }
        usedClinics.add(clinic.key);
        // suite: only when it reads like a consultorio location, never phone numbers
        let suite = isND(cell(iSuite)) || /^(central|—)$/i.test(cell(iSuite)) || /^(av\.|calle|c\/)/i.test(cell(iSuite)) || cell(iSuite).includes(',') && /av\.|calle/i.test(cell(iSuite)) ? '' : cell(iSuite);
        if (suite && /^\d+(-\d+)?$/.test(suite)) suite = `consultorio ${suite}`;
        if (/^(ND|Solo móvil|Clínica Corominas|Centro Médico Cibao)/i.test(suite)) suite = '';
        const ext = (cell(iPhone).match(/ext\.?\s*([\d]+(?:\/[\d]+)?)/i)?.[1]) ?? '';
        const edu = isND(cell(iEdu)) ? '' : cell(iEdu).replace(/\([^)]*\bND\b[^)]*\)/g, '').replace(/\bND\b/g, '').replace(/;\s*;/g, ';').replace(/[;\s]+$/, '').trim();
        const bioBits = [others.length ? `También consta en: ${others.join('; ')}.` : '', clinic.note ? '' : ''].filter(Boolean);
        const rowOut: Record<string, string> = {
          display_name: name, full_legal_name: '', gender: genderFromUrl(url), specialty: spec.slug, subspecialties: spec.subs.join('; '), education: edu, bio: bioBits.join(' '), city: clinic.city,
          facility: clinic.name, suite, phone_ext: ext, clinic_phone: clinic.phone, source_name: sourceName(url), source_url: url, source_retrieved_at: RETRIEVED, listing_status: 'listed',
        };
        const key = `${slugify(name)}|${spec.slug}|${slugify(clinic.city)}`;
        const prev = byKey.get(key);
        if (prev) {
          report.merged++;
          for (const c of ['education', 'suite', 'phone_ext', 'subspecialties', 'source_url', 'gender']) if (!prev[c] && rowOut[c]) prev[c] = rowOut[c];
          if (prev.facility !== clinic.name && !prev.bio.includes(clinic.name)) prev.bio = `${prev.bio} También consta en: ${clinic.name}.`.trim();
        } else byKey.set(key, rowOut);
      }
    }
  }
  const facilities = CLINICS.filter((c) => usedClinics.has(c.key)).map((c) => ({ name: c.name, type: c.type, address: c.address, city: c.city, sector: c.sector, phone: c.phone, website: c.website }));
  return { doctors: [...byKey.values()], facilities, report, placeholders: CLINICS.filter((c) => c.note && usedClinics.has(c.key)).map((c) => `${c.name}: ${c.note}`) };
}

if (process.argv[1]?.endsWith('compilation-to-csv.ts')) {
  const [, , input, outDir] = process.argv;
  if (!input || !outDir) { console.error('Usage: node scripts/compilation-to-csv.ts compilation.md out-dir'); process.exit(2); }
  const { doctors, facilities, report, placeholders } = convert(readFileSync(input, 'utf8'));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/centros.csv`, toCsv(FACILITY_COLS, facilities));
  writeFileSync(`${outDir}/medicos-listados.csv`, toCsv(DOCTOR_COLS, doctors));
  const bySpec = new Map<string, number>(); for (const d of doctors) bySpec.set(d.specialty, (bySpec.get(d.specialty) ?? 0) + 1);
  console.log(`centros: ${facilities.length} · médicos: ${doctors.length} · fusionados (duplicados): ${report.merged}`);
  console.log('por especialidad:', [...bySpec].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(', '));
  if (report.unmapped.length) console.log(`\nSin especialidad reconocida (${report.unmapped.length}), omitidos:\n  ` + report.unmapped.join('\n  '));
  if (report.noClinic.length) console.log(`\nSin clínica identificada (${report.noClinic.length}), omitidos:\n  ` + report.noClinic.join('\n  '));
  if (placeholders.length) console.log('\nDatos de centros por completar:\n  ' + placeholders.join('\n  '));
}
