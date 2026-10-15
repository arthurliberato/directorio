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
- Data: `DATABASE_URL` set => Postgres (`db/migrations/`, loaded into a refreshing in-memory snapshot); unset => illustrative seed (`src/data/seed.ts`). `node scripts/seed-db.ts` loads the seed into a database. Schema, triggers (reserved slugs, auto-301 on slug change) and the seed round-trip are tested against Postgres (PGlite).
- `SITE_MODE=prototype` (default) makes the whole site `noindex` and `robots.txt` `Disallow: /`. Set `SITE_MODE=production` only with real data.
- Built: home, doctor profile, specialty/city/sector/ARS hubs with pagination, facility, guides, trust pages, `/buscar` (no-JS redirect), robots.txt, llms.txt, segmented sitemaps, 301/404 handling, JSON-LD, IndexNow key file.
- Nightly job (`node scripts/nightly.ts`, GitHub Action included): recomputes index status for every URL, logs each change (`index_status_log`), lists overdue re-verifications, pings IndexNow for new/changed/de-indexed/removed URLs.
- Admin (`/admin`, HTTP Basic via `ADMIN_PASSWORD`): dashboard metrics, index-status override, audited exequátur verification (writes `verification_log`). Read-only on seed data.
- Not built yet: GA4 wiring, `/en/`, Lighthouse CI, real static maps, automated PGR exequátur lookup, doctor edit forms beyond the two admin actions.
