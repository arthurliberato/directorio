import { PAGE_SIZE } from '../config.ts';
import { byTierThenName, getArsBySlug, getCityBySlug, getSectorBySlug, getSpecialtyBySlug, isAffiliated, queryHub, type DoctorView, type HubQuery } from './data.ts';
import { formatDOP, formatMonthYear, joinList, median } from './format.ts';

export type HubParse =
  | { ok: true; query: HubQuery; page: number; explicitPage1: boolean }
  | { ok: false };

/** Fixed facet order: specialty -> city -> (sector | ars) -> [pagina/N]. Anything else is not a hub. */
export function parseHubPath(segments: string[]): HubParse {
  const segs = [...segments];
  let page = 1;
  let explicitPage1 = false;
  const pi = segs.indexOf('pagina');
  if (pi !== -1) {
    if (pi !== segs.length - 2) return { ok: false };
    const raw = segs[pi + 1];
    if (!/^[1-9]\d*$/.test(raw)) return { ok: false };
    page = Number(raw);
    explicitPage1 = page === 1;
    segs.splice(pi);
  }
  const [specSlug, citySlug, third, ...extra] = segs;
  if (!specSlug || extra.length) return { ok: false };
  const specialty = getSpecialtyBySlug(specSlug);
  if (!specialty) return { ok: false };
  const query: HubQuery = { specialty };
  if (citySlug) {
    const city = getCityBySlug(citySlug);
    if (!city) return { ok: false };
    query.city = city;
    if (third) {
      if (third.startsWith('ars-')) {
        const a = getArsBySlug(third.slice(4));
        if (!a) return { ok: false };
        query.ars = a;
      } else {
        const sector = getSectorBySlug(third, city.id);
        if (!sector) return { ok: false };
        query.sector = sector;
      }
    }
  } else if (third) return { ok: false };
  return { ok: true, query, page, explicitPage1 };
}

export function hubPath(q: HubQuery, page = 1): string {
  let p = `/${q.specialty.slug}`;
  if (q.city) p += `/${q.city.slug}`;
  if (q.city && q.sector) p += `/${q.sector.slug}`;
  if (q.city && q.ars) p += `/ars-${q.ars.slug}`;
  if (page > 1) p += `/pagina/${page}`;
  return p;
}

export function hubPlace(q: HubQuery): string {
  if (q.sector && q.city) return `${q.sector.name}, ${q.city.name}`;
  if (q.city) return q.city.name;
  return 'República Dominicana';
}

export function hubHeading(q: HubQuery): string {
  const base = q.specialty.name_plural;
  if (q.ars && q.city) return `${base} que aceptan ${q.ars.name} en ${q.city.name}`;
  return `${base} en ${hubPlace(q)}`;
}

export interface HubStats {
  n: number; affiliated: number; feeMin: number | null; feeMedian: number | null; feeMax: number | null; feeN: number;
  arsCounts: { name: string; count: number }[]; facilities: { name: string; slug: string; count: number }[];
  languages: { code: string; count: number }[]; asOf: string;
}

export function hubStats(doctors: DoctorView[]): HubStats {
  const fees = doctors.map((v) => v.doctor.consultation_fee_min).filter((f): f is number => f != null);
  const arsMap = new Map<string, number>();
  const facMap = new Map<string, { name: string; slug: string; count: number }>();
  const langMap = new Map<string, number>();
  for (const v of doctors) {
    for (const a of v.ars) arsMap.set(a.name, (arsMap.get(a.name) ?? 0) + 1);
    for (const l of v.locations) if (l.facility) {
      const cur = facMap.get(l.facility.slug) ?? { name: l.facility.name, slug: l.facility.slug, count: 0 };
      cur.count++; facMap.set(l.facility.slug, cur);
    }
    for (const lang of v.doctor.languages) langMap.set(lang, (langMap.get(lang) ?? 0) + 1);
  }
  const dates = doctors.map((v) => v.doctor.data_verified_at).filter((x): x is string => !!x).sort();
  return {
    n: doctors.length, affiliated: doctors.filter((v) => isAffiliated(v.doctor)).length,
    feeMin: fees.length ? Math.min(...fees) : null, feeMax: fees.length ? Math.max(...fees) : null,
    feeMedian: fees.length ? median(fees) : null, feeN: fees.length,
    arsCounts: [...arsMap].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    facilities: [...facMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    languages: [...langMap].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
    asOf: dates[dates.length - 1] ?? '',
  };
}

/** Data-driven intro: unique per hub because it is built from that hub's own numbers. */
export function hubIntro(q: HubQuery, s: HubStats, langName: (c: string) => string): string {
  const parts: string[] = [];
  parts.push(`Compara ${q.specialty.name_plural.toLowerCase()} en ${hubPlace(q)}${q.ars ? ` que aceptan ${q.ars.name}` : ''}: precio de consulta, ARS aceptadas y centros médicos.${s.affiliated > 0 ? ' Los perfiles verificados aparecen primero.' : ''}`);
  if (s.feeMin != null && s.feeMax != null) {
    parts.push(s.feeMin === s.feeMax
      ? `La consulta cuesta desde ${formatDOP(s.feeMin)}.`
      : `El precio de consulta va de ${formatDOP(s.feeMin)} a ${formatDOP(s.feeMax)}, con una mediana de ${formatDOP(s.feeMedian!)}.`);
  }
  if (s.arsCounts.length) {
    const top = s.arsCounts.slice(0, 3).map((a) => a.name);
    parts.push(`Las ARS más aceptadas son ${joinList(top)}.`);
  }
  if (s.facilities.length) parts.push(`Atienden principalmente en ${joinList(s.facilities.slice(0, 3).map((f) => f.name))}.`);
  if (s.languages.length > 1) parts.push(`Idiomas de atención: ${joinList(s.languages.map((l) => langName(l.code)))}.`);
  if (s.asOf) parts.push(`Datos revisados hasta ${formatMonthYear(s.asOf)}.`);
  return parts.join(' ');
}

/** Verified affiliates always come first; within each group: by name (default) or by price. */
export function sortDoctors(list: DoctorView[], orden: string | null): DoctorView[] {
  const l = [...list];
  if (orden === 'precio') l.sort((a, b) => (isAffiliated(a.doctor) ? 0 : 1) - (isAffiliated(b.doctor) ? 0 : 1) || (a.doctor.consultation_fee_min ?? Infinity) - (b.doctor.consultation_fee_min ?? Infinity) || a.doctor.slug.localeCompare(b.doctor.slug));
  else l.sort(byTierThenName);
  return l;
}

export const paginate = <T>(list: T[], page: number) => ({
  items: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  totalPages: Math.max(1, Math.ceil(list.length / PAGE_SIZE)),
});

import { hubIndexDecision, type IndexDecision } from './indexing.ts';
import { LANGUAGE_NAMES } from './format.ts';

export type HubResolution =
  | { status: 'not_found' }
  | { status: 'redirect'; to: string }
  | {
      status: 'ok'; query: HubQuery; page: number; totalPages: number; total: number;
      items: DoctorView[]; stats: HubStats; decision: IndexDecision; intro: string; path: string;
    };

export function resolveHub(segments: string[], orden: string | null = null): HubResolution {
  const parsed = parseHubPath(segments);
  if (!parsed.ok) return { status: 'not_found' };
  const { query, page, explicitPage1 } = parsed;
  if (explicitPage1) return { status: 'redirect', to: hubPath(query) };
  const all = queryHub(query);
  const decision = hubIndexDecision(all.length);
  if (decision.kind === 'not_found') return { status: 'not_found' }; // real 404, never soft
  const sorted = sortDoctors(all, orden);
  const { items, totalPages } = paginate(sorted, page);
  if (page > totalPages) return { status: 'not_found' };
  const stats = hubStats(all);
  return {
    status: 'ok', query, page, totalPages, total: all.length, items, stats,
    decision: { robots: decision.robots, indexable: decision.indexable, reason: decision.reason },
    intro: hubIntro(query, stats, (c) => LANGUAGE_NAMES[c] ?? c), path: hubPath(query, page),
  };
}
