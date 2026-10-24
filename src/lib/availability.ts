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
