// Loads the illustrative seed into Postgres: DATABASE_URL=... node scripts/seed-db.ts
// Applies db/migrations/001_core.sql first when the schema is missing.
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { datasetToSql } from '../src/lib/db-seed.ts';
import { seedDataset } from '../src/lib/dataset.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const sql = postgres(url, { max: 1, onnotice: () => {} });
const [{ exists }] = await sql`select to_regclass('public.doctors') is not null as exists`;
if (!exists) await sql.unsafe(readFileSync(new URL('../db/migrations/001_core.sql', import.meta.url), 'utf8'));
await sql.begin(async (tx) => {
  await tx.unsafe('truncate doctors, specialties, cities, facilities, ars, guides, redirects restart identity cascade');
  for (const stmt of datasetToSql(seedDataset())) await tx.unsafe(stmt);
});
console.log('Seed loaded.');
await sql.end();
