import { MIN_DOCTORS_FOR_HUB_INDEX, PAGE_SIZE, SITEMAP_URLS_PER_FILE, SITE_URL } from '../config.ts';
import { trustPages } from '../data/trust.ts';
import { doctorsForFacility, getArs, getCities, getFacilities, getGuides, getSectors, getSpecialties, publishedDoctors, queryHub, today, type DoctorView, type HubQuery } from './data.ts';
import { hubPath } from './hubs.ts';
import { profileIndexDecision } from './indexing.ts';
import { profilePath } from './facts.ts';

export interface SitemapUrl { loc: string; lastmod: string; }
const abs = (p: string) => `${SITE_URL}${p}`;
const maxDate = (ds: (string | null | undefined)[]) => ds.filter((d): d is string => !!d).sort().pop() ?? today();
const lastmodOf = (v: DoctorView) => v.doctor.data_verified_at ?? v.doctor.updated_at; // real data change, never build time

export const doctorUrls = (): SitemapUrl[] =>
  publishedDoctors().filter((v) => profileIndexDecision(v).indexable).map((v) => ({ loc: abs(profilePath(v)), lastmod: lastmodOf(v) }));

export function hubUrls(): SitemapUrl[] {
  const out: SitemapUrl[] = [];
  const push = (q: HubQuery) => {
    const docs = queryHub(q);
    if (docs.length < MIN_DOCTORS_FOR_HUB_INDEX) return;
    const lastmod = maxDate(docs.map(lastmodOf));
    const pages = Math.max(1, Math.ceil(docs.length / PAGE_SIZE));
    for (let p = 1; p <= pages; p++) out.push({ loc: abs(hubPath(q, p)), lastmod });
  };
  for (const specialty of getSpecialties()) {
    push({ specialty });
    for (const city of getCities()) {
      push({ specialty, city });
      for (const sector of getSectors().filter((s) => s.city_id === city.id)) push({ specialty, city, sector });
      for (const ars of getArs()) push({ specialty, city, ars });
    }
  }
  return out;
}

export const guideUrls = (): SitemapUrl[] => getGuides().map((g) => ({ loc: abs(`/guia/${g.slug}`), lastmod: g.reviewed_at }));
export const facilityUrls = (): SitemapUrl[] =>
  getFacilities().filter((f) => doctorsForFacility(f.id).length > 0).map((f) => ({ loc: abs(`/centro/${f.slug}`), lastmod: f.updated_at }));
export const pageUrls = (): SitemapUrl[] => [
  { loc: abs('/'), lastmod: today() }, { loc: abs('/especialidad'), lastmod: today() }, { loc: abs('/centro'), lastmod: today() }, { loc: abs('/guia'), lastmod: today() },
  ...trustPages.map((p) => ({ loc: abs(`/${p.slug}`), lastmod: '2026-10-01' })),
];

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));

/** name -> urls. Doctors are split into files of <= 50,000 URLs. */
export function sitemapFiles(): Map<string, SitemapUrl[]> {
  const files = new Map<string, SitemapUrl[]>();
  chunk(doctorUrls(), SITEMAP_URLS_PER_FILE).forEach((c, i) => files.set(`doctors-${i + 1}`, c));
  files.set('hubs', hubUrls()); files.set('guides', guideUrls()); files.set('facilities', facilityUrls()); files.set('pages', pageUrls());
  return files;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
export const renderUrlset = (urls: SitemapUrl[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`;
export function renderIndex(files: Map<string, SitemapUrl[]>) {
  const items = [...files].filter(([, u]) => u.length).map(([name, u]) => `<sitemap><loc>${SITE_URL}/sitemap-${name}.xml</loc><lastmod>${maxDate(u.map((x) => x.lastmod))}</lastmod></sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</sitemapindex>\n`;
}
