// Nightly index recompute (SPEC §4.3): compute the index status of every URL, diff against the last run,
// log every status change, and report which URLs to ping to IndexNow.
import { MIN_DOCTORS_FOR_HUB_INDEX, PAGE_SIZE, SITE_URL } from '../config.ts';
import { trustPages } from '../data/trust.ts';
import { getArs, getCities, getGuides, getFacilities, doctorsForFacility, getSectors, getSpecialties, publishedDoctors, queryHub, today, allDoctors } from './data.ts';
import { profilePath } from './facts.ts';
import { hubPath } from './hubs.ts';
import { profileIndexDecision } from './indexing.ts';
import type { HubQuery } from './data.ts';

export interface UrlState { status: 'index' | 'noindex'; reason: string; lastmod: string; }
export type StateMap = Map<string, UrlState>;
export interface Change { url: string; old: string | null; new: string; reason: string; }
export interface Diff { changes: Change[]; ping: string[]; }

const abs = (p: string) => `${SITE_URL}${p}`;
const maxDate = (ds: (string | null)[]) => ds.filter((d): d is string => !!d).sort().pop() ?? today();

export function computeState(): StateMap {
  const state: StateMap = new Map();
  for (const v of publishedDoctors()) {
    const d = profileIndexDecision(v);
    state.set(abs(profilePath(v)), { status: d.indexable ? 'index' : 'noindex', reason: d.reason, lastmod: v.doctor.data_verified_at ?? v.doctor.updated_at });
  }
  const hub = (q: HubQuery) => {
    const docs = queryHub(q);
    if (docs.length === 0) return; // real 404: not in state at all
    const indexable = docs.length >= MIN_DOCTORS_FOR_HUB_INDEX;
    const lastmod = maxDate(docs.map((v) => v.doctor.data_verified_at ?? v.doctor.updated_at));
    const pages = Math.max(1, Math.ceil(docs.length / PAGE_SIZE));
    for (let p = 1; p <= pages; p++) state.set(abs(hubPath(q, p)), { status: indexable ? 'index' : 'noindex', reason: `${docs.length} doctors`, lastmod });
  };
  for (const specialty of getSpecialties()) {
    hub({ specialty });
    for (const city of getCities()) {
      hub({ specialty, city });
      for (const sector of getSectors().filter((s) => s.city_id === city.id)) hub({ specialty, city, sector });
      for (const ars of getArs()) hub({ specialty, city, ars });
    }
  }
  for (const g of getGuides()) state.set(abs(`/guia/${g.slug}`), { status: 'index', reason: 'published guide', lastmod: g.reviewed_at });
  for (const f of getFacilities()) if (doctorsForFacility(f.id).length) state.set(abs(`/centro/${f.slug}`), { status: 'index', reason: 'facility with doctors', lastmod: f.updated_at });
  for (const p of ['/', '/especialidad', '/centro', '/guia']) state.set(abs(p), { status: 'index', reason: 'static page', lastmod: today() });
  for (const t of trustPages) state.set(abs(`/${t.slug}`), { status: 'index', reason: 'trust page', lastmod: '2026-10-01' });
  return state;
}

/** Pings: indexable URLs that are new or changed (lastmod), and URLs that stopped being indexable or disappeared. */
export function diffState(prev: StateMap, next: StateMap): Diff {
  const changes: Change[] = []; const ping = new Set<string>();
  for (const [url, n] of next) {
    const o = prev.get(url);
    if (!o) { changes.push({ url, old: null, new: n.status, reason: `new URL: ${n.reason}` }); if (n.status === 'index') ping.add(url); continue; }
    if (o.status !== n.status) { changes.push({ url, old: o.status, new: n.status, reason: n.reason }); ping.add(url); }
    else if (n.status === 'index' && o.lastmod !== n.lastmod) ping.add(url);
  }
  for (const [url, o] of prev) if (!next.has(url)) { changes.push({ url, old: o.status, new: 'removed', reason: 'no longer exists (404)' }); if (o.status === 'index') ping.add(url); }
  return { changes, ping: [...ping] };
}

/** Doctors whose exequátur verification is older than 6 months (SPEC §2). */
export function overdueReverification(nowIso: string = today()): { id: number; slug: string; verified_at: string }[] {
  const cutoff = new Date(nowIso); cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
  const c = cutoff.toISOString().slice(0, 10);
  return allDoctors().filter((d) => d.exequatur_verified_at && d.exequatur_verified_at < c).map((d) => ({ id: d.id, slug: d.slug, verified_at: d.exequatur_verified_at! }));
}
