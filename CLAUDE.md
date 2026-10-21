# Project notes for Claude Code

Doctor directory for the Dominican Republic, built for SEO + AI answer engines. **Read `SPEC.md` first**; it is the source of truth.

- Stack: Astro SSR (Node adapter) + Postgres. Server-rendered HTML only: every fact, link and JSON-LD must be in the initial response; ship no JS unless an interaction needs it.
- Data flow: pages -> `src/lib/data.ts` -> in-memory snapshot (`src/lib/dataset.ts`) from Postgres (`DATABASE_URL`) or the seed (`src/data/seed.ts`). Never query the DB from pages.
- One source of truth: visible text, tables and JSON-LD (`src/lib/schema.ts`) come from the same records. Omit unknown fields; never invent data.
- Indexing rules live in `src/lib/indexing.ts` (+ `nightly.ts`, `sitemap.ts`); sitemaps and the nightly state must stay equal (tested).
- Paths: no trailing slash, lowercase, no accents in slugs, fixed facet order (specialty -> city -> sector|ars). Empty combos are real 404s.
- Brand is **guiddo** (domain guiddo.io). Look and feel follow `docs/design/guiddo/DESIGN.md` (paper/ink/blue tokens in `src/styles/tokens.css`, Nunito + Nunito Sans + JetBrains Mono, receta cards, señalización signs); markup is our own. Old Lovable mockups in `docs/design/` are superseded. Small blue text uses `--gd-blue-ink`, never `#5E9BD6`; don't use anything under DESIGN.md §11 Parked. No reviews / "pacientes confirmados" counts until reviews exist.
- Verify with: `npx astro check`, `npm test`, and (server running with `SITE_MODE=production`) `node scripts/check-html.mjs`, `scripts/crawl.mjs`, `scripts/lighthouse.mjs`.
- Listing tiers (SPEC §2.1): only `affiliated` doctors show photos, the verified badge, sort first and can be indexed; `listed` are informational/no photo/noindex; never claim verification for them, never guess gender, never import direct phones.
- Do not add review markup, `usNPI`, or index seed data. `SITE_MODE=prototype` must keep everything noindex.
