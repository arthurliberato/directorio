// Site crawl: every sitemap URL must be 200, self-canonical, indexable, with valid JSON-LD; every internal link must resolve.
// Usage: BASE=http://127.0.0.1:4321 node scripts/crawl.mjs   (server must run with SITE_MODE=production)
const BASE = process.env.BASE ?? 'http://127.0.0.1:4321';
const SITE = process.env.PUBLIC_SITE_URL ?? 'https://short.do';
const UA = { 'User-Agent': 'OAI-SearchBot' };
let problems = 0;
const bad = (m) => { problems++; console.error('PROBLEM', m); };
const local = (u) => u.replace(SITE, BASE);
const txt = async (p) => (await fetch(BASE + p, { headers: UA, redirect: 'manual' }));

const index = await (await txt('/sitemap-index.xml')).text();
const sitemaps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const urls = [];
for (const s of sitemaps) urls.push(...[...(await (await txt(s)).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
console.log(`sitemap URLs: ${urls.length}`);

const links = new Map(); // internal href -> first page that links to it
for (const u of urls) {
  const path = new URL(u).pathname;
  const r = await txt(path);
  if (r.status !== 200) { bad(`${path}: status ${r.status}`); continue; }
  const html = await r.text();
  const canon = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (canon !== u) bad(`${path}: canonical ${canon} != ${u}`);
  const robots = html.match(/<meta name="robots" content="([^"]+)"/)?.[1];
  if (robots !== 'index,follow') bad(`${path}: robots=${robots} but listed in sitemap`);
  if (!/<title>[^<]{10,}<\/title>/.test(html)) bad(`${path}: missing title`);
  if (!/<meta name="description" content="[^"]{30,}/.test(html)) bad(`${path}: missing description`);
  if ((html.match(/<h1[ >]/g) ?? []).length !== 1) bad(`${path}: expected exactly one h1`);
  for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try { const d = JSON.parse(m[1]); if (!d['@context'] || !d['@type']) bad(`${path}: JSON-LD missing @context/@type`); }
    catch { bad(`${path}: invalid JSON-LD`); }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(m[0])) bad(`${path}: <img> without alt`);
  for (const m of html.matchAll(/<a\b[^>]*\shref="([^"#]+)"/g)) {
    const href = m[1];
    if (/^(mailto:|tel:|https?:\/\/(?!short\.do))/.test(href) || href.startsWith('//')) continue;
    const p = href.startsWith('http') ? new URL(href).pathname : href.split('?')[0];
    if (!links.has(p)) links.set(p, path);
  }
}
for (const [p, from] of links) {
  const r = await txt(p);
  if (r.status >= 400) bad(`broken internal link ${p} (from ${from}): ${r.status}`);
  else if (r.status >= 300 && r.status < 400) bad(`internal link ${p} (from ${from}) redirects (${r.status}); link the final URL`);
}
console.log(`internal links checked: ${links.size}`);
console.log(problems ? `${problems} problem(s)` : 'Crawl clean');
process.exit(problems ? 1 : 0);
