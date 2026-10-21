// Acceptance test (SPEC §1/§13): fetch pages as AI crawlers and verify facts, links and JSON-LD are in the
// initial HTML, status codes/robots/canonicals are right. Usage: BASE=http://127.0.0.1:4321 node scripts/check-html.mjs
const BASE = process.env.BASE ?? 'http://127.0.0.1:4321';
const BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'PerplexityBot', 'Googlebot', 'Bingbot'];
let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.error('FAIL', msg); } else console.log('ok  ', msg); };
const get = (path, ua = 'OAI-SearchBot') => fetch(BASE + path, { redirect: 'manual', headers: { 'User-Agent': ua } });
const ldBlocks = (html) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
const meta = (html, name) => html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1];

for (const ua of BOTS) {
  const r = await get('/dra-maria-perez-cardiologa', ua);
  ok(r.status === 200, `${ua}: profile 200`);
}
{
  const r = await get('/dra-maria-perez-cardiologa'); const html = await r.text();
  ok(html.includes('María Pérez'), 'profile has doctor name');
  ok(/<table class="facts"/.test(html), 'profile has fact table');
  ok(html.includes('wa.me/') && html.includes('tel:'), 'profile has WhatsApp + tel links');
  ok(ldBlocks(html).some((d) => d['@type'] === 'IndividualPhysician'), 'profile has IndividualPhysician JSON-LD');
  ok(ldBlocks(html).some((d) => d['@type'] === 'BreadcrumbList'), 'profile has BreadcrumbList JSON-LD');
  ok(/<link rel="canonical" href="[^"?]+dra-maria-perez-cardiologa">/.test(html), 'profile self-canonical');
  ok(/<time datetime="\d{4}-\d{2}-\d{2}">/.test(html), 'profile has <time> verification dates');
  ok(!/aggregateRating|"review"/.test(html), 'no review markup in v1');
  ok(/Programar cita/.test(html) && /wa\.me\/\d+\?text=/.test(html), 'verified profile has the "Programar cita" panel with a prefilled WhatsApp link');
}
{
  const html = await (await get('/cardiologos/santo-domingo')).text();
  const ld = ldBlocks(html);
  ok(ld.some((d) => d['@type'] === 'CollectionPage' && d.mainEntity.itemListElement.length > 0), 'hub CollectionPage + ItemList');
  ok((html.match(/<a href="\/dr[a]?-/g) ?? []).length >= 9, 'hub doctor links are plain <a href> in HTML');
  ok(/<table class="compare"/.test(html), 'hub comparison table');
  ok(/<form class="wrap refine"/.test(html) && !/Hay \d+ /.test(html), 'hub has refine filters and does not state how many doctors exist');
}
{
  const html = await (await get('/cardiologos/santo-domingo?orden=precio')).text();
  ok(html.includes('<link rel="canonical" href="https://guiddo.net/cardiologos/santo-domingo">') || /canonical" href="[^"]*\/cardiologos\/santo-domingo">/.test(html), 'filter-param URL canonicalizes to clean hub');
}
ok((await get('/neurologos')).status === 404, 'empty specialty hub is a real 404');
ok((await get('/oftalmologos/santo-domingo')).status === 404, 'empty facet combo is a real 404');
ok((await get('/dr-sin-verificar-cardiologo')).status === 404, 'unverified doctor is 404');
ok((await get('/cardiologos/piantini')).status === 404, 'wrong facet order is 404');
{
  const r = await get('/dermatologos/santo-domingo'); const html = await r.text();
  ok(r.status === 200 && /noindex/.test(meta(html, 'robots') ?? '') || meta(html, 'robots')?.includes('noindex'), 'hub with <5 doctors is noindex (or site is in prototype mode)');
}
{
  const r = await get('/dr-datos-minimos-pediatra'); const html = await r.text();
  ok(r.status === 200 && (meta(html, 'robots') ?? '').startsWith('noindex'), 'thin profile is noindex,follow');
}
{
  const html = await (await get('/marcos-tejeda-liriano-cardiologia')).text();
  ok(!/Programar cita/.test(html), 'listed (unverified) profiles have no booking buttons');
}
for (const [from, to] of [['/cardiologos/', '/cardiologos'], ['/Cardiologos', '/cardiologos'], ['/dr-rafael-santos', null]]) {
  const r = await get(from); const loc = new URL(r.headers.get('location') ?? BASE, BASE).pathname;
  ok(r.status === 301 && (to ? loc === to : /^\/dra?-/.test(loc)), `301 ${from} -> ${to ?? loc}`);
}
{
  const r = await get('/robots.txt'); const t = await r.text();
  ok(r.status === 200 && /Sitemap:/.test(t) || /Disallow: \//.test(t), 'robots.txt served');
  const idx = await (await get('/sitemap-index.xml')).text();
  ok(idx.includes('<sitemapindex'), 'sitemap index served');
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
