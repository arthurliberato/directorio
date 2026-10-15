// Admin writes (SPEC §1: edit doctors, mark verification, toggle index status). Parameterized SQL only.
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
  const rows = await run('update doctors set exequatur_verified_at = now(), data_verified_at = now(), updated_at = now() where id = $1 returning id', [doctorId]);
  if (!rows.length) throw new Error(`doctor ${doctorId} not found`);
  await run('insert into verification_log (doctor_id, type, method, result, evidence_hash, checked_by) values ($1, $2, $3, $4, $5, $6)', [doctorId, 'exequatur', o.method, o.result, o.evidenceHash, o.checkedBy]);
}

// --- Doctor editing -------------------------------------------------------------------------
export interface DoctorEdit {
  slug?: string; display_name?: string; bio?: string | null; consultation_fee_min?: number | null; consultation_fee_max?: number | null;
  accepting_new_patients?: boolean | null; whatsapp?: string | null; phone?: string | null; website?: string | null;
  languages?: string[]; photo_url?: string | null;
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
  return errs;
}

const EDITABLE = ['slug', 'display_name', 'bio', 'consultation_fee_min', 'consultation_fee_max', 'accepting_new_patients', 'whatsapp', 'phone', 'website', 'languages', 'photo_url'] as const;

/** Whitelisted, parameterized update. A slug change auto-creates a 301 (DB trigger); reserved slugs are rejected by the DB. */
export async function updateDoctor(run: Run, id: number, edit: DoctorEdit): Promise<void> {
  const errs = validateEdit(edit);
  if (errs.length) throw new Error(errs.join('; '));
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
