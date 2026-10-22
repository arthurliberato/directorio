# guiddo-bot

WhatsApp bot of [guiddo](https://guiddo.net), split out of the website (Option A of `docs/whatsapp-bot-separation.md`).
It runs as its own Render Web Service, reads the **same Postgres catalog** as the site and writes only `appointment_requests`.

```
Meta Cloud API ──POST /webhook──▶ guiddo-bot ──select──▶ Postgres (catalog) ◀── site (Astro)
                                       └─insert/update─▶ appointment_requests
```

## What is here

| Path | Origin | Role |
|---|---|---|
| `src/server.ts`, `src/webhook.ts`, `src/simulator.ts` | **bot only** | HTTP server, webhook (verify + HMAC + background reply), Basic-auth simulator |
| `src/lib/admin-db.ts`, `src/lib/admin-run.ts` | **bot only** | Tiny shims so `appointments.ts` runs unchanged (query type + `withDb`) |
| everything else under `src/` and `tests/whatsapp.test.ts` | **copied verbatim from the site** | Bot logic, catalog, tier rules (SPEC §2.1) |

The copied files are never edited here. Change them in the site, then run `npm run sync`; `npm run sync:check` exits 1 on drift (use it in CI) so the affiliated/listed rules cannot diverge between the two services.
When this folder lives in its own repository, pass the path of a site checkout: `scripts/sync-from-site.sh ../directorio`.

## Run

```bash
npm install
npm test            # 7 bot tests (copied) + webhook/simulator tests
npm run check       # tsc
PORT=8787 ADMIN_PASSWORD=pw npm start   # no DATABASE_URL => illustrative seed (refused when NODE_ENV=production)
```
Needs Node >= 22.18 (runs TypeScript directly). Variables: see `.env.example`.

Routes: `GET|POST /webhook` (alias `/api/whatsapp`, so Meta's callback can be flipped by changing only the host), `GET /healthz`, `GET /admin/simulator` (404 unless `ADMIN_PASSWORD` is set).

## Deploy (order from the separation doc §5)

1. **Database role**: run `db/bot-role.sql` (change the password) in Supabase. `select` on the 10 catalog tables, `select/insert/update` on `appointment_requests` only. Use that role's connection string as `DATABASE_URL`.
2. **Render**: new Web Service from `render.yaml` (one instance only: pending appointment requests and webhook de-duplication are in memory), custom domain e.g. `bot.guiddo.net`. Copy the `WHATSAPP_*` values and `CEDULA_PEPPER` from the site's service.
3. **Test** with Meta's test number: `https://bot.guiddo.net/webhook` + the verify token, send a few messages, try the simulator.
4. **Switch** the callback URL in Meta from the site to the bot. Check real round trips.
5. **Only then** open a separate PR removing the bot from the site.

## Notes for the removal PR (site side)

- `src/pages/admin/solicitudes` imports `listRequests` from `src/lib/whatsapp/appointments.ts`. Move `listRequests` to a site module (e.g. `admin-db.ts`) **before** deleting `src/lib/whatsapp/`, or the admin list of appointment requests breaks. The site keeps `appointment_requests` read access through its own role.
- Also remove, per doc §4: `src/pages/api/whatsapp.ts`, `src/pages/admin/whatsapp.astro`, `tests/whatsapp.test.ts`, the `/api/whatsapp` exception in `src/middleware.ts`, the AdminShell link, `BOT_NAME` in `src/config.ts`, `src/lib/search.ts` if unused, and `WHATSAPP_*` from the site's Render env. After that `scripts/sync-from-site.sh` no longer has a source: this folder becomes the owner of those files and the sync script should be deleted.
- Both services run the same in-memory dedupe/state per process: do not point Meta at both at once.

## Still open (not code)

Meta setup guide, privacy notice / consent text (Ley 172-13), WhatsApp Business display name "guiddo", and who answers human handoffs.
