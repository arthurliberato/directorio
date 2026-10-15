# Doctor Directory — Technical Spec for Claude Code

Build spec for a doctor directory in the Dominican Republic, optimized for search engines (Google, Bing) and AI answer engines (Google AI Overviews/AI Mode, ChatGPT, Perplexity, Claude, Gemini, Copilot).

- **Brand:** `[BRAND]` · **Domain:** `[short.do]` (.do ccTLD)
- **Language:** Spanish (`es-DO`) first; English (`/en/`) section later
- **Aesthetics:** the Lovable mockup in `docs/design/` defines the look (palette, typography, cards, spacing, tone) and is matched closely. It is not a code source: markup, structure and stack are built from scratch for SEO and AI-crawler needs
- **Reviews:** NOT in v1. Reserve the space and data model; spec in §12

---

## 0. Guiding principles

1. **Every fact must be in the initial HTML.** Many AI crawlers do not execute JavaScript. No client-side-only rendering of content, lists, links or JSON-LD.
2. **One source of truth.** Each fact (name, specialty, address, ARS, fee, schedule) lives once in the database and renders identically as visible text, tables and JSON-LD.
3. **Only index pages with real, unique content.** Thin or empty pages are `noindex` or 404. Google's doorway and scaled-content policies apply.
4. **Verification and freshness are visible.** Every doctor shows when their exequátur was verified and when data was last checked.
5. **Optimizing for AI search is still SEO** (Google, May 2026). Strong classic SEO first; AI-specific extras are cheap add-ons.

---

## 1. Stack

The Lovable mockup is **visual reference only**. No Lovable/React-SPA code is imported; the stack is chosen purely for search and AI-crawler performance.

**Decision: Astro (SSR on the edge, CDN-cached) + Postgres (Supabase).**

Why, against the requirements:
- **Server-rendered HTML by default, zero JS shipped unless a component opts in** (islands). Every fact, link and JSON-LD block is in the first response (§0.1), and Core Web Vitals (§9) are easy to hit.
- **Real HTTP semantics from the server:** true 404 for empty facet combinations, 301s from the `redirects` table, per-request `noindex`/canonical decided from the nightly index-status table (§4). Fully static builds can't do this cleanly at tens of thousands of pages.
- **ISR-like freshness without a React runtime:** render on request, cache at the CDN with `s-maxage` + `stale-while-revalidate`, purge the affected URLs when data changes (admin edit, verification, nightly job). Hot pages (home, top hubs, guides, trust pages) may be prerendered.
- Next.js remains an acceptable fallback, but it ships React hydration JS for pages that need none; not chosen.

Supporting choices:
- Language: TypeScript. Styling: plain CSS / Tailwind compiled to a single small stylesheet (no runtime CSS-in-JS).
- Interactive islands only: search/filters, "interactive map on click", WhatsApp/GA events. Everything else static markup.
- JSON-LD, meta tags, sitemaps, robots.txt and llms.txt are generated from the same DB queries as the visible content (one source of truth).
- Hosting: any host with edge caching near Miami (Cloudflare, Vercel or Netlify). If Cloudflare, explicitly disable/allowlist AI-bot blocking (§7.2).
- Image pipeline: AVIF/WebP, responsive `srcset`, explicit width/height.
- Admin panel (simple, internal, `noindex`): edit doctors, mark verification, toggle index status, publish guides; every save purges affected URLs and queues an IndexNow ping.

**Acceptance test:** `curl -A "OAI-SearchBot" https://[short.do]/dra-maria-perez-cardiologa` must return full HTML containing the doctor's name, fact table, contact info and JSON-LD, with zero JS needed.

---

## 2. Data model (minimum)

```
doctors
  id, slug (unique), full_legal_name, display_name, gender
  specialty_id, subspecialties[]
  exequatur_number, exequatur_decree, cedula_hash      -- never display cédula
  exequatur_verified_at, cmd_member (bool), cmd_verified_at
  specialty_verified_at, claimed (bool), claimed_at
  bio, education[], languages[], photo_url
  consultation_fee_min, consultation_fee_max, currency (DOP)
  accepting_new_patients (bool)
  whatsapp, phone, website, gbp_url, sameas_urls[]
  data_verified_at, updated_at
  index_status (auto | force_index | force_noindex)

locations          -- a doctor can have several
  id, doctor_id, facility_id (nullable), address, sector_id, city_id,
  lat, lng, schedule (structured: day, open, close), phone

facilities         -- clinics/hospitals
  id, slug, name, type (Hospital | MedicalClinic), address, city_id, sector_id, phone, website

specialties        -- id, slug (plural, e.g. cardiologos), name_singular, name_plural, schema_enum (e.g. Cardiovascular)
cities             -- id, slug, name, province
sectors            -- id, slug, name, city_id
ars                -- id, slug, name (Humano, Universal, SeNaSa, Mapfre Salud, ...)
doctor_ars         -- doctor_id, ars_id, verified_at

guides             -- id, slug, title, answer_summary, body, reviewer_doctor_id,
                      reviewed_at, sources[] (title, url), related_specialty_ids[]

verification_log   -- doctor_id, type (exequatur|cmd|claim), method, result,
                      evidence_hash, checked_at, checked_by

redirects          -- from_path, to_path, status (301)
```

Verification: check exequátur via the PGR "Consultar Exequátur" service (by cédula). Store the result, date and an evidence hash. Re-verify every 6 months (scheduled job flags overdue doctors).

---

## 3. URL architecture

| Page | URL |
|---|---|
| Doctor profile | `/dra-maria-perez-cardiologa` (root) |
| Specialty hub (national) | `/cardiologos/` |
| Specialty × city | `/cardiologos/santo-domingo/` |
| Specialty × city × sector | `/cardiologos/santo-domingo/piantini/` |
| Specialty × city × ARS | `/cardiologos/santo-domingo/ars-humano/` |
| Facility | `/centro/hospital-x` |
| Guide | `/guia/cuanto-cuesta-consulta-cardiologo` |
| Pagination | `/cardiologos/santo-domingo/pagina/2/` |
| English | `/en/...` (mirror structure, later) |

Rules:
- Lowercase, hyphens, **no accents** in slugs (`ginecologos`); accents kept in visible titles.
- **Reserved root slugs** (block doctor slugs from colliding): `especialidad, ciudad, ars, guia, centro, en, metodologia, quienes-somos, como-verificamos, politica-editorial, publicidad-y-patrocinios, privacidad, contacto, buscar, api, admin, pagina, llms.txt, robots.txt, sitemap*`, and every specialty slug.
- Duplicate names: disambiguate with specialty/city (`-cardiologa-santiago`), not `-2`.
- **Any slug change → 301** via the `redirects` table. Never break old URLs.
- Trailing-slash policy: pick one, enforce site-wide with 301s.
- Fixed facet order in paths: specialty → city → sector OR ars. Never two orders for the same combination.

---

## 4. Indexing logic

### 4.1 Facets

| Facet | Indexable | How |
|---|---|---|
| Specialty × city | Yes if ≥ 5 published doctors | Static path, in sitemap |
| + sector | Yes if ≥ 5 doctors | Static path |
| + ARS | Yes if ≥ 5 doctors (top ARS × main specialties × main cities) | Static path |
| Sort, fee range, gender, availability, "rating" | **Never** | Query params (`?orden=`, `?genero=`) blocked in robots.txt, or `#` fragments |
| Combination with 0 results | No | **HTTP 404** (real 404, not soft-404, not redirect) |
| Combination with 1–4 results | No | Render page with `noindex,follow`; exclude from sitemap |

### 4.2 Doctor profiles

Index a profile only if:
- `exequatur_verified_at` is set, AND
- it has ≥ 3 verified data points beyond name (confirmed address, ARS list, schedule, photo, bio) — OR `claimed = true`.

Otherwise `noindex,follow` (still reachable through internal links).
`index_status` override (`force_index` / `force_noindex`) wins.

### 4.3 Automation

- Nightly job recomputes index status for all hubs and profiles, updates the sitemap and pings IndexNow for changed URLs.
- Log every status change (URL, old, new, reason).

### 4.4 Tags on every page

```html
<link rel="canonical" href="https://[short.do]/[self-path]">   <!-- self-referencing, absolute -->
<meta name="robots" content="index,follow">                     <!-- or noindex,follow per rules -->
```
- Paginated pages: self-canonical (page 2 canonical → page 2). Do NOT canonicalize to page 1.
- URLs with filter params: canonical → clean hub path.

---

## 5. Page templates — technical requirements

### 5.1 Doctor profile
- `<title>`: `Dra. María Pérez, Cardióloga en Santo Domingo | [BRAND]`
- Meta description: built from facts (specialty, sector, ARS, fee), ≤ 155 chars.
- H1: full legal name + specialty.
- Breadcrumbs (visible + `BreadcrumbList`).
- **Fact summary paragraph (40–60 words)** generated from data, top of page:
  > La Dra. María Pérez es cardióloga en Santo Domingo (Piantini), con exequátur verificado el 02/10/2026. Atiende en Centro Médico X de lunes a jueves. Acepta ARS Humano, Universal y SeNaSa. Consulta: RD$3,000.
- **Fact table** as a real HTML `<table>` (or `<dl>`): specialty, sub-specialties, locations, schedule, ARS, fee, languages, hospitals, education, accepting new patients.
- Verification badge with date; footer line "Datos verificados el [fecha]" (`<time datetime>`).
- Contact: WhatsApp link (`https://wa.me/...` with UTM-free tracking via data attributes), `tel:` link.
- Map: static image first (`<img>` with address alt), interactive map loads on click.
- Internal links: specialty hub, city hub, sector hub, facility pages, ARS hubs, 3–5 nearby same-specialty doctors.
- Reserved, hidden reviews section (no markup until §12 is live).
- JSON-LD: §6.1.

### 5.2 Specialty × city (× sector / ARS) hub
- `<title>`: `Cardiólogos en Santo Domingo (42 verificados) | [BRAND]`
- H1 + **data-driven intro** unique to this page: doctor count, fee range (min/median/max), ARS distribution, top facilities, languages. This is what keeps hubs from being doorway pages.
- Comparison `<table>`: doctor (link), sub-specialty, sector, ARS, fee, next availability.
- Doctor cards: top 20 + pagination with plain `<a href>` links.
- Q&A block (visible, data-driven answers), e.g. "¿Cuánto cuesta una consulta con cardiólogo en Santo Domingo?" → answered from the hub's own fee data with n and date.
- Filters: non-indexable (params/fragments).
- JSON-LD: §6.3.

### 5.3 Guide
- Structure: H1 → **2-sentence direct answer** → table → detailed body → sources list (linked) → reviewer box → disclaimer.
- Reviewer box: "Revisado por Dr. X, [especialidad], exequátur verificado" + `reviewed_at`.
- Statistics from own data must state n and date ("n=142 perfiles, sept. 2026").
- Links to related specialty hubs.
- JSON-LD: §6.4.

### 5.4 Facility page
- Facts, address, static map, list of doctors (links). JSON-LD `Hospital` / `MedicalClinic`.

### 5.5 Trust pages (static, all indexable)
`/quienes-somos`, `/metodologia`, `/como-verificamos`, `/politica-editorial`, `/publicidad-y-patrocinios`, `/privacidad`, `/contacto` (physical Santo Domingo address, identical NAP to footer).

### 5.6 Sponsored placements
- Always labeled "Patrocinado", visually distinct, never inside ranked/ordered "best" lists.
- Sponsored links to external sites: `rel="sponsored"`.

### 5.7 404 page
- Real HTTP 404 status, helpful links (search, popular specialties).

---

## 6. Structured data (JSON-LD)

Rules: JSON-LD rendered server-side in `<head>` or `<body>`; every value must match visible text; omit unknown fields (never invent). Validate with Google Rich Results Test + Schema.org validator in CI.

### 6.1 Doctor profile — `IndividualPhysician`

```json
{
  "@context": "https://schema.org",
  "@type": "IndividualPhysician",
  "@id": "https://[short.do]/dra-maria-perez-cardiologa#physician",
  "name": "Dra. María Pérez",
  "url": "https://[short.do]/dra-maria-perez-cardiologa",
  "image": "https://[short.do]/img/dra-maria-perez.webp",
  "description": "Cardióloga en Santo Domingo (Piantini)...",
  "medicalSpecialty": "https://schema.org/Cardiovascular",
  "knowsLanguage": ["es", "en"],
  "isAcceptingNewPatients": true,
  "telephone": "+1-809-555-0000",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Av. Abraham Lincoln #000",
    "addressLocality": "Santo Domingo",
    "addressRegion": "Distrito Nacional",
    "addressCountry": "DO"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": 18.47, "longitude": -69.94 },
  "practicesAt": [{
    "@type": "MedicalClinic",
    "@id": "https://[short.do]/centro/centro-medico-x#org",
    "name": "Centro Médico X"
  }],
  "hospitalAffiliation": [{ "@type": "Hospital", "name": "Hospital Y" }],
  "hasCredential": {
    "@type": "EducationalOccupationalCredential",
    "credentialCategory": "Exequátur",
    "recognizedBy": { "@type": "GovernmentOrganization", "name": "Poder Ejecutivo de la República Dominicana" }
  },
  "identifier": { "@type": "PropertyValue", "propertyID": "Exequátur", "value": "[decree/number]" },
  "alumniOf": { "@type": "CollegeOrUniversity", "name": "[Universidad]" },
  "paymentAccepted": "Efectivo, tarjeta, ARS",
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday"],
    "opens": "08:00", "closes": "12:00"
  }],
  "sameAs": ["[doctor website]", "[GBP url]", "[society listing]"]
}
```
- `IndividualPhysician` is the schema.org v24+ type for an individual doctor (`practicesAt` exists only on it).
- Only include the exequátur identifier if publishing it is cleared; otherwise omit `identifier`.
- Do NOT use `usNPI`.
- Add `aggregateRating` / `review` only in phase 2 (§12).

### 6.2 Facility — `Hospital` or `MedicalClinic`
`@id`, name, address, geo, telephone, url, `member` → list of `IndividualPhysician` `@id`s.

### 6.3 Hub — `CollectionPage` + `ItemList` + `BreadcrumbList`

```json
[
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Cardiólogos en Santo Domingo",
    "url": "https://[short.do]/cardiologos/santo-domingo/",
    "about": { "@type": "MedicalSpecialty", "name": "Cardiología" },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": 42,
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "url": "https://[short.do]/dra-maria-perez-cardiologa" }
      ]
    }
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://[short.do]/" },
      { "@type": "ListItem", "position": 2, "name": "Cardiólogos", "item": "https://[short.do]/cardiologos/" },
      { "@type": "ListItem", "position": 3, "name": "Santo Domingo", "item": "https://[short.do]/cardiologos/santo-domingo/" }
    ]
  }
]
```

### 6.4 Guide — `MedicalWebPage`
```json
{
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  "headline": "¿Cuánto cuesta una consulta con cardiólogo en RD?",
  "url": "https://[short.do]/guia/...",
  "audience": { "@type": "Patient" },
  "about": { "@type": "MedicalSpecialty", "name": "Cardiología" },
  "lastReviewed": "2026-10-01",
  "reviewedBy": { "@type": "IndividualPhysician", "@id": "https://[short.do]/dr-x#physician", "name": "Dr. X" },
  "citation": ["https://source-1", "https://source-2"],
  "publisher": { "@id": "https://[short.do]/#org" }
}
```
`FAQPage` markup: only where Q&A is visible on page. FAQ rich results were retired by Google in 2026 — keep it only as harmless structure, not as a KPI.

### 6.5 Site-wide — `Organization` + `WebSite` (home page)
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://[short.do]/#org",
  "name": "[BRAND]",
  "url": "https://[short.do]/",
  "logo": "https://[short.do]/logo.png",
  "address": { "@type": "PostalAddress", "addressLocality": "Santo Domingo", "addressCountry": "DO" },
  "sameAs": ["[Instagram]", "[LinkedIn]", "[YouTube]", "[Wikidata — later]"]
}
```
Plus `WebSite` with `name`, `url`, `publisher` → `#org`.

---

## 7. Crawler access

### 7.1 robots.txt

```
# Search engines
User-agent: Googlebot
Allow: /
User-agent: Bingbot
Allow: /
User-agent: Applebot
Allow: /

# AI search / retrieval
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: Claude-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Perplexity-User
Allow: /

# AI training (decision: allow — brand recall in models)
User-agent: GPTBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /

# Everyone: no search/filter/sort URLs
User-agent: *
Disallow: /buscar
Disallow: /admin
Disallow: /api/
Disallow: /*?*orden=
Disallow: /*?*genero=
Disallow: /*?*precio=
Disallow: /*?*disponibilidad=

Sitemap: https://[short.do]/sitemap-index.xml
```
Note: a crawler matching a specific `User-agent` group ignores the `*` group, so if filter params must be blocked for named bots too, repeat the `Disallow` lines in each group (or generate the file programmatically).

### 7.2 CDN / WAF
- Bot protection (Cloudflare etc.) must NOT block the agents above. Explicitly allowlist them, verified by published IP ranges (e.g. OpenAI's `searchbot.json`).
- Test: request pages with each user agent; expect 200, not 403/challenge.

### 7.3 llms.txt (optional, low priority)
`/llms.txt` in Markdown: brand summary, links to `/metodologia`, `/como-verificamos`, top specialty hubs, top guides, contact for data licensing. Google ignores it; harmless elsewhere.

---

## 8. Sitemaps & indexing APIs

- `sitemap-index.xml` → `sitemap-doctors-N.xml`, `sitemap-hubs.xml`, `sitemap-guides.xml`, `sitemap-facilities.xml`, `sitemap-pages.xml`, later `sitemap-en.xml`.
- ≤ 50,000 URLs per file. Only indexable, canonical, 200-status URLs.
- `<lastmod>` = real date of last meaningful data change (not build time).
- **IndexNow**: key file at root; ping changed/new/removed URLs (Bing, Yandex, others).
- Submit sitemaps to Google Search Console and Bing Webmaster Tools.

---

## 9. Performance

- Targets (mobile, mid-range Android, 4G): **LCP < 2.5s, INP < 200ms, CLS < 0.1**.
- Static HTML from CDN; minimal JS (hydrate only interactive widgets: search, filters, map).
- Images: AVIF/WebP, explicit dimensions, lazy-load below the fold, priority for the LCP image.
- Fonts: self-hosted, `font-display: swap`, subset to Latin.
- Map: static image placeholder; load map library on click.
- Lighthouse CI in the pipeline; fail build if mobile performance < 90.

---

## 10. Internationalization (phase 2)

- `/en/` subfolder mirroring Spanish paths (`/en/dra-maria-perez-cardiologa`).
- hreflang on both versions, reciprocal and self-referencing:
```html
<link rel="alternate" hreflang="es-DO" href="https://[short.do]/dra-maria-perez-cardiologa">
<link rel="alternate" hreflang="en" href="https://[short.do]/en/dra-maria-perez-cardiologa">
<link rel="alternate" hreflang="x-default" href="https://[short.do]/dra-maria-perez-cardiologa">
```
- Translate only: English-speaking doctors' profiles, tourism cities (Punta Cana, Puerto Plata, Santo Domingo), dental/plastic/bariatric/fertility hubs, cost guides. No bulk machine translation without review.

---

## 11. Analytics & monitoring

- **Google Search Console** (incl. Generative AI performance report) and **Bing Webmaster Tools** (incl. AI Performance report) — verify on day 1.
- **GA4** with a custom channel group "AI Assistants", referrer regex:
  ```
  chatgpt\.com|chat\.openai\.com|perplexity\.ai|gemini\.google\.com|claude\.ai|copilot\.microsoft\.com|bing\.com/chat
  ```
- Events: `whatsapp_click`, `phone_click`, `map_open`, `website_click`, `filter_use`, `search`.
- **Server/CDN logs**: daily counts by user agent (Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, Claude-*, PerplexityBot…), 4xx/403 rates per bot. Alert if AI bots get 403s.
- **AI visibility panel**: monthly run of a fixed list of ~150 Spanish + 50 English prompts on ChatGPT, Perplexity, Gemini, Claude, Copilot, Google AI Mode; log whether [BRAND] is cited, which URL, position, and factual accuracy. Store in a table for trend charts.
- **Internal dashboard**: verified doctors, % claimed, indexable pages by type, overdue re-verifications.

---

## 12. Phase 2 — Verified reviews (do not build in v1, design for it)

Data model to reserve:
```
reviews
  id, doctor_id, location_id, rating (1–5), attributes (puntualidad, trato, explicación, instalaciones),
  body, display_name (initials/pseudonym), verification_level (booking | doctor_invite | proof | unverified),
  verification_evidence_ref, consent_record_id, status (pending|published|under_review|removed),
  created_at, published_at, doctor_reply, doctor_reply_at
consents
  id, subject_ref, purpose, text_version, granted_at, revoked_at, channel
```
Technical rules for later:
- Only verified reviews count toward rating and go into JSON-LD (`aggregateRating`, `review`); unverified are labeled and excluded.
- Mark up only reviews visible on the page. Never import or mark up Google reviews.
- Reviews on [short.do] are eligible for review stars (third-party site). A doctor-site embed widget must NOT output review structured data.
- No review gating; negative reviews never removed for being negative; one public doctor reply per review.
- Each new review updates `<lastmod>` and pings IndexNow.
- Consent capture and deletion flows per Ley 172-13 (legal review required before launch).

Doctor badge widget (phase 2): static HTML snippet with a plain link to the profile, e.g. "Médico verificado en [BRAND]" — no structured data in the snippet.

---

## 13. Launch checklist

- [ ] All content, links and JSON-LD present in initial HTML (curl test with AI user agents)
- [ ] Reserved slugs enforced; 301 redirects table working; trailing-slash policy enforced
- [ ] Indexing rules coded (≥5 doctors per hub, profile thresholds); nightly recompute job
- [ ] Empty combinations return real 404; filter params non-indexable; self-canonicals everywhere
- [ ] JSON-LD for all templates validated in CI (Rich Results Test + Schema validator)
- [ ] robots.txt deployed; WAF allowlists AI crawlers; no 403s in logs
- [ ] Segmented sitemaps with real `lastmod`; submitted to GSC + Bing; IndexNow live
- [ ] Core Web Vitals passing on mobile; Lighthouse CI ≥ 90
- [ ] Trust pages live; footer NAP consistent
- [ ] Sponsored placements labeled, `rel="sponsored"`, outside rankings
- [ ] GA4 AI channel group + events; log monitoring; AI prompt panel set up
- [ ] Exequátur verification log populated for every published doctor; 6-month re-verification job
- [ ] `/llms.txt` published (optional)

---

## 14. Things to re-check before launch (fast-moving)

- AI crawler names and IP lists (OpenAI, Anthropic, Perplexity, Apple, Google)
- Google's guidance on AI features and structured data eligibility
- Search Console / Bing AI reporting features
- Legal items (Ley 172-13, Ley 358-05, CMD ethics code) — with Dominican counsel
