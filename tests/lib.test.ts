import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRobotsTxt, AI_SEARCH_BOTS, AI_TRAINING_BOTS, SEARCH_BOTS } from '../src/lib/crawlers.ts';
import { getDoctorBySlug, publishedDoctors, specialtySlugs, queryHub, getSpecialtyBySlug, getCityBySlug } from '../src/lib/data.ts';
import { doctors } from '../src/data/seed.ts';
import { factSummary, profileMetaDescription } from '../src/lib/facts.ts';
import { parseHubPath, resolveHub } from '../src/lib/hubs.ts';
import { hubIndexDecision, profileIndexDecision } from '../src/lib/indexing.ts';
import { physicianJsonLd, serializeJsonLd, siteJsonLd } from '../src/lib/schema.ts';
import { doctorUrls, hubUrls, renderUrlset, sitemapFiles } from '../src/lib/sitemap.ts';
import { isReservedSlug, isValidSlug } from '../src/lib/slugs.ts';

const wordCount = (s: string) => s.trim().split(/\s+/).length;

test('doctor slugs are valid, unique, and never reserved', () => {
  const slugs = doctors.map((d) => d.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) {
    assert.ok(isValidSlug(s), `invalid slug ${s}`);
    assert.ok(!isReservedSlug(s, specialtySlugs()), `reserved slug ${s}`);
  }
  for (const s of ['guia', 'cardiologos', 'robots.txt', 'sitemap-hubs', 'buscar', 'admin', 'llms.txt']) assert.ok(isReservedSlug(s, specialtySlugs()), s);
});

test('profile indexing rules', () => {
  assert.equal(profileIndexDecision(getDoctorBySlug('dra-maria-perez-cardiologa')!).indexable, true);
  const thin = getDoctorBySlug('dr-datos-minimos-pediatra')!;
  assert.equal(profileIndexDecision(thin).robots, 'noindex,follow');
  assert.equal(getDoctorBySlug('dr-sin-verificar-cardiologo'), null, 'unverified exequatur is never published');
  const forced = { ...thin, doctor: { ...thin.doctor, index_status: 'force_index' as const } };
  assert.equal(profileIndexDecision(forced).indexable, true, 'override wins');
  const claimed = { ...thin, doctor: { ...thin.doctor, claimed: true } };
  assert.equal(profileIndexDecision(claimed).indexable, true, 'claimed profiles index');
});

test('hub indexing rules: 0 -> 404, 1-4 -> noindex,follow, >=5 -> index', () => {
  assert.equal(hubIndexDecision(0).kind, 'not_found');
  const d3 = hubIndexDecision(3); assert.ok(d3.kind === 'render' && d3.robots === 'noindex,follow');
  const d5 = hubIndexDecision(5); assert.ok(d5.kind === 'render' && d5.robots === 'index,follow');
  assert.equal(resolveHub(['neurologos']).status, 'not_found');
  const thin = resolveHub(['dermatologos', 'santo-domingo']);
  assert.ok(thin.status === 'ok' && thin.decision.robots === 'noindex,follow');
});

test('hub paths enforce fixed facet order and canonical page 1', () => {
  assert.equal(parseHubPath(['cardiologos', 'piantini']).ok, false, 'sector without city');
  assert.equal(parseHubPath(['cardiologos', 'santo-domingo', 'ars-humano', 'piantini']).ok, false);
  assert.equal(resolveHub(['cardiologos', 'pagina', '1']).status, 'redirect');
  assert.equal(resolveHub(['cardiologos', 'pagina', '99']).status, 'not_found');
  assert.equal(parseHubPath(['cardiologos', 'santo-domingo', 'ars-humano']).ok, true);
});

test('fact summary is 40-60 words and meta description <= 155 chars for every published doctor', () => {
  for (const v of publishedDoctors()) {
    const n = wordCount(factSummary(v));
    assert.ok(n <= 60, `${v.doctor.slug}: ${n} words`);
    // Thin (noindex) profiles have too few facts to reach 40 words; we never pad with invented text.
    if (profileIndexDecision(v).indexable) assert.ok(n >= 40, `${v.doctor.slug}: ${n} words`);
    assert.ok(profileMetaDescription(v).length <= 155);
  }
});

test('physician JSON-LD: required fields, no invented data, safe serialization', () => {
  const ld: any = physicianJsonLd(getDoctorBySlug('dra-maria-perez-cardiologa')!);
  assert.equal(ld['@type'], 'IndividualPhysician');
  assert.match(ld['@id'], /#physician$/);
  assert.match(ld.medicalSpecialty, /^https:\/\/schema\.org\//);
  assert.equal(ld.identifier, undefined, 'exequatur number is not published unless cleared');
  assert.equal(ld.aggregateRating, undefined, 'no reviews in v1');
  assert.equal(ld.usNPI, undefined);
  const thin: any = physicianJsonLd(getDoctorBySlug('dr-datos-minimos-pediatra')!);
  assert.equal(thin.openingHoursSpecification, undefined, 'unknown fields are omitted');
  assert.ok(!serializeJsonLd({ a: '</script><script>alert(1)' }).includes('</script>'));
  assert.equal((siteJsonLd()[0] as any)['@type'], 'Organization');
});

test('robots.txt: prototype blocks all; production allows named bots and repeats filter disallows', () => {
  assert.match(buildRobotsTxt('prototype'), /Disallow: \/\n/);
  const r = buildRobotsTxt('production', 'https://short.do');
  for (const b of [...SEARCH_BOTS, ...AI_SEARCH_BOTS, ...AI_TRAINING_BOTS]) assert.match(r, new RegExp(`User-agent: ${b}\\nAllow: /\\nDisallow: /buscar`));
  assert.match(r, /Sitemap: https:\/\/short\.do\/sitemap-index\.xml/);
});

test('sitemaps contain only indexable URLs with real lastmod', () => {
  const docUrls = doctorUrls().map((u) => u.loc);
  assert.ok(!docUrls.some((u) => u.includes('datos-minimos') || u.includes('sin-verificar')));
  const hubs = hubUrls().map((u) => u.loc);
  assert.ok(hubs.includes('https://short.do/cardiologos/santo-domingo'));
  assert.ok(!hubs.some((u) => u.includes('dermatologos')), 'hubs with < 5 doctors are excluded');
  for (const [, urls] of sitemapFiles()) for (const u of urls) assert.match(u.lastmod, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(renderUrlset(doctorUrls()).includes('<lastmod>'));
});

test('hub queries only count published doctors', () => {
  const n = queryHub({ specialty: getSpecialtyBySlug('cardiologos')!, city: getCityBySlug('santo-domingo')! }).length;
  assert.equal(n, 9);
});

import { botLogLine, classifyBot } from '../src/lib/bots.ts';
test('bot classification: AI search/training/user agents are distinguished', () => {
  assert.equal(classifyBot('Mozilla/5.0 AppleWebKit/537.36; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot'), 'OAI-SearchBot');
  assert.equal(classifyBot('Mozilla/5.0 (compatible; GPTBot/1.1)'), 'GPTBot');
  assert.equal(classifyBot('Claude-User/1.0'), 'Claude-User');
  assert.equal(classifyBot('Mozilla/5.0 (compatible; Applebot-Extended/0.1)'), 'Applebot-Extended');
  assert.equal(classifyBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1'), null);
  assert.equal(JSON.parse(botLogLine('ClaudeBot', 403, '/x')).ai, true);
});

import { parseCsv, summarize } from '../src/lib/ai-visibility.ts';
test('AI visibility CSV: validates prompt ids and computes citation rate', () => {
  const ids = new Set(['es-1', 'es-2']);
  const csv = 'run_month,engine,prompt_id,cited,cited_url,position,accuracy\n2026-10,chatgpt,es-1,1,https://short.do/x,2,accurate\n2026-10,chatgpt,es-2,0,,,\n';
  const { rows, errors } = parseCsv(csv, ids);
  assert.deepEqual(errors, []);
  assert.deepEqual(summarize(rows)[0], { month: '2026-10', engine: 'chatgpt', prompts: 2, cited: 1, citationRate: 50, avgPosition: 2, inaccurate: 0 });
  assert.ok(parseCsv('run_month,engine,prompt_id,cited\n2026-10,bard,es-1,1', ids).errors.length > 0);
  assert.ok(parseCsv('run_month,engine,prompt_id,cited\n2026-10,claude,zz-9,1', ids).errors.length > 0);
});
