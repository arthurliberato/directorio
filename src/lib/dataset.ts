// A Dataset is the full in-memory snapshot of the directory. Source: Postgres when DATABASE_URL is set,
// otherwise the illustrative seed. Pages read the snapshot synchronously (see data.ts); the snapshot is
// refreshed in the background so CDN-cached SSR stays fast and fresh.
import * as seed from '../data/seed.ts';
import type { Ars, City, Doctor, DoctorArs, DoctorMention, Facility, Guide, Location, RedirectRow, Sector, Specialty } from './types.ts';

export interface Dataset {
  specialties: Specialty[]; cities: City[]; sectors: Sector[]; ars: Ars[]; facilities: Facility[];
  doctors: Doctor[]; locations: Location[]; doctorArs: DoctorArs[]; guides: Guide[]; redirects: RedirectRow[]; mentions: DoctorMention[];
  today: string; source: 'seed' | 'postgres'; loadedAt: number;
}

export const seedDataset = (): Dataset => ({
  specialties: seed.specialties, cities: seed.cities, sectors: seed.sectors, ars: seed.ars, facilities: seed.facilities,
  doctors: seed.doctors, locations: seed.locations, doctorArs: seed.doctorArs, guides: seed.guides, redirects: seed.redirects, mentions: seed.mentions,
  today: seed.SEED_TODAY, source: 'seed', loadedAt: Date.now(),
});

let current: Dataset = seedDataset();
export const getDataset = () => current;
export const setDataset = (d: Dataset) => { current = d; };

const TTL_MS = Number(process.env.DATASET_TTL_MS ?? 60_000);
let loading: Promise<void> | null = null;
let sqlClient: { unsafe: (q: string) => Promise<any[]> } | null = null;

async function reload(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  if (!sqlClient) {
    const { default: postgres } = await import('postgres');
    sqlClient = postgres(url, { max: Number(process.env.DATABASE_POOL_MAX ?? 2), idle_timeout: 20, onnotice: () => {} }) as any;
  }
  const { loadFromSql } = await import('./db-loader.ts');
  current = await loadFromSql((q) => sqlClient!.unsafe(q));
}

/** First request awaits the load; afterwards stale snapshots refresh in the background (stale-while-revalidate). */
export async function ensureDataset(force = false): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const stale = Date.now() - current.loadedAt > TTL_MS;
  if (current.source === 'seed' || force) {
    loading ??= reload().finally(() => { loading = null; });
    return loading;
  }
  if (stale && !loading) loading = reload().catch((e) => console.error('[dataset] refresh failed, keeping previous snapshot', e)).finally(() => { loading = null; });
}
