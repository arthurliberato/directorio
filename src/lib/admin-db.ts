// Admin writes (SPEC §1: edit doctors, mark verification, toggle index status). Parameterized SQL only.
import { normalizeBookingUrl } from './booking.ts';
import { validateMention, type MentionInput } from './mentions.ts';
export type Run = (sql: string, params?: unknown[]) => Promise<any[]>;
export const INDEX_STATUSES = ['auto', 'force_index', 'force_noindex'] as const;

export async function setIndexStatus(run: Run, doctorId: number, status: string): Promise<void> {
  if (!(INDEX_STATUSES as readonly string[]).includes(status)) throw new Error(`invalid index_status: ${status}`);
  const rows = await run('update doctors set index_status = $1::index_status, updated_at = now() where id = $2 returning id', [status, doctorId]);
  if (!rows.length) throw new Error(`doctor ${doctorId} not found`);
}

/** Records a successful exequátur check: stamps the doctor and appends an auditable verification_log row. */
export async function markExequaturVerified(run: Run, doctorId: number, o: { checkedBy: string; method: string; result: string; evidenceHash: string }): Promise<void> {
  if (!o.checkedBy || !o.method || !/^[a-f0-9]{16,128}$/i.test(o.evidenceHash)) throw new Error('checkedBy, method and a hex evidenceHash are required');
  const rows = await run("update doctors set exequatur_verified_at = now(), data_verified_at = now(), updated_at = now(), listing_status = case when listing_status = 'draft' then 'listed'::listing_status else listing_status end where id = $1 returning id", [doctorId]);
  if (!rows.length) throw new Error(`doctor ${doctorId} not found`);
  await run('insert into verification_log (doctor_id, type, method, result, evidence_hash, checked_by) values ($1, $2, $3, $4, $5, $6)', [doctorId, 'exequatur', o.method, o.result, o.evidenceHash, o.checkedBy]);
}

// --- Doctor editing -------------------------------------------------------------------------
export interface DoctorEdit {
  slug?: string; display_name?: string; bio?: string | null; consultation_fee_min?: number | null; consultation_fee_max?: number | null;
  accepting_new_patients?: boolean | null; whatsapp?: string | null; phone?: string | null; website?: string | null;
  languages?: string[]; photo_url?: string | null; booking_url?: string | null;
}
const phoneRe = /^\+?[0-9][0-9\- ]{6,18}$/;

export function validateEdit(e: DoctorEdit): string[] {
  const errs: string[] = [];
  if (e.slug !== undefined && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug)) errs.push('slug: lowercase letters, digits and hyphens only (no accents)');
  if (e.display_name !== undefined && e.display_name.trim().length < 3) errs.push('display_name too short');
  for (const k of ['consultation_fee_min', 'consultation_fee_max'] as const) {
    const v = e[k]; if (v != null && (!Number.isInteger(v) || v < 0 || v > 1_000_000)) errs.push(`${k}: whole number between 0 and 1,000,000`);
  }
  if (e.consultation_fee_min != null && e.consultation_fee_max != null && e.consultation_fee_max < e.consultation_fee_min) errs.push('fee max must be >= fee min');
  for (const k of ['whatsapp', 'phone'] as const) if (e[k] && !phoneRe.test(e[k]!)) errs.push(`${k}: invalid phone number`);
  for (const k of ['website', 'photo_url'] as const) if (e[k] && !/^https?:\/\/|^\//.test(e[k]!)) errs.push(`${k}: must be an http(s) URL or a /path`);
  if (e.languages && e.languages.some((l) => !/^[a-z]{2}$/.test(l))) errs.push('languages: two-letter codes (es, en, fr)');
  if (e.booking_url) { try { normalizeBookingUrl(e.booking_url); } catch (err) { errs.push((err as Error).message); } }
  return errs;
}

const EDITABLE = ['slug', 'display_name', 'bio', 'consultation_fee_min', 'consultation_fee_max', 'accepting_new_patients', 'whatsapp', 'phone', 'website', 'languages', 'photo_url', 'booking_url'] as const;

/** Whitelisted, parameterized update. A slug change auto-creates a 301 (DB trigger); reserved slugs are rejected by the DB. */
export async function updateDoctor(run: Run, id: number, edit: DoctorEdit): Promise<void> {
  const errs = validateEdit(edit);
  if (errs.length) throw new Error(errs.join('; '));
  if ('booking_url' in edit) edit = { ...edit, booking_url: normalizeBookingUrl(edit.booking_url) }; // stored in canonical form
  const keys = EDITABLE.filter((k) => k in edit);
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 1}`);
  const rows = await run(`update doctors set ${sets.join(', ')}, updated_at = now() where id = $${keys.length + 1} returning id`, [...keys.map((k) => (edit as any)[k]), id]);
  if (!rows.length) throw new Error(`doctor ${id} not found`);
}

export async function setDoctorArs(run: Run, doctorId: number, arsIds: number[]): Promise<void> {
  await run('delete from doctor_ars where doctor_id = $1', [doctorId]);
  for (const a of arsIds) await run('insert into doctor_ars (doctor_id, ars_id, verified_at) values ($1, $2, now())', [doctorId, a]);
  await run('update doctors set updated_at = now(), data_verified_at = now() where id = $1', [doctorId]);
}

// --- Claimed = "confirmed directly with the doctor" (we add doctors ourselves; there is no claim flow) -----------
export async function setConfirmedWithDoctor(run: Run, doctorId: number, confirmed: boolean): Promise<void> {
  const rows = await run('update doctors set claimed = $1, claimed_at = case when $1 then now() else null end, updated_at = now() where id = $2 returning id', [confirmed, doctorId]);
  if (!rows.length) throw new Error(`doctor ${doctorId} not found`);
}

// --- Facilities -------------------------------------------------------------------------------------------------
export interface FacilityEdit { name?: string; type?: string; address?: string; phone?: string | null; website?: string | null; lat?: number | null; lng?: number | null; }
export function validateFacilityEdit(e: FacilityEdit): string[] {
  const errs: string[] = [];
  if (e.name !== undefined && e.name.trim().length < 3) errs.push('name too short');
  if (e.type !== undefined && !['Hospital', 'MedicalClinic'].includes(e.type)) errs.push('type must be Hospital or MedicalClinic');
  if (e.address !== undefined && e.address.trim().length < 5) errs.push('address too short');
  if (e.phone && !phoneRe.test(e.phone)) errs.push('invalid phone number');
  if (e.website && !/^https?:\/\//.test(e.website)) errs.push('website must be an http(s) URL');
  if ((e.lat == null) !== (e.lng == null)) errs.push('lat and lng must be set together');
  if (e.lat != null && e.lng != null && (e.lat < 17.3 || e.lat > 20.1 || e.lng < -72.1 || e.lng > -68.2)) errs.push('lat/lng are outside the Dominican Republic: check the order (lat first) and sign (lng is negative)');
  return errs;
}
const FACILITY_EDITABLE = ['name', 'type', 'address', 'phone', 'website', 'lat', 'lng'] as const;
export async function updateFacility(run: Run, id: number, edit: FacilityEdit): Promise<void> {
  const errs = validateFacilityEdit(edit);
  if (errs.length) throw new Error(errs.join('; '));
  const keys = FACILITY_EDITABLE.filter((k) => k in edit);
  if (!keys.length) return;
  const rows = await run(`update facilities set ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}, updated_at = now() where id = $${keys.length + 1} returning id`, [...keys.map((k) => (edit as any)[k]), id]);
  if (!rows.length) throw new Error(`facility ${id} not found`);
}

// --- Listing tier ---------------------------------------------------------------------------------------------
export const LISTING_STATUSES = ['draft', 'listed', 'affiliated'] as const;
/** draft = hidden · listed = public-source profile · affiliated = verified affiliate (needs a verified exequátur; the DB enforces it). */
export async function setListingStatus(run: Run, doctorId: number, status: string): Promise<void> {
  if (!(LISTING_STATUSES as readonly string[]).includes(status)) throw new Error(`invalid listing_status: ${status}`);
  try {
    const rows = await run('update doctors set listing_status = $1::listing_status, updated_at = now() where id = $2 returning id', [status, doctorId]);
    if (!rows.length) throw new Error(`doctor ${doctorId} not found`);
  } catch (e) {
    if (/affiliated_requires_exequatur/.test((e as Error).message)) throw new Error('Para marcar como afiliado (verificado) primero verifica el exequátur en «Verificar exequátur».');
    throw e;
  }
}

// --- Mentions (press, articles, videos, social posts) -----------------------------------------------------------
/** Publishing stamps today's date as the review date: the person saving it has just checked the link and the text. */
export async function addMention(run: Run, doctorId: number, m: MentionInput): Promise<number> {
  const errs = validateMention(m);
  if (errs.length) throw new Error(errs.join('; '));
  try {
    const rows = await run('insert into doctor_mentions (doctor_id, kind, title, source_name, url, published_on, summary, summary_origin, published, checked_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, case when $9 then current_date else null end) returning id',
      [doctorId, m.kind, m.title.trim(), m.source_name.trim(), m.url.trim(), m.published_on, m.summary?.trim() || null, m.summary?.trim() ? m.summary_origin : null, m.published]);
    return Number(rows[0].id);
  } catch (e) { throw mentionDbError(e); }
}
export async function updateMention(run: Run, id: number, m: MentionInput): Promise<void> {
  const errs = validateMention(m);
  if (errs.length) throw new Error(errs.join('; '));
  try {
    const rows = await run('update doctor_mentions set kind = $1, title = $2, source_name = $3, url = $4, published_on = $5, summary = $6, summary_origin = $7, published = $8, checked_at = case when $8 then current_date else null end, updated_at = now() where id = $9 returning id',
      [m.kind, m.title.trim(), m.source_name.trim(), m.url.trim(), m.published_on, m.summary?.trim() || null, m.summary?.trim() ? m.summary_origin : null, m.published, id]);
    if (!rows.length) throw new Error(`mention ${id} not found`);
  } catch (e) { throw mentionDbError(e); }
}
export async function deleteMention(run: Run, id: number): Promise<void> {
  await run('delete from doctor_mentions where id = $1', [id]);
}
const mentionDbError = (e: unknown) => (/doctor_mentions_doctor_id_url_key/.test((e as Error).message) ? new Error('Ese enlace ya está guardado para este médico.') : (e as Error));
