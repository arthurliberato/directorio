# Project notes for Claude Code

Doctor directory for the Dominican Republic, built for SEO + AI answer engines. **Read `SPEC.md` first**; it is the source of truth.

- Stack: Astro SSR (Node adapter) + Postgres. Server-rendered HTML only: every fact, link and JSON-LD must be in the initial response; ship no JS unless an interaction needs it.
- Data flow: pages -> `src/lib/data.ts` -> in-memory snapshot (`src/lib/dataset.ts`) from Postgres (`DATABASE_URL`) or the seed (`src/data/seed.ts`). Never query the DB from pages.
- One source of truth: visible text, tables and JSON-LD (`src/lib/schema.ts`) come from the same records. Omit unknown fields; never invent data.
- Indexing rules live in `src/lib/indexing.ts` (+ `nightly.ts`, `sitemap.ts`); sitemaps and the nightly state must stay equal (tested).
- Paths: no trailing slash, lowercase, no accents in slugs, fixed facet order (specialty -> city -> sector|ars). Empty combos are real 404s.
- Aesthetics follow `docs/design/` (calm blue/coral, rounded cards, Outfit + Inter); markup is our own.
- Verify with: `npx astro check`, `npm test`, and (server running with `SITE_MODE=production`) `node scripts/check-html.mjs`, `scripts/crawl.mjs`, `scripts/lighthouse.mjs`.
- Listing tiers (SPEC §2.1): only `affiliated` doctors show photos, the verified badge, sort first and can be indexed; `listed` are informational/no photo/noindex; never claim verification for them, never guess gender, never import direct phones.
- Do not add review markup, `usNPI`, or index seed data. `SITE_MODE=prototype` must keep everything noindex.
