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
  const r = buildRobotsTxt('production', 'https://guiddo.net');
  for (const b of [...SEARCH_BOTS, ...AI_SEARCH_BOTS, ...AI_TRAINING_BOTS]) assert.match(r, new RegExp(`User-agent: ${b}\\nAllow: /\\nDisallow: /buscar`));
  assert.match(r, /Sitemap: https:\/\/guiddo\.net\/sitemap-index\.xml/);
});

test('sitemaps contain only indexable URLs with real lastmod', () => {
  const docUrls = doctorUrls().map((u) => u.loc);
  assert.ok(!docUrls.some((u) => u.includes('datos-minimos') || u.includes('sin-verificar')));
  const hubs = hubUrls().map((u) => u.loc);
  assert.ok(hubs.includes('https://guiddo.net/cardiologos/santo-domingo'));
  assert.ok(!hubs.some((u) => u.includes('dermatologos')), 'hubs with < 5 doctors are excluded');
  for (const [, urls] of sitemapFiles()) for (const u of urls) assert.match(u.lastmod, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(renderUrlset(doctorUrls()).includes('<lastmod>'));
});

test('hub queries only count published doctors', () => {
  const n = queryHub({ specialty: getSpecialtyBySlug('cardiologos')!, city: getCityBySlug('santo-domingo')! }).length;
  assert.equal(n, 11, '9 affiliates + 2 listed in Santo Domingo');
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
  const csv = 'run_month,engine,prompt_id,cited,cited_url,position,accuracy\n2026-10,chatgpt,es-1,1,https://guiddo.net/x,2,accurate\n2026-10,chatgpt,es-2,0,,,\n';
  const { rows, errors } = parseCsv(csv, ids);
  assert.deepEqual(errors, []);
  assert.deepEqual(summarize(rows)[0], { month: '2026-10', engine: 'chatgpt', prompts: 2, cited: 1, citationRate: 50, avgPosition: 2, inaccurate: 0 });
  assert.ok(parseCsv('run_month,engine,prompt_id,cited\n2026-10,bard,es-1,1', ids).errors.length > 0);
  assert.ok(parseCsv('run_month,engine,prompt_id,cited\n2026-10,claude,zz-9,1', ids).errors.length > 0);
});

import { seedDataset as mkSeed, setDataset as setDs } from '../src/lib/dataset.ts';
import { hubPath } from '../src/lib/hubs.ts';
test('pagination: >20 doctors yields pages with self paths, sitemap entries, and 404 beyond the last page', () => {
  const ds = mkSeed();
  const base = ds.doctors.filter((d) => d.specialty_id === 1 && ds.locations.some((l) => l.doctor_id === d.id && l.city_id === 1));
  const extra = Array.from({ length: 30 }, (_, i) => ({ ...base[i % base.length], id: 5000 + i, slug: `dr-extra-${i}-cardiologo`, display_name: `Dr. Extra ${i}` }));
  ds.doctors = [...ds.doctors, ...extra];
  ds.locations = [...ds.locations, ...extra.map((d) => ({ ...ds.locations.find((l) => l.doctor_id === 1)!, id: 5000 + d.id, doctor_id: d.id }))];
  ds.doctorArs = [...ds.doctorArs, ...extra.map((d) => ({ doctor_id: d.id, ars_id: 1, verified_at: '2026-10-01' }))];
  setDs(ds);
  try {
    const p1 = resolveHub(['cardiologos', 'santo-domingo']);
    assert.ok(p1.status === 'ok' && p1.totalPages === 2 && p1.items.length === 20);
    const p2 = resolveHub(['cardiologos', 'santo-domingo', 'pagina', '2']);
    assert.ok(p2.status === 'ok' && p2.items.length === p1.total - 20 && p2.path === '/cardiologos/santo-domingo/pagina/2');
    assert.equal(resolveHub(['cardiologos', 'santo-domingo', 'pagina', '3']).status, 'not_found');
    assert.equal(hubPath(p1.status === 'ok' ? p1.query : (null as any), 2), '/cardiologos/santo-domingo/pagina/2');
    const urls = hubUrls().map((u) => u.loc);
    assert.ok(urls.includes('https://guiddo.net/cardiologos/santo-domingo/pagina/2'));
    // page-2 items continue the ItemList numbering and don't repeat page 1
    const ids1 = new Set(p1.status === 'ok' ? p1.items.map((v) => v.doctor.id) : []);
    assert.ok(p2.status === 'ok' && p2.items.every((v) => !ids1.has(v.doctor.id)));
  } finally { setDs(mkSeed()); }
});

import { groupSchedule } from '../src/lib/format.ts';
test('fact summary states every schedule block accurately (no mixing hours across days)', () => {
  const v = structuredClone(getDoctorBySlug('dra-maria-perez-cardiologa')!);
  v.locations[0].schedule = [1, 2, 3, 4].map((day) => ({ day: day as 1, open: '08:00', close: '12:00' })).concat([{ day: 5 as 1, open: '14:00', close: '18:00' }]);
  const s = factSummary(v);
  assert.match(s, /lunes a jueves, de 08:00 a 12:00 y viernes, de 14:00 a 18:00/);
  assert.ok(!/lunes a viernes/.test(s));
  assert.equal(groupSchedule(v.locations[0].schedule).length, 2);
});

test('physician JSON-LD image: relative photo paths become absolute, absolute URLs stay untouched', () => {
  const v = structuredClone(getDoctorBySlug('dra-maria-perez-cardiologa')!);
  v.doctor.photo_url = '/img/doctors/x.webp';
  assert.equal((physicianJsonLd(v) as any).image, 'https://guiddo.net/img/doctors/x.webp');
  v.doctor.photo_url = 'https://cdn.example.com/a.jpg';
  assert.equal((physicianJsonLd(v) as any).image, 'https://cdn.example.com/a.jpg');
  v.doctor.photo_url = null;
  assert.equal((physicianJsonLd(v) as any).image, undefined);
});


import { isAffiliated, publishedDoctors as allPublished } from '../src/lib/data.ts';
import { neutralAgent, titleOf, agentNoun } from '../src/lib/facts.ts';
import { sortDoctors } from '../src/lib/hubs.ts';
test('listing tiers: drafts hidden, listed profiles are noindex and photo-less, affiliates sort first', () => {
  assert.equal(getDoctorBySlug('dr-sin-verificar-cardiologo'), null, 'draft is hidden');
  const listed = allPublished().filter((v) => v.doctor.listing_status === 'listed');
  assert.ok(listed.length >= 4);
  for (const v of listed) {
    assert.equal(profileIndexDecision(v).indexable, false, `${v.doctor.slug} must not be indexed`);
    assert.equal((physicianJsonLd(v) as any).image, undefined, 'no photo for listed profiles');
  }
  assert.ok(listed.some((v) => v.doctor.photo_url), 'fixture has a stored photo that must still be hidden');
  const hub = queryHub({ specialty: getSpecialtyBySlug('cardiologos')!, city: getCityBySlug('santo-domingo')! });
  const sorted = sortDoctors(hub, null);
  const firstListed = sorted.findIndex((v) => !isAffiliated(v.doctor));
  assert.ok(firstListed > 0 && sorted.slice(firstListed).every((v) => !isAffiliated(v.doctor)), 'all affiliates come before any listed doctor');
  const byPrice = sortDoctors(hub, 'precio');
  const fl = byPrice.findIndex((v) => !isAffiliated(v.doctor));
  assert.ok(byPrice.slice(fl).every((v) => !isAffiliated(v.doctor)), 'tier order also holds when sorting by price');
});

test('unknown gender gets neutral wording and no title; summary never claims verification for listed doctors', () => {
  assert.equal(neutralAgent('cardiólogo', 'cardióloga'), 'cardiólogo/a');
  assert.equal(neutralAgent('médico general', 'médica general'), 'médico/a general');
  assert.equal(neutralAgent('psiquiatra', 'psiquiatra'), 'psiquiatra');
  const v = allPublished().find((x) => x.doctor.gender === null && x.specialty.slug === 'cardiologos')!;
  assert.equal(titleOf(v), '');
  assert.equal(agentNoun(v), 'cardiólogo/a');
  const s = factSummary(v);
  assert.ok(!/verificado el/.test(s) && /no verificado/.test(s), s);
  assert.ok(s.startsWith(v.doctor.display_name + ' es cardiólogo/a'), s);
  assert.match(s, /consultorio 405, 4\.º|consultorio 610/);
});

import { canBook, normalizeBookingUrl, whatsappBookingLink } from '../src/lib/booking.ts';
test('booking links: cal.com shorthand and https only; WhatsApp message names the doctor; only verified doctors can book', () => {
  assert.equal(normalizeBookingUrl('usuario/consulta'), 'https://cal.com/usuario/consulta');
  assert.equal(normalizeBookingUrl('cal.com/usuario/consulta-30'), 'https://cal.com/usuario/consulta-30');
  assert.equal(normalizeBookingUrl('https://calendly.com/dr-x/30min'), 'https://calendly.com/dr-x/30min');
  assert.equal(normalizeBookingUrl('  '), null);
  for (const bad of ['http://cal.com/x/y', 'javascript:alert(1)', 'ftp://x.do/a', 'no es un enlace']) assert.throws(() => normalizeBookingUrl(bad), /enlace de reserva|https/);
  const verified = getDoctorBySlug('dra-maria-perez-cardiologa')!.doctor;
  const link = whatsappBookingLink(verified, '/dra-maria-perez-cardiologa', 'https://guiddo.net')!;
  assert.match(link, /^https:\/\/wa\.me\/\d+\?text=/);
  assert.match(decodeURIComponent(link), /programar una cita con Dra\. María Pérez.*https:\/\/guiddo\.net\/dra-maria-perez-cardiologa/);
  assert.ok(canBook(verified));
  const listed = allPublished().find((v) => v.doctor.listing_status === 'listed')!.doctor;
  assert.equal(canBook({ ...listed, whatsapp: '+18095550100', booking_url: 'https://cal.com/x/y' }), false, 'listed doctors never get booking buttons');
  assert.equal(canBook({ ...verified, whatsapp: null, booking_url: null }), false);
});

import { calLinkOf } from '../src/lib/booking.ts';
test('calLinkOf extracts the Cal.com link (user names may contain dots) and ignores other hosts', () => {
  assert.equal(calLinkOf('https://cal.com/dr.ortega/consulta-psikids'), 'dr.ortega/consulta-psikids');
  assert.equal(calLinkOf('https://app.cal.com/usuario/evento/'), 'usuario/evento');
  assert.equal(calLinkOf('https://calendly.com/dr-x/30min'), null);
  assert.equal(calLinkOf('https://cal.com/usuario'), null, 'a profile without an event is not an embeddable link');
  assert.equal(calLinkOf(null), null);
});

test('availability filter: day and time slot match stored hours; doctors without hours never match', async () => {
  const { matchesWhen, parseWhen, whenQuery, dayInDR } = await import('../src/lib/availability.ts');
  const v = getDoctorBySlug('dra-maria-perez-cardiologa')!; // seed: Mon-Thu 08:00-12:00
  assert.equal(matchesWhen(v, { day: 1 }), true);
  assert.equal(matchesWhen(v, { day: 6 }), false, 'no Saturday hours');
  assert.equal(matchesWhen(v, { day: 1, slot: 'manana' }), true);
  assert.equal(matchesWhen(v, { day: 1, slot: 'tarde' }), false, 'hours end at 12:00');
  assert.equal(matchesWhen(v, { slot: 'noche' }), false);
  const noHours = { ...v, locations: v.locations.map((l) => ({ ...l, schedule: [] })) };
  assert.equal(matchesWhen(noHours, { day: 1 }), false);
  assert.deepEqual(parseWhen(new URLSearchParams('dia=mie&hora=tarde')), { day: 3, slot: 'tarde' });
  assert.equal(parseWhen(new URLSearchParams('dia=xx&hora=yy')), null);
  assert.equal(whenQuery({ day: 3, slot: 'tarde' }), '?dia=mie&hora=tarde');
  // Dominican Republic is UTC-4: 02:00 UTC on a Wednesday is still Tuesday there
  assert.equal(dayInDR(new Date('2026-10-21T02:00:00Z')), 2);
  assert.equal(dayInDR(new Date('2026-10-21T02:00:00Z'), 1), 3);
  const r = resolveHub(['cardiologos'], null, { day: 6 }); const all = resolveHub(['cardiologos']);
  assert.ok(r.status === 'ok' && all.status === 'ok' && r.decision.robots === 'noindex,follow' && r.total < all.total);
  assert.match(buildRobotsTxt('production', 'https://guiddo.net'), /Disallow: \/\*\?\*dia=/);
});

test('available now: who is at the practice at this moment (DR time), later today, fallbacks', async () => {
  const { availableDoctors, filtersFrom } = await import('../src/lib/available.ts');
  const mon10 = new Date('2026-10-19T14:00:00Z'); // Monday 10:00 in the Dominican Republic
  const now = availableDoctors({}, mon10);
  assert.equal(now.mode, 'now'); assert.ok(now.items.length > 0);
  assert.ok(now.items.every((v) => v.locations.some((l) => l.schedule.some((e) => e.day === 1 && e.open <= '10:00' && '10:00' < e.close))), 'everyone listed is in consultation at 10:00');
  const sat = availableDoctors({}, new Date('2026-10-24T14:00:00Z')); // Saturday: nobody has hours
  assert.equal(sat.mode, 'fallback'); assert.ok(sat.items.every((v) => v.doctor.listing_status === 'affiliated'));
  const night = availableDoctors({}, new Date('2026-10-20T03:00:00Z')); // Monday 23:00 DR: nobody now, nothing later today
  assert.ok(night.mode !== 'now');
  const ped = availableDoctors({ especialidad: 'pediatras', dia: 'lun', hora: 'tarde' }, mon10);
  assert.equal(ped.mode, 'filtered'); assert.ok(ped.items.length > 0 && ped.items.every((v) => v.specialty.slug === 'pediatras'));
  assert.equal(availableDoctors({ dia: 'dom', hora: '' }, mon10).items.length, 0);
  assert.deepEqual(filtersFrom(new URLSearchParams('hora=&dia=lun')), { especialidad: undefined, ciudad: undefined, centro: undefined, dia: 'lun', hora: '' });
});
