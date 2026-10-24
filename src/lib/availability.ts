// "When can I be seen?" filter. Uses the opening hours stored per location (the same data shown on profiles): it says
// when a doctor is at the practice, not whether a slot is free. Doctors without published hours never match a filter.
import type { DoctorView } from './data.ts';

export const DAY_SLUGS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] as const; // index + 1 = ScheduleEntry.day (1 = Monday)
export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const SLOTS = { manana: { label: 'Mañana', from: '06:00', to: '12:00' }, tarde: { label: 'Tarde', from: '12:00', to: '18:00' }, noche: { label: 'Noche', from: '18:00', to: '24:00' } } as const;
export type DaySlug = (typeof DAY_SLUGS)[number];
export type SlotSlug = keyof typeof SLOTS;
export interface When { day?: number; slot?: SlotSlug } // day: 1-7

const mins = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };

/** Weekday (1 = Monday) in the Dominican Republic right now (UTC-4 all year). */
export function dayInDR(now = new Date(), offsetDays = 0): number {
  const w = new Date(now.getTime() - 4 * 3_600_000 + offsetDays * 86_400_000).getUTCDay(); // 0 = Sunday
  return w === 0 ? 7 : w;
}

/** Reads ?dia= (lun..dom) and ?hora= (manana|tarde|noche); anything else is ignored. */
export function parseWhen(p: URLSearchParams): When | null {
  const i = DAY_SLUGS.indexOf((p.get('dia') ?? '') as DaySlug);
  const h = p.get('hora') ?? '';
  const when: When = { day: i >= 0 ? i + 1 : undefined, slot: h in SLOTS ? (h as SlotSlug) : undefined };
  return when.day || when.slot ? when : null;
}

export function whenQuery(w: When | null): string {
  if (!w) return '';
  const q = new URLSearchParams();
  if (w.day) q.set('dia', DAY_SLUGS[w.day - 1]);
  if (w.slot) q.set('hora', w.slot);
  return `?${q}`;
}

export function whenLabel(w: When): string {
  return [w.day ? DAY_NAMES[w.day - 1] : null, w.slot ? SLOTS[w.slot].label.toLowerCase() : null].filter(Boolean).join(', ');
}

export function matchesWhen(v: DoctorView, w: When): boolean {
  const slot = w.slot ? SLOTS[w.slot] : null;
  return v.locations.some((l) => l.schedule.some((e) => (!w.day || e.day === w.day) && (!slot || (mins(e.open) < mins(slot.to) && mins(e.close) > mins(slot.from)))));
}

/** Current weekday (1 = Monday) and minutes since midnight in the Dominican Republic (UTC-4, no DST). */
export function nowInDR(now = new Date()): { day: number; minutes: number } {
  const d = new Date(now.getTime() - 4 * 3_600_000);
  return { day: d.getUTCDay() === 0 ? 7 : d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
export const hhmmOf = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** At practice at this exact moment, according to the published hours (open <= now < close). */
export function atPracticeAt(v: DoctorView, day: number, minutes: number): boolean {
  return v.locations.some((l) => l.schedule.some((e) => e.day === day && mins(e.open) <= minutes && minutes < mins(e.close)));
}
/** Earliest opening later today after `minutes`, or null. */
export function opensLaterToday(v: DoctorView, day: number, minutes: number): number | null {
  const next = v.locations.flatMap((l) => l.schedule).filter((e) => e.day === day && mins(e.open) > minutes).map((e) => mins(e.open));
  return next.length ? Math.min(...next) : null;
}
/** Hours for one weekday, e.g. "08:00–12:00, 14:00–18:00"; null when none are published. */
export function hoursOn(v: DoctorView, day: number): string | null {
  const parts = v.locations.flatMap((l) => l.schedule).filter((e) => e.day === day).sort((a, b) => mins(a.open) - mins(b.open)).map((e) => `${e.open}–${e.close}`);
  return parts.length ? [...new Set(parts)].join(', ') : null;
}
