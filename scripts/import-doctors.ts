// node scripts/import-doctors.ts templates/doctors.csv [--dry-run]
// Env: DATABASE_URL (required), CEDULA_PEPPER (required only if the CSV has a cedula column)
// --dry-run runs everything (validation, DB triggers) and rolls every row back.
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { importDoctors, parseCsv } from '../src/lib/import.ts';

const file = process.argv[2]; const dryRun = process.argv.includes('--dry-run');
if (!file || !process.env.DATABASE_URL) { console.error('Usage: DATABASE_URL=... node scripts/import-doctors.ts file.csv [--dry-run]'); process.exit(2); }
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} }); // one connection: begin/commit stay in one session
const rows = parseCsv(readFileSync(file, 'utf8'));
const report = await importDoctors((q, p) => sql.unsafe(q, p as any[]) as unknown as Promise<any[]>, rows, { dryRun, pepper: process.env.CEDULA_PEPPER });
await sql.end();
console.log(`${dryRun ? '[DRY RUN] ' : ''}rows: ${rows.length} · inserted: ${report.inserted} · updated: ${report.updated} · errors: ${report.errors.length}`);
if (report.createdSectors.length) console.log('New sectors (review names):', report.createdSectors.join('; '));
if (report.createdFacilities.length) console.log('New facilities (review type/address):', report.createdFacilities.join('; '));
for (const e of report.errors) console.error(`  line ${e.line} ${e.name}: ${e.messages.join(' | ')}`);
console.log('Imported doctors are NOT verified or published. Verify each exequátur in /admin to publish.');
process.exit(report.errors.length ? 1 : 0);
