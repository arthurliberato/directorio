# [BRAND] — Doctor directory (DR)

Astro (SSR, CDN-cached) + Postgres. Full requirements: [`SPEC.md`](SPEC.md). Aesthetic reference: [`docs/design/`](docs/design/README.md).

```bash
npm install
npm run dev                      # http://localhost:4321
npm test                         # unit tests: indexing rules, slugs, JSON-LD, robots, sitemaps
npm run build && SITE_MODE=production npm start &
node scripts/check-html.mjs      # acceptance test: fetches pages as AI crawlers, asserts initial HTML
```

## Status
- Data is an **illustrative seed** (`src/data/seed.ts`) behind `src/lib/data.ts`; swap that module for Postgres (`db/migrations/`).
- `SITE_MODE=prototype` (default) makes the whole site `noindex` and `robots.txt` `Disallow: /`. Set `SITE_MODE=production` only with real data.
- Built: home, doctor profile, specialty/city/sector/ARS hubs with pagination, facility, guides, trust pages, `/buscar` (no-JS redirect), robots.txt, llms.txt, segmented sitemaps, 301/404 handling, JSON-LD (Physician, Hospital/Clinic, CollectionPage, Breadcrumb, FAQ, MedicalWebPage, Organization/WebSite).
- Not built yet: admin panel, nightly index recompute + IndexNow ping, verification job, GA4 wiring, `/en/`, Lighthouse CI, real static maps.
