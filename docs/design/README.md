> **Superseded:** the visual identity is now the guiddo design kit in `guiddo/` (`guiddo/DESIGN.md` is the source of truth). The Lovable mockups below are kept only for page-structure reference.

# Visual reference — Home (mobile, from Lovable prototype)

Screenshots of the Lovable prototype (`lovable.dev`), top to bottom. They define the **aesthetics** (look and feel) to match closely; markup and structure are rebuilt for SEO/AI per `SPEC.md`. Where the two conflict, the notes under "Spec alignment" apply.

| File | Section |
|---|---|
| `home-01.png` | Header (heart-plus logo + `guiddo.io.`, hamburger), eyebrow pill "Tu directorio médico en República Dominicana", H1 "Encuentra el médico adecuado. **Cuida lo que más importa.**" (second line in blue with coral underline), subcopy, search card: Especialidad / Ciudad / Tu seguro (opcional, ARS) + "Buscar médico" button |
| `home-02.png` | Quick links ("Cardiología en Santo Domingo", "Pediatría…", "Ginecología…"), trust ticks ("Exequátur verificado", "Información transparente"), "¿Qué especialista necesitas?" grid of 8 specialty cards with icon + doctor count + "Todas las especialidades" link |
| `home-03.png` | "Tu salud, cerca de ti" city list (Santo Domingo, Santiago, La Romana, San Pedro de Macorís, Punta Cana, Puerto Plata, each with doctor count), trust banner "Tu tranquilidad empieza con información verificada" → "Cómo verificamos a los médicos", "Conoce a nuestros médicos" start (doctor card) |
| `home-04.png` | Doctor card anatomy: photo, name, specialty, green "Exequátur verificado" badge, sector, ARS ("Humano y otras ARS"), facility, "Consulta desde RD$", "Ver perfil" button. **Sponsored card**: coral border + tint, "Patrocinado" label |
| `home-05.png` | Third doctor card; "Información para cuidarte" guide cards (icon tile, category eyebrow, title, summary, read time · "Revisión médica") |
| `home-06.png` | More guide cards (Seguros médicos, Tu consulta), closing line, footer start |
| `home-07.png` | Footer: tagline, "Hecho para República Dominicana", columns El directorio / Transparencia / Hablemos, NAP block, © line |

## Design tokens (observed)
- Palette: deep teal-blue (primary, headings accents, logo), near-black navy text, coral/salmon accent (underline, dot, sponsored, plus marks), pale blue-grey section backgrounds, green for verified badge.
- Type: geometric sans for headings (Outfit-like), clean sans for body. Self-host and subset (SPEC §9).
- Cards: white, 1px light border, large radius; icon tiles in pale blue or pale coral.

## Spec alignment (to implement)
1. **Real links everywhere.** Specialty cards → `/cardiologos/`; city rows → city pages; quick links → `/cardiologos/santo-domingo/`; "Ver perfil" → `/dra-maria-perez-cardiologa`; guide cards → `/guia/...`. All plain `<a href>` in initial HTML (SPEC §0.1).
2. **Search card** is the only JS-dependent widget; it must degrade to links/`/buscar` (noindex). Selects navigate to clean hub paths (specialty → city → ARS), never indexable query params (SPEC §3, §4.1).
3. **Counts are data-driven** ("124 médicos", "842 médicos") from the DB, not hard-coded; the prototype numbers are placeholders.
4. **Doctor card** fields map to DB: sector/city, ARS, facility, `consultation_fee_min` ("Consulta desde"). Add `<time>` for verification date on the profile (SPEC §5.1). Badge text "Exequátur verificado" must only render when `exequatur_verified_at` is set.
5. **Sponsored card** (SPEC §5.6): keep the "Patrocinado" label and distinct style; add `rel="sponsored"` on external links; never place it inside a ranked/"mejores" list — on the home "Conoce a nuestros médicos" it is a featured strip, not a ranking, so keep it unordered and avoid "top/mejores" wording.
6. **Guide cards** show "Revisión médica": backed by `guides.reviewer_doctor_id` + `reviewed_at`; link target is the guide page with reviewer box (SPEC §5.3).
7. **Footer NAP** must be identical to `/contacto` (SPEC §5.5). The prototype uses placeholder "Av. de la Salud 123" / `contacto@brand.example` and a "Prototipo · datos ilustrativos" line — replace with real data and remove the prototype line before launch.
8. **Footer links** map to: `/buscar`→ use `/especialidad`-style hub index (not `/buscar`, which is noindex), `/centro` index, `/guia`, `/quienes-somos`, `/metodologia`, `/como-verificamos`, `/politica-editorial`, `/publicidad-y-patrocinios`, `/privacidad`, `/contacto`.
9. **Home page SEO additions** (not in the mockup): `<title>`/meta description, one H1 (the hero headline), `Organization` + `WebSite` JSON-LD (SPEC §6.5), self-canonical.
10. **Images**: doctor photos need explicit width/height, AVIF/WebP, descriptive alt; hero text is the LCP element, so keep it text-first (SPEC §9).
