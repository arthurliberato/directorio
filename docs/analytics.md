# Analytics & monitoring setup (SPEC §11)

## Google Analytics 4
Set `PUBLIC_GA4_ID=G-XXXXXXX` (loads only with `SITE_MODE=production`). Events are declarative: any element with
`data-event="…"` reports on click (forms on submit): `whatsapp_click`, `phone_click`, `map_open`, `website_click`,
`filter_use`, `search`. Consent banner: not included — decide with Dominican counsel (Ley 172-13) before launch.

**AI Assistants channel group** (GA4 Admin → Data display → Channel groups → new channel, condition *Source matches regex*):

```
chatgpt\.com|chat\.openai\.com|perplexity\.ai|gemini\.google\.com|claude\.ai|copilot\.microsoft\.com|bing\.com/chat
```
Place it above "Referral".

## Search consoles (day 1, manual)
Verify Google Search Console (Generative AI performance report) and Bing Webmaster Tools (AI Performance report); submit `https://[short.do]/sitemap-index.xml`.

## Crawler logs
The server prints one JSON line per crawler hit (`{"type":"bot_hit","bot":"OAI-SearchBot","status":200,…}`).
Drain stdout to your log store, then run daily: `node scripts/bot-report.ts < server.log` — exits 1 if any AI crawler got 403/429/5xx.
Also allowlist the crawlers at the CDN/WAF and verify by published IP ranges (SPEC §7.2).

## AI visibility panel
`monitoring/prompts.json` is the fixed panel (150 es + 50 en; regenerate with `node scripts/gen-prompts.ts`). Monthly, run every prompt on
ChatGPT, Perplexity, Gemini, Claude, Copilot and Google AI Mode, record results as CSV
(`run_month,engine,prompt_id,cited,cited_url,position,accuracy,notes`), then `node scripts/ai-visibility-report.ts results.csv`.
Table for long-term storage: `db/migrations/003_ai_visibility.sql`.
