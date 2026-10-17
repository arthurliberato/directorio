# Launch runbook — things only a human can do

Everything else is automated (see README). In order:

1. **Supabase**: create a project; run `db/migrations/001_core.sql`, `003_ai_visibility.sql` and `004_listing_tiers.sql` (not `002_reviews_reserved.sql`). Set `DATABASE_URL` on the host and as a GitHub secret.
2. **Reference data + real doctors**: run `db/reference/001_reference_data.sql` (specialties, cities, sectors, ARS; review ARS names), then import doctors with `scripts/import-doctors.ts` (see `docs/import.md`). Imports are unverified/unpublished until each exequátur is verified in `/admin`.
   **Real data**: import doctors (verified exequátur only). Until then keep `SITE_MODE=prototype`. Replace seed copy: trust pages (`src/data/trust.ts`), guides (need a real physician reviewer), footer NAP (`src/config.ts`) — identical to `/contacto`.
3. **Domain + brand**: set `PUBLIC_SITE_URL`, replace `[BRAND]` (`src/config.ts`, `public/logo.svg`, titles), set real social `sameAs` in `siteJsonLd()`.
4. **Hosting**: deploy the Node server (`npm run build && npm start`) behind a CDN near Miami. CDN must honor `Cache-Control: s-maxage`; set `PURGE_WEBHOOK_URL` if you want purges after admin writes.
5. **WAF / bot protection**: allowlist the crawlers in SPEC §7.1 (verify by published IP ranges); never challenge them. Test: `curl -A "OAI-SearchBot" https://[short.do]/` → 200.
6. **Secrets/env**: `ADMIN_PASSWORD` (+`ADMIN_USER`), `INDEXNOW_KEY`, `PUBLIC_GA4_ID`, `SITE_MODE=production` (last, after steps 1–5).
7. **Search consoles**: verify GSC + Bing Webmaster Tools; submit `/sitemap-index.xml`.
8. **GA4**: create the "AI Assistants" channel group (regex in `docs/analytics.md`).
9. **Legal (Dominican counsel)**: privacy policy (Ley 172-13), cookie/consent approach for GA4, whether to publish exequátur numbers (`PUBLISH_EXEQUATUR_IDENTIFIER`), CMD ethics code on advertising, before any reviews launch.
10. **Run the gates against production**: `BASE=https://[short.do] node scripts/check-html.mjs`, `scripts/crawl.mjs`, `scripts/lighthouse.mjs`; re-check the fast-moving items in SPEC §14.
