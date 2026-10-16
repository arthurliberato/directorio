// CSV importer for doctors (templates/doctors.csv). Imported doctors are NEVER verified or published:
// exequátur verification happens afterwards through the audited admin action (SPEC §2, §4.2).
import { createHmac } from 'node:crypto';
import { isReservedSlug, slugify } from './slugs.ts';

export type Run = (sql: string, params?: unknown[]) => Promise<any[]>;
export type Row = Record<string, string>;

// ---- CSV ----------------------------------------------------------------------------------
/** RFC-4180 parser; auto-detects `,` vs `;` (Excel in Spanish locales exports `;`). Strips BOM. */
export function parseCsv(text: string): Row[] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim() !== '')) rows.push(row);
  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

// ---- Field parsers ------------------------------------------------------------------------
const DAYS: Record<string, number> = { lun: 1, lunes: 1, mar: 2, martes: 2, mie: 3, mié: 3, miercoles: 3, miércoles: 3, jue: 4, jueves: 4, vie: 5, viernes: 5, sab: 6, sáb: 6, sabado: 6, sábado: 6, dom: 7, domingo: 7 };
export interface ScheduleEntry { day: number; open: string; close: string }

/** "lun-jue 08:00-12:00; vie 14:00-18:00; lun,mie 15:00-19:00" -> entries. Throws on anything ambiguous. */
export function parseSchedule(s: string): ScheduleEntry[] {
  const out: ScheduleEntry[] = [];
  for (const part of s.split(';').map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^([\p{L}, -]+?)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/u);
    if (!m) throw new Error(`horario no válido: "${part}" (ejemplo: lun-jue 08:00-12:00)`);
    const [open, close] = [m[2], m[3]].map((t) => t.padStart(5, '0'));
    if (open >= close) throw new Error(`horario: apertura debe ser antes del cierre en "${part}"`);
    const days = new Set<number>();
    for (const tok of m[1].split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)) {
      const [a, b] = tok.split('-').map((t) => t.trim());
      const da = DAYS[a], db = b ? DAYS[b] : da;
      if (!da || !db) throw new Error(`día no válido en "${part}"`);
      for (let d = da; ; d = (d % 7) + 1) { days.add(d); if (d === db) break; }
    }
    for (const day of [...days].sort((x, y) => x - y)) out.push({ day, open, close });
  }
  return out;
}

export function normalizePhone(raw: string): { display: string; wa: string } | null {
  const digits = raw.replace(/\D/g, '');
  const d = digits.length === 10 && /^(809|829|849)/.test(digits) ? '1' + digits : digits;
  if (!/^1(809|829|849)\d{7}$/.test(d) && !(raw.trim().startsWith('+') && d.length >= 8 && d.length <= 15)) return null;
  const display = /^1\d{10}$/.test(d) ? `+1-${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}` : `+${d}`;
  return { display, wa: `+${d}` };
}

const YES = new Set(['si', 'sí', 'yes', 'true', '1', 'x']); const NO = new Set(['no', 'false', '0']);
export const parseBool = (s: string): boolean | null => (YES.has(s.toLowerCase()) ? true : NO.has(s.toLowerCase()) ? false : null);
const LANG: Record<string, string> = { es: 'es', español: 'es', espanol: 'es', spanish: 'es', en: 'en', inglés: 'en', ingles: 'en', english: 'en', fr: 'fr', francés: 'fr', frances: 'fr', french: 'fr' };
const list = (s: string) => s.split(/[;|]/).map((x) => x.trim()).filter(Boolean);

/** cédula is only ever stored as an HMAC (never displayed, never stored raw). */
export function hashCedula(raw: string, pepper: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 11) throw new Error('cédula debe tener 11 dígitos');
  return createHmac('sha256', pepper).update(digits).digest('hex');
}

// ---- Import -------------------------------------------------------------------------------
export interface ImportReport {
  inserted: number; updated: number; errors: { line: number; name: string; messages: string[] }[];
  createdSectors: string[]; createdFacilities: string[]; dryRun: boolean;
}

export async function importDoctors(run: Run, rows: Row[], opts: { dryRun?: boolean; pepper?: string } = {}): Promise<ImportReport> {
  const report: ImportReport = { inserted: 0, updated: 0, errors: [], createdSectors: [], createdFacilities: [], dryRun: !!opts.dryRun };
  const [specs, cities, sectors, arsRows] = await Promise.all([
    run('select id, slug, agent_f, agent_m, name_singular, name_plural, field_name from specialties'), run('select id, slug from cities'),
    run('select id, slug, city_id from sectors'), run('select id, slug from ars'),
  ]);
  const specialtyIds = specs.map((s) => s.slug);
  const seenExequatur = new Set<string>();

  for (const [i, r] of rows.entries()) {
    const line = i + 2; const msgs: string[] = [];
    const need = (k: string) => { if (!r[k]) msgs.push(`falta ${k}`); return r[k] ?? ''; };
    const display = need('display_name'), legal = need('full_legal_name'), exq = need('exequatur_number').toUpperCase();
    const address = need('address'), citySlug = slugify(need('city')), specSlug = slugify(need('specialty')), sectorName = need('sector');
    // accepts the slug or any natural name: cardiologos / Cardiología / Cardiólogo / cardióloga
    const spec = specs.find((s) => [s.slug, s.name_singular, s.name_plural, s.field_name, s.agent_f, s.agent_m].some((n: string) => slugify(n) === specSlug)); const city = cities.find((c) => c.slug === citySlug);
    if (r.specialty && !spec) msgs.push(`especialidad desconocida "${r.specialty}" (válidas: ${specialtyIds.join(', ')})`);
    if (r.city && !city) msgs.push(`ciudad desconocida "${r.city}"`);
    if (exq) { if (seenExequatur.has(exq)) msgs.push(`exequátur duplicado en el archivo: ${exq}`); seenExequatur.add(exq); }
    let gender = (r.gender || '').toLowerCase().slice(0, 1);
    if (!gender) gender = /^dra\b/i.test(display) ? 'f' : /^dr\b/i.test(display) ? 'm' : '';
    if (gender !== 'f' && gender !== 'm') msgs.push('gender debe ser f o m (o empezar display_name con Dr./Dra.)');
    let schedule: ScheduleEntry[] = []; try { if (r.schedule) schedule = parseSchedule(r.schedule); } catch (e) { msgs.push((e as Error).message); }
    const wa = r.whatsapp ? normalizePhone(r.whatsapp) : null; if (r.whatsapp && !wa) msgs.push(`whatsapp no válido: ${r.whatsapp}`);
    const ph = r.phone ? normalizePhone(r.phone) : null; if (r.phone && !ph) msgs.push(`phone no válido: ${r.phone}`);
    const feeMin = r.fee_min ? Number(r.fee_min.replace(/[^\d]/g, '')) : null, feeMax = r.fee_max ? Number(r.fee_max.replace(/[^\d]/g, '')) : null;
    if (feeMin != null && feeMax != null && feeMax < feeMin) msgs.push('fee_max menor que fee_min');
    if (r.website && !/^https?:\/\//.test(r.website)) msgs.push(`URL no válida: ${r.website}`);
    if (r.photo_url && !/^(https?:\/\/|\/)/.test(r.photo_url)) msgs.push(`URL de foto no válida (usa https://… o /ruta): ${r.photo_url}`);
    const langs = r.languages ? list(r.languages).map((l) => LANG[l.toLowerCase()]) : ['es'];
    if (langs.some((l) => !l)) msgs.push(`idioma no reconocido en "${r.languages}"`);
    const arsIds: number[] = [];
    for (const a of list(r.ars ?? '')) { const row = arsRows.find((x) => x.slug === slugify(a).replace(/^ars-/, '')); if (row) arsIds.push(row.id); else msgs.push(`ARS desconocida "${a}"`); }
    let cedulaHash: string | null = null;
    if (r.cedula) { try { if (!opts.pepper) throw new Error('define CEDULA_PEPPER para procesar cédulas'); cedulaHash = hashCedula(r.cedula, opts.pepper); } catch (e) { msgs.push((e as Error).message); } }
    if (msgs.length || !spec || !city) { report.errors.push({ line, name: display || `(fila ${line})`, messages: msgs }); continue; }

    try {
      await run('begin');
      // sector / facility: create when missing (reported so a human can review names)
      const sSlug = slugify(sectorName);
      let sector = sectors.find((s) => s.city_id === city.id && s.slug === sSlug);
      let createdSector = false;
      if (!sector) { const [row] = await run('insert into sectors (slug, name, city_id) values ($1,$2,$3) returning id, slug, city_id', [sSlug, sectorName, city.id]); sector = row; createdSector = true; }
      let facilityId: number | null = null; let createdFacility: string | null = null;
      if (r.facility) {
        const fSlug = slugify(r.facility);
        const [f] = await run('select id from facilities where slug = $1', [fSlug]);
        if (f) facilityId = f.id;
        else { const [n] = await run(`insert into facilities (slug, name, type, address, city_id, sector_id) values ($1,$2,'MedicalClinic',$3,$4,$5) returning id`, [fSlug, r.facility, address, city.id, sector!.id]); facilityId = n.id; createdFacility = r.facility; }
      }
      const [existing] = await run('select id from doctors where exequatur_number = $1', [exq]);
      let id: number;
      const common = [legal, display, gender, spec.id, list(r.subspecialties ?? ''), r.exequatur_decree || null, cedulaHash, parseBool(r.cmd_member ?? '') ?? false, r.bio || null, list(r.education ?? ''), langs, r.photo_url || null, feeMin, feeMax, parseBool(r.accepting_new_patients ?? ''), wa?.wa ?? null, ph?.display ?? null, r.website || null];
      if (existing) {
        id = existing.id;
        await run(`update doctors set full_legal_name=$1, display_name=$2, gender=$3, specialty_id=$4, subspecialties=$5, exequatur_decree=$6, cedula_hash=coalesce($7, cedula_hash), cmd_member=$8, bio=$9, education=$10, languages=$11, photo_url=$12,
          consultation_fee_min=$13, consultation_fee_max=$14, accepting_new_patients=$15, whatsapp=$16, phone=$17, website=$18, updated_at=now() where id=$19`, [...common, id]);
        await run('delete from locations where doctor_id = $1', [id]); await run('delete from doctor_ars where doctor_id = $1', [id]);
      } else {
        const slug = await uniqueSlug(run, r.slug, display, spec, gender, city.slug, sSlug);
        const [d] = await run(`insert into doctors (slug, full_legal_name, display_name, gender, specialty_id, subspecialties, exequatur_decree, cedula_hash, cmd_member, bio, education, languages, photo_url,
          consultation_fee_min, consultation_fee_max, accepting_new_patients, whatsapp, phone, website, exequatur_number) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) returning id`,
          [slug, ...common, exq]);
        id = d.id;
      }
      await run('insert into locations (doctor_id, facility_id, address, sector_id, city_id, schedule, phone) values ($1,$2,$3,$4,$5,$6::jsonb,$7)', [id, facilityId, address, sector!.id, city.id, JSON.stringify(schedule), ph?.display ?? null]);
      for (const a of arsIds) await run('insert into doctor_ars (doctor_id, ars_id, verified_at) values ($1,$2,now())', [id, a]);
      if (opts.dryRun) await run('rollback'); else {
        await run('commit');
        if (createdSector) { sectors.push(sector!); report.createdSectors.push(`${sectorName} (${city.slug})`); }
      }
      if (existing) report.updated++; else report.inserted++;
      if (createdSector && opts.dryRun) report.createdSectors.push(`${sectorName} (${city.slug})`);
      if (createdFacility) report.createdFacilities.push(createdFacility);
    } catch (e) {
      await run('rollback').catch(() => {});
      report.errors.push({ line, name: display, messages: [(e as Error).message] });
    }
  }
  return report;
}

async function uniqueSlug(run: Run, explicit: string | undefined, display: string, spec: { slug: string; agent_f: string; agent_m: string }, gender: string, citySlug: string, sectorSlug: string): Promise<string> {
  const taken = async (s: string) => isReservedSlug(s, (await run('select slug from specialties')).map((x) => x.slug)) || (await run('select 1 from doctors where slug = $1', [s])).length > 0;
  if (explicit) { const s = slugify(explicit); if (await taken(s)) throw new Error(`slug no disponible: ${s}`); return s; }
  const name = slugify(display.replace(/^dra?\.?\s+/i, ''));
  const base = `${gender === 'f' ? 'dra' : 'dr'}-${name}-${slugify(gender === 'f' ? spec.agent_f : spec.agent_m)}`;
  // disambiguate with city, then sector; never "-2" (SPEC §3)
  for (const cand of [base, `${base}-${citySlug}`, `${base}-${citySlug}-${sectorSlug}`]) if (!(await taken(cand))) return cand;
  throw new Error(`no se pudo generar un slug único para ${display}; añade la columna slug`);
}
