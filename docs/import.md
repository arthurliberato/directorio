# Importing centers and doctors

## The listing model (who shows what)
| Status | Who | Shown how |
|---|---|---|
| **Verificado** (`affiliated`) | Affiliated doctors whose exequátur you verified | Photo, "Médico verificado" badge, listed **first**, profile can be indexed by Google |
| **Listado** (`listed`) | Doctors from public sources (clinic directories, societies) | "Perfil informativo" badge, **no photo**, listed after verified ones, source shown, never indexed |
| **Borrador** (`draft`) | Anything you have not decided to show | Hidden everywhere |

Import never creates verified doctors. To verify: check the exequátur, then use `/admin/verify` (tick "afiliado") or the doctor's edit page. The database refuses `affiliated` without a verified exequátur.

## Order
1. Run `db/reference/001_reference_data.sql` and `002_more_specialties.sql` once, and `db/migrations/004_listing_tiers.sql` if your database predates it.
2. Import **centers first** (`templates/centros.csv`), then doctors. At `/admin/import` the file type is detected from its columns; or `node scripts/import-doctors.ts file.csv [--dry-run]`.
3. Always do a dry run first (ticked by default in `/admin/import`).

Re-running updates instead of duplicating: doctors are matched by `exequatur_number`, or by name + specialty + city when there is none.

## Doctors CSV (`templates/doctors.csv`)
Excel/Sheets CSV works (`,` or `;` both detected). Required: `display_name`, `specialty`, `city`, and an `address` **or** a known `facility` (its address is reused).

| Column | Notes |
|---|---|
| `display_name` | Public name. `Dr.`/`Dra.` sets gender; without a title the profile uses neutral wording (never guessed from the name) |
| `full_legal_name` | Optional; defaults to `display_name` |
| `gender` | `f`/`m`, or empty if unknown |
| `specialty` | Name or slug: `Cardiología`, `Cardiólogo`, `cardiologos`. See `db/reference/` |
| `subspecialties`, `education`, `ars`, `languages` | Separated by `;`. Languages are not assumed |
| `exequatur_number` | Optional for listed doctors |
| `cedula` | Optional; only a keyed hash is stored (`CEDULA_PEPPER`) |
| `facility` | Center name; must exist in the centers file, otherwise a minimal one is created and reported |
| `suite` | "consultorio 405, 4.º piso" |
| `clinic_phone`, `phone_ext` | Switchboard of the center + the doctor's extension. Shown as "Central de …" |
| `phone` | The doctor's **own** direct line (only with their consent) |
| `sector` | Optional. Created if new |
| `schedule` | `lun-jue 08:00-12:00; vie 14:00-18:00` |
| `source_name`, `source_url`, `source_retrieved_at` | Where the public data came from (shown on listed profiles) and the date `AAAA-MM-DD` |
| `listing_status` | `listed` or `draft` (default). Never `affiliated` |
| `photo_url` | `https://…` or `/ruta`. Stored, but only shown for verified doctors |

## Centers CSV (`templates/centros.csv`)
`name,type,address,city,sector,phone,website,lat,lng` — `type`: `hospital` or `clinica`. Coordinates enable the interactive map.

## Converting a research compilation
`node scripts/compilation-to-csv.ts compilation.md out/` turns markdown tables of clinics and doctors into `centros.csv` and `medicos-listados.csv`. It keeps only the clinic's switchboard + extension (no mobile numbers), never guesses gender (it only uses an explicit `/dr-` or `/dra-` in the source URL), and reports rows it could not map. The output contains personal data: do not commit it.
