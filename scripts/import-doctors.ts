// node scripts/import-doctors.ts templates/doctors.csv [--dry-run]
// Env: DATABASE_URL (required), CEDULA_PEPPER (required only if the CSV has a cedula column)
// --dry-run runs everything (validation, DB triggers) and rolls every row back.
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { importDoctors, importFacilities, isFacilitiesCsv, parseCsv } from '../src/lib/import.ts';

const file = process.argv[2]; const dryRun = process.argv.includes('--dry-run');
if (!file || !process.env.DATABASE_URL) { console.error('Usage: DATABASE_URL=... node scripts/import-doctors.ts file.csv [--dry-run]'); process.exit(2); }
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} }); // one connection: begin/commit stay in one session
const rows = parseCsv(readFileSync(file, 'utf8'));
const run = (q: string, p?: unknown[]) => sql.unsafe(q, p as any[]) as unknown as Promise<any[]>;
if (isFacilitiesCsv(rows)) {
  const fr = await importFacilities(run, rows, { dryRun });
  await sql.end();
  console.log(`${dryRun ? '[DRY RUN] ' : ''}centros: ${rows.length} · nuevos: ${fr.inserted} · actualizados: ${fr.updated} · errores: ${fr.errors.length}`);
  for (const e of fr.errors) console.error(`  línea ${e.line} ${e.name}: ${e.messages.join(' | ')}`);
  process.exit(fr.errors.length ? 1 : 0);
}
const report = await importDoctors(run, rows, { dryRun, pepper: process.env.CEDULA_PEPPER });
await sql.end();
console.log(`${dryRun ? '[DRY RUN] ' : ''}rows: ${rows.length} · inserted: ${report.inserted} · updated: ${report.updated} · errors: ${report.errors.length}`);
if (report.createdSectors.length) console.log('New sectors (review names):', report.createdSectors.join('; '));
if (report.createdFacilities.length) console.log('New facilities (review type/address):', report.createdFacilities.join('; '));
for (const e of report.errors) console.error(`  line ${e.line} ${e.name}: ${e.messages.join(' | ')}`);
console.log('Rows with listing_status=listed are visible as informational profiles; the rest stay hidden drafts. Nobody is marked verified by import: verify each exequátur in /admin.');
process.exit(report.errors.length ? 1 : 0);
