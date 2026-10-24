// Turns a Dataset into INSERT statements (used by scripts/seed-db.ts and the PGlite integration test).
import type { Dataset } from './dataset.ts';

const lit = (v: unknown): string => {
  if (v == null) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return v.length ? `ARRAY[${v.map(lit).join(',')}]` : `'{}'`;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const JSON_COLS = new Set(['schedule', 'body', 'sources']); // jsonb columns, even when the value is a JS array
const jsonb = (v: unknown) => `'${JSON.stringify(v ?? []).replace(/'/g, "''")}'::jsonb`;
const insert = (table: string, cols: string[], rows: Record<string, unknown>[]) =>
  rows.map((r) => `insert into ${table} (${cols.join(',')}) values (${cols.map((c) => (JSON_COLS.has(c) ? jsonb(r[c]) : lit(r[c]))).join(',')});`);

export function datasetToSql(ds: Dataset): string[] {
  const specId = new Map(ds.specialties.map((s) => [s.slug, s.id]));
  const out: string[] = [];
  out.push(...insert('specialties', ['id', 'slug', 'name_singular', 'name_plural', 'field_name', 'agent_f', 'agent_m', 'schema_enum', 'icon'], ds.specialties as any));
  out.push(...insert('cities', ['id', 'slug', 'name', 'province'], ds.cities as any));
  out.push(...insert('sectors', ['id', 'slug', 'name', 'city_id'], ds.sectors as any));
  out.push(...insert('ars', ['id', 'slug', 'name'], ds.ars as any));
  out.push(...insert('facilities', ['id', 'slug', 'name', 'type', 'address', 'city_id', 'sector_id', 'phone', 'website', 'lat', 'lng', 'updated_at'], ds.facilities as any));
  out.push(...insert('doctors', ['id', 'slug', 'full_legal_name', 'display_name', 'gender', 'specialty_id', 'subspecialties', 'exequatur_number', 'exequatur_decree',
    'exequatur_verified_at', 'cmd_member', 'cmd_verified_at', 'specialty_verified_at', 'claimed', 'claimed_at', 'bio', 'education', 'languages', 'photo_url',
    'consultation_fee_min', 'consultation_fee_max', 'currency', 'accepting_new_patients', 'whatsapp', 'phone', 'website', 'gbp_url', 'sameas_urls',
    'data_verified_at', 'updated_at', 'index_status', 'sponsored', 'listing_status', 'booking_url', 'source_name', 'source_url', 'source_retrieved_at'], ds.doctors as any));
  out.push(...insert('locations', ['id', 'doctor_id', 'facility_id', 'address', 'sector_id', 'city_id', 'lat', 'lng', 'schedule', 'phone', 'suite', 'phone_ext'], ds.locations as any));
  out.push(...insert('doctor_ars', ['doctor_id', 'ars_id', 'verified_at'], ds.doctorArs as any));
  out.push(...insert('guides', ['id', 'slug', 'title', 'category', 'icon', 'read_minutes', 'answer_summary', 'body', 'reviewer_doctor_id', 'reviewed_at', 'sources', 'related_specialty_ids'],
    ds.guides.map((g) => ({ ...g, related_specialty_ids: g.related_specialty_slugs.map((s) => specId.get(s)) })) as any));
  out.push(...insert('doctor_mentions', ['id', 'doctor_id', 'kind', 'title', 'source_name', 'url', 'published_on', 'image_url', 'summary', 'summary_origin', 'published', 'checked_at'], ds.mentions as any));
  out.push(`select setval(pg_get_serial_sequence('doctor_mentions', 'id'), coalesce(max(id), 1), max(id) is not null) from doctor_mentions;`); // explicit ids were inserted
  out.push(...insert('redirects', ['from_path', 'to_path', 'status'], ds.redirects as any));
  return out;
}
