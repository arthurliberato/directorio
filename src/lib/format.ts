import type { ScheduleEntry } from './types.ts';

const DAYS_ES = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DAYS_SCHEMA = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** 2026-10-02 -> 02/10/2026 (es-DO), timezone-independent. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function formatMonthYear(iso: string): string {
  const [y, m] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}
export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)} de ${MONTHS[Number(m) - 1]} de ${y}`;
}

export const formatDOP = (n: number) => `RD$${n.toLocaleString('en-US')}`;

export function formatFeeRange(min: number | null, max: number | null): string | null {
  if (min == null) return null;
  return max != null && max !== min ? `${formatDOP(min)} a ${formatDOP(max)}` : formatDOP(min);
}

/** [1,2,3,4] -> "lunes a jueves"; [1,3,5] -> "lunes, miércoles y viernes" */
export function formatDays(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (sorted.length >= 3 && consecutive) return `${DAYS_ES[sorted[0]]} a ${DAYS_ES[sorted[sorted.length - 1]]}`;
  const names = sorted.map((d) => DAYS_ES[d]);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export function formatScheduleLines(schedule: ScheduleEntry[]): string[] {
  const groups = new Map<string, number[]>();
  for (const e of schedule) {
    const key = `${e.open}–${e.close}`;
    groups.set(key, [...(groups.get(key) ?? []), e.day]);
  }
  return [...groups.entries()].map(([hours, days]) => `${capitalize(formatDays(days))}, ${hours}`);
}

/** Groups days that share the same hours: [{days:[1,2,3,4], open:'08:00', close:'12:00'}, ...] */
export function groupSchedule(schedule: ScheduleEntry[]): { days: number[]; open: string; close: string }[] {
  const groups = new Map<string, { days: number[]; open: string; close: string }>();
  for (const e of schedule) {
    const key = `${e.open}-${e.close}`;
    const g = groups.get(key) ?? { days: [], open: e.open, close: e.close };
    g.days.push(e.day); groups.set(key, g);
  }
  return [...groups.values()];
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const dayToSchema = (d: number) => DAYS_SCHEMA[d];

export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

export const median = (nums: number[]) => {
  const s = [...nums].sort((a, b) => a - b);
  if (!s.length) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

export function pluralize(n: number, one: string, many: string) { return `${n} ${n === 1 ? one : many}`; }

export const LANGUAGE_NAMES: Record<string, string> = { es: 'español', en: 'inglés', fr: 'francés' };
