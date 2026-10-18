# Page mockups (rendered from the real templates)

Full-page captures of every page type, generated from the running site with **illustrative seed data** (names, prices and clinics are made up).
`-m` = phone (390 px wide, 2x), `-d` = desktop (1280 px). Regenerate after design changes by running the site and re-capturing.

| # | Page | URL pattern | Template |
|---|---|---|---|
| 01 | Home | `/` | `src/pages/index.astro` |
| 02 | All specialties | `/especialidad` | `src/pages/especialidad/index.astro` |
| 03 | Specialty (national) | `/cardiologos` | `src/components/HubPage.astro` |
| 04 | Specialty × city | `/cardiologos/santo-domingo` | `HubPage.astro` |
| 05 | Specialty × city × sector | `/cardiologos/santo-domingo/piantini` | `HubPage.astro` |
| 06 | Specialty × city × ARS | `/cardiologos/santo-domingo/ars-humano` | `HubPage.astro` |
| 07 | Doctor profile | `/dra-maria-perez-cardiologa` | `src/components/ProfilePage.astro` |
| 08 | Clinics & hospitals index | `/centro` | `src/pages/centro/index.astro` |
| 09 | Clinic / hospital page | `/centro/centro-medico-del-caribe` | `src/pages/centro/[slug].astro` |
| 10 | Guides index | `/guia` | `src/pages/guia/index.astro` |
| 11 | Guide | `/guia/cuanto-cuesta-consulta-cardiologo` | `src/pages/guia/[slug].astro` |
| 12 | Trust page | `/como-verificamos` | `src/pages/[slug].astro` + `src/data/trust.ts` |
| 13 | 404 | any unknown URL | `src/components/NotFound.astro` |
| 14 | Listed (informational) profile | `/marcos-tejeda-liriano-cardiologia` | `ProfilePage.astro` (listed tier) |

Behaviour worth knowing when reviewing:
- Clinic pages and the clinics index only list centers that have at least one verified doctor; specialties with no verified doctors are not shown.
- Hub pages with fewer than 5 doctors render but are `noindex`; with 0 doctors they are a real 404.
- Sponsored doctors appear in their own labeled block, never inside the ordered table/list.
- Verified doctors show a photo and a "Médico verificado" badge and sort first; listed doctors show "Perfil informativo", no photo, and their source.
- On phones the contact / clinic-data panel is moved above the long content.
