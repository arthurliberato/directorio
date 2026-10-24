// Doctors "available now" for the home page: who is at the practice at this moment (Dominican Republic time) according to
// the published opening hours, narrowed by specialty / province / center / day / time slot. It is NOT live slot availability.
import { atPracticeAt, dayInDR, hhmmOf, matchesWhen, nowInDR, opensLaterToday, SLOTS, DAY_SLUGS, DAY_NAMES, type SlotSlug, type When } from './availability.ts';
import { byTierThenName, getCityBySlug, getFacilityBySlug, getSpecialtyBySlug, isAffiliated, publishedDoctors, type DoctorView } from './data.ts';

export interface AvailFilters { especialidad?: string; ciudad?: string; centro?: string; dia?: string; hora?: string }
export interface Available {
  mode: 'now' | 'later' | 'filtered' | 'fallback'; items: DoctorView[]; day: number; timeLabel: string; heading: string;
  /** Specialty slug when one is chosen (for the "ver todos" link). */
  specialty?: string;
  /** Minutes since midnight in the DR when the list was built; set only in 'now' / 'later' modes (hours already past are hidden). */
  fromMinutes: number | null;
}
const MAX = 12;
const sponsoredFirst = (a: DoctorView, b: DoctorView) => Number(b.doctor.sponsored) - Number(a.doctor.sponsored);

export function availableDoctors(f: AvailFilters, nowDate = new Date()): Available {
  const now = nowInDR(nowDate);
  const spec = f.especialidad ? getSpecialtyBySlug(f.especialidad) : null;
  const city = f.ciudad ? getCityBySlug(f.ciudad) : null;
  const center = f.centro ? getFacilityBySlug(f.centro) : null;
  const base = publishedDoctors().filter((v) =>
    (!spec || v.specialty.id === spec.id) && (!city || v.locations.some((l) => l.city_id === city.id)) && (!center || v.locations.some((l) => l.facility_id === center.id)));

  // Day: default today. Time: default "ahora" (only meaningful on today).
  const day = f.dia === 'manana' ? dayInDR(nowDate, 1) : f.dia && DAY_SLUGS.includes(f.dia as never) ? DAY_SLUGS.indexOf(f.dia as never) + 1 : now.day;
  const isToday = day === now.day;
  const hora = f.hora === undefined ? 'ahora' : f.hora;
  const asNow = hora === 'ahora' && isToday;
  const slot = hora in SLOTS ? (hora as SlotSlug) : undefined;
  const when: When = { day, slot };
  const matches = asNow ? base.filter((v) => atPracticeAt(v, now.day, now.minutes)) : base.filter((v) => matchesWhen(v, when));
  const sort = (l: DoctorView[]) => [...l].sort((a, b) => sponsoredFirst(a, b) || byTierThenName(a, b));
  const timeLabel = asNow ? `ahora (${hhmmOf(now.minutes)})` : `${DAY_NAMES[day - 1].toLowerCase()}${slot ? `, ${SLOTS[slot].label.toLowerCase()}` : ''}`;
  const common = { day, timeLabel, specialty: spec?.slug, fromMinutes: isToday ? now.minutes : null };

  if (matches.length) return { ...common, mode: asNow ? 'now' : 'filtered', items: sort(matches).slice(0, MAX), heading: asNow ? 'Atienden ahora' : `Atienden ${timeLabel}` };
  if (asNow) {
    const later = base.map((v) => ({ v, at: opensLaterToday(v, now.day, now.minutes) })).filter((x): x is { v: DoctorView; at: number } => x.at != null).sort((a, b) => a.at - b.at);
    if (later.length) return { ...common, mode: 'later', items: later.slice(0, MAX).map((x) => x.v), heading: 'Ahora no hay doctores en consulta; estos atienden más tarde hoy' };
  }
  if (!spec && !city && !center && !f.dia && !f.hora) { // nothing chosen and nobody has hours: still show verified doctors
    return { ...common, mode: 'fallback', items: sort(base.filter((v) => isAffiliated(v.doctor))).slice(0, 6), heading: 'Ahora no hay consultas publicadas. Doctores verificados' };
  }
  return { ...common, mode: 'filtered', items: [], heading: `Ningún doctor tiene publicado horario ${asNow ? 'para este momento' : timeLabel}` };
}

export const filtersFrom = (p: URLSearchParams): AvailFilters => ({
  especialidad: p.get('especialidad') || undefined, ciudad: p.get('ciudad') || undefined, centro: p.get('centro') || undefined,
  dia: p.get('dia') || undefined, hora: p.has('hora') ? p.get('hora') ?? '' : undefined,
});
