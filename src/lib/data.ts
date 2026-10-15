// Data access layer. Today: in-memory seed. Production: swap bodies for Postgres queries
// (db/schema.sql) without touching pages. Pages only talk to this module.
import * as seed from '../data/seed.ts';
import type { Ars, City, Doctor, Facility, Guide, Location, Sector, Specialty } from './types.ts';

export interface LocationView extends Location { city: City; sector: Sector; facility: Facility | null; }
export interface DoctorView {
  doctor: Doctor; specialty: Specialty; locations: LocationView[]; ars: Ars[];
}
export interface HubQuery { specialty: Specialty; city?: City; sector?: Sector; ars?: Ars; }

const byId = <T extends { id: number }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
const specialtiesById = byId(seed.specialties);
const citiesById = byId(seed.cities);
const sectorsById = byId(seed.sectors);
const arsById = byId(seed.ars);
const facilitiesById = byId(seed.facilities);

function toView(d: Doctor): DoctorView {
  return {
    doctor: d,
    specialty: specialtiesById.get(d.specialty_id)!,
    locations: seed.locations.filter((l) => l.doctor_id === d.id).map((l) => ({
      ...l, city: citiesById.get(l.city_id)!, sector: sectorsById.get(l.sector_id)!,
      facility: l.facility_id ? facilitiesById.get(l.facility_id) ?? null : null,
    })),
    ars: seed.doctorArs.filter((a) => a.doctor_id === d.id).map((a) => arsById.get(a.ars_id)!).filter(Boolean),
  };
}

/** A doctor is "published" only with a verified exequátur (SPEC §4.2). */
export const isPublished = (d: Doctor) => d.exequatur_verified_at != null;

const allViews = () => seed.doctors.map(toView);
export const publishedDoctors = (): DoctorView[] => allViews().filter((v) => isPublished(v.doctor));

export const getDoctorBySlug = (slug: string) => publishedDoctors().find((v) => v.doctor.slug === slug) ?? null;
export const getSpecialties = () => seed.specialties;
export const getSpecialtyBySlug = (slug: string) => seed.specialties.find((s) => s.slug === slug) ?? null;
export const getCities = () => seed.cities;
export const getCityBySlug = (slug: string) => seed.cities.find((c) => c.slug === slug) ?? null;
export const getSectors = () => seed.sectors;
export const getSectorBySlug = (slug: string, cityId: number) => seed.sectors.find((s) => s.slug === slug && s.city_id === cityId) ?? null;
export const getArs = () => seed.ars;
export const getArsBySlug = (slug: string) => seed.ars.find((a) => a.slug === slug) ?? null;
export const getFacilities = () => seed.facilities;
export const getFacilityBySlug = (slug: string) => seed.facilities.find((f) => f.slug === slug) ?? null;
export const getGuides = () => seed.guides;
export const getGuideBySlug = (slug: string) => seed.guides.find((g) => g.slug === slug) ?? null;
export const getRedirect = (path: string) => seed.redirects.find((r) => r.from_path === path) ?? null;
export const getRedirects = () => seed.redirects;
export const today = () => seed.SEED_TODAY;

export function getReviewer(g: Guide): DoctorView | null {
  return publishedDoctors().find((v) => v.doctor.id === g.reviewer_doctor_id) ?? null;
}

export function doctorsForFacility(facilityId: number): DoctorView[] {
  return publishedDoctors().filter((v) => v.locations.some((l) => l.facility_id === facilityId));
}

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
  const sectorIds = new Set(v.locations.map((l) => l.sector_id));
  return publishedDoctors()
    .filter((o) => o.doctor.id !== v.doctor.id && o.specialty.id === v.specialty.id && o.locations.some((l) => cityIds.has(l.city_id)))
    .sort((a, b) => Number(b.locations.some((l) => sectorIds.has(l.sector_id))) - Number(a.locations.some((l) => sectorIds.has(l.sector_id))) || a.doctor.slug.localeCompare(b.doctor.slug))
    .slice(0, limit);
}

export const primaryLocation = (v: DoctorView): LocationView | null => v.locations[0] ?? null;
export const specialtySlugs = () => seed.specialties.map((s) => s.slug);

export function doctorCount(specialtyId?: number, cityId?: number): number {
  return publishedDoctors().filter((v) => (!specialtyId || v.specialty.id === specialtyId) && (!cityId || v.locations.some((l) => l.city_id === cityId))).length;
}
