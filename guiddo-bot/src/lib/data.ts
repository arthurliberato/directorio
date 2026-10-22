// Data access layer. Pages only talk to this module. It reads the current in-memory snapshot (seed or
// Postgres, see dataset.ts) through indexes built once per snapshot.
import { getDataset, type Dataset } from './dataset.ts';
import type { Ars, City, Doctor, Facility, Guide, Location, Sector, Specialty } from './types.ts';

export interface LocationView extends Location { city: City; sector: Sector | null; facility: Facility | null; }
export interface DoctorView { doctor: Doctor; specialty: Specialty; locations: LocationView[]; ars: Ars[]; }
export interface HubQuery { specialty: Specialty; city?: City; sector?: Sector; ars?: Ars; }

interface Index {
  ds: Dataset; published: DoctorView[]; bySlug: Map<string, DoctorView>;
  specBySlug: Map<string, Specialty>; cityBySlug: Map<string, City>; arsBySlug: Map<string, Ars>;
  facBySlug: Map<string, Facility>; guideBySlug: Map<string, Guide>; redirectByPath: Map<string, string>;
}

const cache = new WeakMap<Dataset, Index>();
const idx = (): Index => {
  const ds = getDataset();
  let i = cache.get(ds);
  if (i) return i;
  const byId = <T extends { id: number }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const spec = byId(ds.specialties), city = byId(ds.cities), sector = byId(ds.sectors), ars = byId(ds.ars), fac = byId(ds.facilities);
  const locs = new Map<number, LocationView[]>();
  for (const l of ds.locations) {
    const arr = locs.get(l.doctor_id) ?? [];
    arr.push({ ...l, city: city.get(l.city_id)!, sector: l.sector_id != null ? sector.get(l.sector_id) ?? null : null, facility: l.facility_id ? fac.get(l.facility_id) ?? null : null });
    locs.set(l.doctor_id, arr);
  }
  const arsByDoctor = new Map<number, Ars[]>();
  for (const a of ds.doctorArs) { const r = ars.get(a.ars_id); if (r) arsByDoctor.set(a.doctor_id, [...(arsByDoctor.get(a.doctor_id) ?? []), r]); }
  // "Published" = listed or affiliated. Drafts (e.g. doctors you have not decided to show yet) never render.
  const published = ds.doctors.filter(isPublished).map((d): DoctorView => ({ doctor: d, specialty: spec.get(d.specialty_id)!, locations: locs.get(d.id) ?? [], ars: arsByDoctor.get(d.id) ?? [] }));
  i = {
    ds, published, bySlug: new Map(published.map((v) => [v.doctor.slug, v])),
    specBySlug: new Map(ds.specialties.map((s) => [s.slug, s])), cityBySlug: new Map(ds.cities.map((c) => [c.slug, c])),
    arsBySlug: new Map(ds.ars.map((a) => [a.slug, a])), facBySlug: new Map(ds.facilities.map((f) => [f.slug, f])),
    guideBySlug: new Map(ds.guides.map((g) => [g.slug, g])), redirectByPath: new Map(ds.redirects.map((r) => [r.from_path, r.to_path])),
  };
  cache.set(ds, i);
  return i;
};

export const isPublished = (d: Doctor) => d.listing_status !== 'draft';
/** Verified affiliates: show photo, "Médico verificado" badge, and sort first. Everyone else is a public-source listing. */
export const isAffiliated = (d: Doctor) => d.listing_status === 'affiliated';
/** Sort key: affiliates first (0), then listed (1). */
export const tierRank = (v: DoctorView) => (isAffiliated(v.doctor) ? 0 : 1);
export const byTierThenName = (a: DoctorView, b: DoctorView) => tierRank(a) - tierRank(b) || a.doctor.display_name.localeCompare(b.doctor.display_name, 'es');
export const publishedDoctors = (): DoctorView[] => idx().published;
export const getDoctorBySlug = (slug: string) => idx().bySlug.get(slug) ?? null;
export const getSpecialties = () => idx().ds.specialties;
export const getSpecialtyBySlug = (slug: string) => idx().specBySlug.get(slug) ?? null;
export const getCities = () => idx().ds.cities;
export const getCityBySlug = (slug: string) => idx().cityBySlug.get(slug) ?? null;
export const getSectors = () => idx().ds.sectors;
export const getSectorBySlug = (slug: string, cityId: number) => idx().ds.sectors.find((s) => s.slug === slug && s.city_id === cityId) ?? null;
export const getArs = () => idx().ds.ars;
export const getArsBySlug = (slug: string) => idx().arsBySlug.get(slug) ?? null;
export const getFacilities = () => idx().ds.facilities;
export const getFacilityBySlug = (slug: string) => idx().facBySlug.get(slug) ?? null;
export const getGuides = () => idx().ds.guides;
export const getGuideBySlug = (slug: string) => idx().guideBySlug.get(slug) ?? null;
export const getRedirect = (path: string) => { const to = idx().redirectByPath.get(path); return to ? { from_path: path, to_path: to, status: 301 as const } : null; };
export const getRedirects = () => idx().ds.redirects;
export const today = () => idx().ds.today;
export const specialtySlugs = () => idx().ds.specialties.map((s) => s.slug);
export const allDoctors = () => idx().ds.doctors;

export function getReviewer(g: Guide): DoctorView | null {
  return publishedDoctors().find((v) => v.doctor.id === g.reviewer_doctor_id) ?? null;
}
export const doctorsForFacility = (facilityId: number): DoctorView[] =>
  publishedDoctors().filter((v) => v.locations.some((l) => l.facility_id === facilityId));

export function queryHub(q: HubQuery): DoctorView[] {
  return publishedDoctors().filter((v) =>
    v.specialty.id === q.specialty.id &&
    (!q.city || v.locations.some((l) => l.city_id === q.city!.id)) &&
    (!q.sector || v.locations.some((l) => l.sector_id === q.sector!.id)) &&
    (!q.ars || v.ars.some((a) => a.id === q.ars!.id)),
  );
}

export function nearbyDoctors(v: DoctorView, limit = 5): DoctorView[] {
  const cityIds = new Set(v.locations.map((l) => l.city_id));
  const sectorIds = new Set(v.locations.map((l) => l.sector_id).filter((x): x is number => x != null));
  const sameSector = (o: DoctorView) => Number(o.locations.some((l) => l.sector_id != null && sectorIds.has(l.sector_id)));
  return publishedDoctors()
    .filter((o) => !o.doctor.sponsored && o.doctor.id !== v.doctor.id && o.specialty.id === v.specialty.id && o.locations.some((l) => cityIds.has(l.city_id)))
    .sort((a, b) => tierRank(a) - tierRank(b) || sameSector(b) - sameSector(a) || a.doctor.slug.localeCompare(b.doctor.slug))
    .slice(0, limit);
}

export const primaryLocation = (v: DoctorView): LocationView | null => v.locations[0] ?? null;
export function doctorCount(specialtyId?: number, cityId?: number): number {
  return publishedDoctors().filter((v) => (!specialtyId || v.specialty.id === specialtyId) && (!cityId || v.locations.some((l) => l.city_id === cityId))).length;
}
