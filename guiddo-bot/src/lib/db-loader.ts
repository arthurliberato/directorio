import type { Dataset } from './dataset.ts';
import type { Ars, City, Doctor, DoctorArs, DoctorMention, Facility, Guide, Location, RedirectRow, Sector, Specialty } from './types.ts';

export type Query = (sql: string) => Promise<any[]>;

const iso = (v: unknown): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
const day = (v: unknown): string | null => iso(v)?.slice(0, 10) ?? null;

// Rolling out the mentions table must not take the site (or the bot) down: a missing table or missing SELECT grant means "no mentions yet".
const optional = async (q: Query, sql: string): Promise<any[]> => {
  try { return await q(sql); } catch (e) {
    if (['42P01', '42501'].includes((e as { code?: string }).code ?? '')) { console.warn('[dataset] doctor_mentions not readable yet, continuing without it'); return []; }
    throw e;
  }
};

/** Reads every table (SPEC §2) into a Dataset. Works with any driver exposing `query(text) -> rows`. */
export async function loadFromSql(q: Query): Promise<Dataset> {
  const [specialties, cities, sectors, ars, facilities, doctors, locations, doctorArs, guides, redirects, mentions] = await Promise.all([
    q('select * from specialties order by id'), q('select * from cities order by id'), q('select * from sectors order by id'),
    q('select * from ars order by id'), q('select * from facilities order by id'), q('select * from doctors order by id'),
    q('select * from locations order by id'), q('select * from doctor_ars'), q('select * from guides order by id'), q('select * from redirects'),
    optional(q, 'select * from doctor_mentions order by id'),
  ]);
  const specSlug = new Map<number, string>(specialties.map((s: any) => [s.id, s.slug]));
  const [{ now }] = await q('select now() as now');
  return {
    specialties: specialties.map((s: any): Specialty => ({ ...s, profession: s.profession ?? 'medico' })), /* 'medico' until migration 008 is applied */ cities: cities as City[], sectors: sectors as Sector[], ars: ars as Ars[],
    facilities: facilities.map((f: any): Facility => ({ ...f, updated_at: day(f.updated_at)! })),
    doctors: doctors.map((d: any): Doctor => ({
      ...d, gender: d.gender == null ? null : (String(d.gender).trim() as 'f' | 'm'), currency: 'DOP',
      source_retrieved_at: day(d.source_retrieved_at),
      exequatur_verified_at: day(d.exequatur_verified_at), cmd_verified_at: day(d.cmd_verified_at), specialty_verified_at: day(d.specialty_verified_at),
      claimed_at: day(d.claimed_at), data_verified_at: day(d.data_verified_at), updated_at: day(d.updated_at)!,
      subspecialties: d.subspecialties ?? [], education: d.education ?? [], languages: d.languages ?? [], sameas_urls: d.sameas_urls ?? [],
    })),
    locations: locations.map((l: any): Location => ({ ...l, suite: l.suite ?? null, phone_ext: l.phone_ext ?? null, schedule: typeof l.schedule === 'string' ? JSON.parse(l.schedule) : l.schedule ?? [] })),
    doctorArs: doctorArs.map((a: any): DoctorArs => ({ ...a, verified_at: day(a.verified_at)! })),
    guides: guides.map((g: any): Guide => ({
      id: g.id, slug: g.slug, title: g.title, category: g.category ?? '', icon: g.icon ?? 'heart', answer_summary: g.answer_summary,
      body: typeof g.body === 'string' ? JSON.parse(g.body) : g.body, read_minutes: g.read_minutes ?? 4,
      reviewer_doctor_id: g.reviewer_doctor_id, reviewed_at: day(g.reviewed_at)!,
      sources: typeof g.sources === 'string' ? JSON.parse(g.sources) : g.sources,
      related_specialty_slugs: (g.related_specialty_ids ?? []).map((id: number) => specSlug.get(id)).filter(Boolean),
    })),
    redirects: redirects as RedirectRow[],
    mentions: mentions.map((m: any): DoctorMention => ({ ...m, id: Number(m.id), doctor_id: Number(m.doctor_id), published_on: day(m.published_on), checked_at: day(m.checked_at) })),
    today: day(now)!, source: 'postgres', loadedAt: Date.now(),
  };
}
