# Importing doctors

1. Run `db/reference/001_reference_data.sql` once in the Supabase SQL Editor (specialties, cities, sectors, ARS). Review the ARS names against the current SISALRIL list.
2. Copy `templates/doctors.csv`, fill it in (Excel/Sheets "Save as CSV" works; both `,` and `;` delimiters are detected). See `templates/doctors.example.csv`.
3. **No terminal needed:** once the site is deployed, open `/admin/import`, upload the CSV, leave «Prueba (dry run)» checked, fix any reported lines, then untick it and import. (Needs `CEDULA_PEPPER` set on the server if the CSV has a `cedula` column.)
   Or from a terminal, dry run then import:
   ```bash
   export DATABASE_URL='postgresql://…session-pooler…'
   export CEDULA_PEPPER='a-long-random-secret'      # only needed if the CSV has a cedula column; keep it safe, never change it
   node scripts/import-doctors.ts doctors.csv --dry-run
   node scripts/import-doctors.ts doctors.csv
   ```
   Re-running updates existing doctors (matched by `exequatur_number`); it never duplicates.
4. Imported doctors are **unverified and unpublished** (they don't appear on the site). Verify each exequátur at the PGR "Consultar Exequátur" service, then mark it in `/admin` (audited). Only verified doctors are published.

| Column | Required | Format |
|---|---|---|
| `display_name` | yes | `Dra. María Pérez` (public name; `Dr.`/`Dra.` sets gender if `gender` is empty) |
| `full_legal_name` | yes | as on the exequátur |
| `gender` | no | `f` or `m` |
| `specialty` | yes | the specialty name or slug, e.g. `Cardiología`, `Cardiólogo` or `cardiologos` (see `db/reference/`) |
| `subspecialties`, `education`, `ars`, `languages` | no | separated by `;` — ARS by name or slug, languages `es;en` |
| `cedula` | no | 11 digits. Only a keyed hash is stored; never shown |
| `exequatur_number` | yes | unique per doctor |
| `exequatur_decree` | no | |
| `cmd_member` | no | `si`/`no` |
| `fee_min`, `fee_max` | no | whole DOP |
| `accepting_new_patients` | no | `si`/`no`, blank = unknown |
| `whatsapp`, `phone` | no | `809-555-0100` (DR numbers auto-get +1) |
| `address`, `sector`, `city` | yes | city must exist; a new sector is created and reported |
| `facility` | no | clinic name; created as a clinic if new (review it) |
| `schedule` | no | `lun-jue 08:00-12:00; vie 14:00-18:00` (lun mar mie jue vie sab dom) |
| `slug` | no | auto-generated (`dra-maria-perez-cardiologa`); collisions get the city appended |
