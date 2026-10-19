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
  raw = raw.replace(/[\u2010-\u2015\u2212]/g, '-'); // non-breaking / typographic hyphens from copied text
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
const STATUSES = new Set(['draft', 'listed']); // 'affiliated' is never set by import: it requires a verified exequátur (admin)

export async function importDoctors(run: Run, rows: Row[], opts: { dryRun?: boolean; pepper?: string } = {}): Promise<ImportReport> {
  const report: ImportReport = { inserted: 0, updated: 0, errors: [], createdSectors: [], createdFacilities: [], dryRun: !!opts.dryRun };
  const [specs, cities, sectors, arsRows] = await Promise.all([
    run('select id, slug, agent_f, agent_m, name_singular, name_plural, field_name from specialties'), run('select id, slug from cities'),
    run('select id, slug, city_id from sectors'), run('select id, slug from ars'),
  ]);
  const specialtyIds = specs.map((s) => s.slug);
  const seenKeys = new Set<string>();

  for (const [i, r] of rows.entries()) {
    const line = i + 2; const msgs: string[] = [];
    const need = (k: string) => { if (!r[k]) msgs.push(`falta ${k}`); return r[k] ?? ''; };
    const display = need('display_name'), exq = (r.exequatur_number ?? '').toUpperCase();
    const legal = r.full_legal_name || display;
    const citySlug = slugify(need('city')), specSlug = slugify(need('specialty'));
    const sectorName = r.sector ?? '';
    // accepts the slug or any natural name: cardiologos / Cardiología / Cardiólogo / cardióloga
    const spec = specs.find((s) => [s.slug, s.name_singular, s.name_plural, s.field_name, s.agent_f, s.agent_m].some((n: string) => slugify(n) === specSlug)); const city = cities.find((c) => c.slug === citySlug);
    if (r.specialty && !spec) msgs.push(`especialidad desconocida "${r.specialty}" (válidas: ${specialtyIds.join(', ')})`);
    if (r.city && !city) msgs.push(`ciudad desconocida "${r.city}"`);
    const key = exq || `${display.toLowerCase()}|${specSlug}|${citySlug}`;
    if (display) { if (seenKeys.has(key)) msgs.push(`fila duplicada en el archivo: ${exq || display}`); seenKeys.add(key); }
    // gender: explicit column, else the Dr./Dra. title; otherwise unknown (neutral wording, never guessed from the name)
    let gender: string | null = (r.gender || '').toLowerCase().slice(0, 1) || null;
    if (!gender) gender = /^dra\b/i.test(display) ? 'f' : /^dr\b/i.test(display) ? 'm' : null;
    if (gender && gender !== 'f' && gender !== 'm') msgs.push('gender debe ser f o m (o dejarlo vacío si no se conoce)');
    const status = (r.listing_status || 'draft').toLowerCase();
    if (!STATUSES.has(status)) msgs.push(status === 'affiliated' ? 'listing_status "affiliated" no se puede importar: verifica el exequátur en /admin y márcalo allí' : `listing_status no válido: ${status} (draft o listed)`);
    let schedule: ScheduleEntry[] = []; try { if (r.schedule) schedule = parseSchedule(r.schedule); } catch (e) { msgs.push((e as Error).message); }
    const wa = r.whatsapp ? normalizePhone(r.whatsapp) : null; if (r.whatsapp && !wa) msgs.push(`whatsapp no válido: ${r.whatsapp}`);
    const ph = r.phone ? normalizePhone(r.phone) : null; if (r.phone && !ph) msgs.push(`phone no válido: ${r.phone}`);
    const cph = r.clinic_phone ? normalizePhone(r.clinic_phone) : null; if (r.clinic_phone && !cph) msgs.push(`clinic_phone no válido: ${r.clinic_phone}`);
    const feeMin = r.fee_min ? Number(r.fee_min.replace(/[^\d]/g, '')) : null, feeMax = r.fee_max ? Number(r.fee_max.replace(/[^\d]/g, '')) : null;
    if (feeMin != null && feeMax != null && feeMax < feeMin) msgs.push('fee_max menor que fee_min');
    if (r.website && !/^https?:\/\//.test(r.website)) msgs.push(`URL no válida: ${r.website}`);
    if (r.source_url && !/^https?:\/\//.test(r.source_url)) msgs.push(`source_url no válida: ${r.source_url}`);
    if (r.source_retrieved_at && !/^\d{4}-\d{2}-\d{2}$/.test(r.source_retrieved_at)) msgs.push('source_retrieved_at debe ser AAAA-MM-DD');
    if (r.photo_url && !/^(https?:\/\/|\/)/.test(r.photo_url)) msgs.push(`URL de foto no válida (usa https://… o /ruta): ${r.photo_url}`);
    const langs = r.languages ? list(r.languages).map((l) => LANG[l.toLowerCase()]) : [];
    if (langs.some((l) => !l)) msgs.push(`idioma no reconocido en "${r.languages}"`);
    const arsIds: number[] = [];
    for (const a of list(r.ars ?? '')) { const row = arsRows.find((x) => x.slug === slugify(a).replace(/^ars-/, '')); if (row) arsIds.push(row.id); else msgs.push(`ARS desconocida "${a}"`); }
    let cedulaHash: string | null = null;
    if (r.cedula) { try { if (!opts.pepper) throw new Error('define CEDULA_PEPPER para procesar cédulas'); cedulaHash = hashCedula(r.cedula, opts.pepper); } catch (e) { msgs.push((e as Error).message); } }
    if (msgs.length || !spec || !city) { report.errors.push({ line, name: display || `(fila ${line})`, messages: msgs }); continue; }

    try {
      await run('begin');
      // facility (optional): reuse by name; create a minimal one when new (reported for review)
      let facilityId: number | null = null; let createdFacility: string | null = null; let facilityRow: any = null;
      if (r.facility) {
        const fSlug = slugify(r.facility);
        [facilityRow] = await run('select id, address, sector_id from facilities where slug = $1', [fSlug]);
        if (facilityRow) facilityId = facilityRow.id;
      }
      const address = r.address || facilityRow?.address || '';
      if (!address) throw new Error('falta address (o una clínica ya registrada con dirección)');
      // sector (optional): created when missing, reported so a human can review names
      let sector: any = null; let createdSector = false;
      if (sectorName) {
        const sSlug = slugify(sectorName);
        sector = sectors.find((x) => x.city_id === city.id && x.slug === sSlug);
        if (!sector) { const [row] = await run('insert into sectors (slug, name, city_id) values ($1,$2,$3) returning id, slug, city_id', [sSlug, sectorName, city.id]); sector = row; createdSector = true; }
      } else if (facilityRow?.sector_id) sector = { id: facilityRow.sector_id };
      if (r.facility && !facilityRow) {
        const [n] = await run(`insert into facilities (slug, name, type, address, city_id, sector_id) values ($1,$2,'MedicalClinic',$3,$4,$5) returning id`, [slugify(r.facility), r.facility, address, city.id, sector?.id ?? null]);
        facilityId = n.id; createdFacility = r.facility;
      }
      // upsert: exequátur number when present, else the same name + specialty + city
      const [existing] = exq
        ? await run('select id from doctors where exequatur_number = $1', [exq])
        : await run('select d.id from doctors d join locations l on l.doctor_id = d.id where lower(d.display_name) = lower($1) and d.specialty_id = $2 and l.city_id = $3 limit 1', [display, spec.id, city.id]);
      let id: number;
      const common = [legal, display, gender, spec.id, list(r.subspecialties ?? ''), r.exequatur_decree || null, cedulaHash, parseBool(r.cmd_member ?? '') ?? false, r.bio || null, list(r.education ?? ''), langs, r.photo_url || null, feeMin, feeMax, parseBool(r.accepting_new_patients ?? ''), wa?.wa ?? null, ph?.display ?? null, r.website || null, r.source_name || null, r.source_url || null, r.source_retrieved_at || null];
      if (existing) {
        id = existing.id;
        await run(`update doctors set full_legal_name=$1, display_name=$2, gender=$3, specialty_id=$4, subspecialties=$5, exequatur_decree=$6, cedula_hash=coalesce($7, cedula_hash), cmd_member=$8, bio=$9, education=$10, languages=$11, photo_url=$12,
          consultation_fee_min=$13, consultation_fee_max=$14, accepting_new_patients=$15, whatsapp=$16, phone=$17, website=$18, source_name=$19, source_url=$20, source_retrieved_at=$21, updated_at=now() where id=$22`, [...common, id]);
        await run('delete from locations where doctor_id = $1', [id]); await run('delete from doctor_ars where doctor_id = $1', [id]);
      } else {
        const slug = await uniqueSlug(run, r.slug, display, spec, gender, city.slug, slugify(sectorName));
        const [d] = await run(`insert into doctors (slug, full_legal_name, display_name, gender, specialty_id, subspecialties, exequatur_decree, cedula_hash, cmd_member, bio, education, languages, photo_url,
          consultation_fee_min, consultation_fee_max, accepting_new_patients, whatsapp, phone, website, source_name, source_url, source_retrieved_at, exequatur_number, listing_status)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::listing_status) returning id`,
          [slug, ...common, exq || null, status]);
        id = d.id;
      }
      await run('insert into locations (doctor_id, facility_id, address, sector_id, city_id, schedule, phone, suite, phone_ext) values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)',
        [id, facilityId, address, sector?.id ?? null, city.id, JSON.stringify(schedule), (cph ?? ph)?.display ?? null, r.suite || null, r.phone_ext || null]);
      if (existing && status !== 'draft') await run(`update doctors set listing_status = case when listing_status = 'affiliated' then listing_status else $1::listing_status end where id = $2`, [status, id]);
      for (const a of arsIds) await run('insert into doctor_ars (doctor_id, ars_id, verified_at) values ($1,$2,now())', [id, a]);
      if (opts.dryRun) await run('rollback'); else {
        await run('commit');
        if (createdSector) sectors.push(sector);
      }
      if (existing) report.updated++; else report.inserted++;
      if (createdSector) report.createdSectors.push(`${sectorName} (${city.slug})`);
      if (createdFacility) report.createdFacilities.push(createdFacility);
    } catch (e) {
      await run('rollback').catch(() => {});
      report.errors.push({ line, name: display, messages: [(e as Error).message] });
    }
  }
  return report;
}

async function uniqueSlug(run: Run, explicit: string | undefined, display: string, spec: { slug: string; field_name: string; agent_f: string; agent_m: string }, gender: string | null, citySlug: string, sectorSlug: string): Promise<string> {
  const taken = async (s: string) => isReservedSlug(s, (await run('select slug from specialties')).map((x) => x.slug)) || (await run('select 1 from doctors where slug = $1', [s])).length > 0;
  if (explicit) { const s = slugify(explicit); if (await taken(s)) throw new Error(`slug no disponible: ${s}`); return s; }
  const name = slugify(display.replace(/^dra?\.?\s+/i, ''));
  // known gender: dr-/dra- + agent noun; unknown gender: neutral (name + specialty field), never guessed
  const base = gender ? `${gender === 'f' ? 'dra' : 'dr'}-${name}-${slugify(gender === 'f' ? spec.agent_f : spec.agent_m)}` : `${name}-${slugify(spec.field_name)}`;
  // disambiguate with city, then sector; never "-2" (SPEC §3)
  const cands = [base, `${base}-${citySlug}`, ...(sectorSlug ? [`${base}-${citySlug}-${sectorSlug}`] : [])];
  for (const cand of cands) if (!(await taken(cand))) return cand;
  throw new Error(`no se pudo generar un slug único para ${display}; añade la columna slug`);
}

// ---- Facilities CSV: name,type,address,city,sector,phone,website,lat,lng --------------------------------------
export interface FacilityReport { inserted: number; updated: number; errors: { line: number; name: string; messages: string[] }[]; createdSectors: string[]; dryRun: boolean; }
export const isFacilitiesCsv = (rows: Row[]) => rows.length > 0 && 'name' in rows[0] && !('display_name' in rows[0]);

export async function importFacilities(run: Run, rows: Row[], opts: { dryRun?: boolean } = {}): Promise<FacilityReport> {
  const report: FacilityReport = { inserted: 0, updated: 0, errors: [], createdSectors: [], dryRun: !!opts.dryRun };
  const cities = await run('select id, slug from cities'); const sectors = await run('select id, slug, city_id from sectors');
  for (const [i, r] of rows.entries()) {
    const line = i + 2; const msgs: string[] = [];
    if (!r.name) msgs.push('falta name'); if (!r.address) msgs.push('falta address'); if (!r.city) msgs.push('falta city');
    const city = cities.find((c) => c.slug === slugify(r.city ?? '')); if (r.city && !city) msgs.push(`ciudad desconocida "${r.city}"`);
    const type = /^hosp/i.test(r.type ?? '') ? 'Hospital' : 'MedicalClinic';
    const ph = r.phone ? normalizePhone(r.phone) : null; if (r.phone && !ph) msgs.push(`phone no válido: ${r.phone}`);
    if (r.website && !/^https?:\/\//.test(r.website)) msgs.push(`URL no válida: ${r.website}`);
    const lat = r.lat ? Number(r.lat.replace(',', '.')) : null, lng = r.lng ? Number(r.lng.replace(',', '.')) : null;
    if (msgs.length || !city) { report.errors.push({ line, name: r.name || `(fila ${line})`, messages: msgs }); continue; }
    try {
      await run('begin');
      let sector: any = null; let created = false;
      if (r.sector) {
        const sSlug = slugify(r.sector); sector = sectors.find((x) => x.city_id === city.id && x.slug === sSlug);
        if (!sector) { [sector] = await run('insert into sectors (slug, name, city_id) values ($1,$2,$3) returning id, slug, city_id', [sSlug, r.sector, city.id]); created = true; }
      }
      const slug = slugify(r.name);
      const [ex] = await run('select id from facilities where slug = $1', [slug]);
      if (ex) { await run('update facilities set name=$1, type=$2, address=$3, city_id=$4, sector_id=$5, phone=$6, website=$7, lat=$8, lng=$9, updated_at=now() where id=$10', [r.name, type, r.address, city.id, sector?.id ?? null, ph?.display ?? null, r.website || null, lat, lng, ex.id]); report.updated++; }
      else { await run('insert into facilities (slug, name, type, address, city_id, sector_id, phone, website, lat, lng) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [slug, r.name, type, r.address, city.id, sector?.id ?? null, ph?.display ?? null, r.website || null, lat, lng]); report.inserted++; }
      if (opts.dryRun) await run('rollback'); else { await run('commit'); if (created) sectors.push(sector); }
      if (created) report.createdSectors.push(`${r.sector} (${city.slug})`);
    } catch (e) { await run('rollback').catch(() => {}); report.errors.push({ line, name: r.name, messages: [(e as Error).message] }); }
  }
  return report;
}
