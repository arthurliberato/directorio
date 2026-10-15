// JSON-LD builders. Every value comes from the same records that render the visible page;
// unknown fields are omitted, never invented (SPEC §6).
import { BRAND, NAP, PUBLISH_EXEQUATUR_IDENTIFIER, SITE_URL } from '../config.ts';
import type { DoctorView } from './data.ts';
import { agentNoun, factSummary, profilePath } from './facts.ts';
import { dayToSchema } from './format.ts';
import type { Facility, Guide } from './types.ts';
import { hubHeading } from './hubs.ts';
import type { HubQuery } from './data.ts';

const CTX = 'https://schema.org';
export const abs = (path: string) => `${SITE_URL}${path}`;
export const ORG_ID = `${SITE_URL}/#org`;
export const physicianId = (slug: string) => `${SITE_URL}/${slug}#physician`;
export const facilityId = (slug: string) => `${SITE_URL}/centro/${slug}#org`;

const clean = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0))) as T;

export function physicianJsonLd(v: DoctorView) {
  const d = v.doctor; const loc = v.locations[0];
  const facilities = v.locations.map((l) => l.facility).filter((f): f is Facility => !!f);
  const sameAs = [d.website, d.gbp_url, ...d.sameas_urls].filter(Boolean);
  const opening = loc?.schedule.map((s) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: dayToSchema(s.day), opens: s.open, closes: s.close }));
  return clean({
    '@context': CTX, '@type': 'IndividualPhysician', '@id': physicianId(d.slug),
    name: d.display_name, url: abs(profilePath(v)),
    image: d.photo_url ? abs(d.photo_url) : undefined,
    description: factSummary(v),
    medicalSpecialty: `https://schema.org/${v.specialty.schema_enum}`,
    knowsLanguage: d.languages,
    isAcceptingNewPatients: d.accepting_new_patients ?? undefined,
    telephone: d.phone ?? undefined,
    address: loc ? { '@type': 'PostalAddress', streetAddress: loc.address, addressLocality: loc.city.name, addressRegion: loc.city.province, addressCountry: 'DO' } : undefined,
    geo: loc?.lat != null && loc.lng != null ? { '@type': 'GeoCoordinates', latitude: loc.lat, longitude: loc.lng } : undefined,
    practicesAt: facilities.map((f) => ({ '@type': f.type, '@id': facilityId(f.slug), name: f.name })),
    hasCredential: d.exequatur_verified_at ? { '@type': 'EducationalOccupationalCredential', credentialCategory: 'Exequátur', recognizedBy: { '@type': 'GovernmentOrganization', name: 'Poder Ejecutivo de la República Dominicana' } } : undefined,
    identifier: PUBLISH_EXEQUATUR_IDENTIFIER && d.exequatur_number ? { '@type': 'PropertyValue', propertyID: 'Exequátur', value: d.exequatur_number } : undefined,
    alumniOf: d.education.map((name) => ({ '@type': 'CollegeOrUniversity', name })),
    paymentAccepted: v.ars.length ? `Efectivo, tarjeta, ${v.ars.map((a) => a.name).join(', ')}` : undefined,
    openingHoursSpecification: opening,
    sameAs,
  });
}

export function facilityJsonLd(f: Facility, doctors: DoctorView[], cityName: string, province: string) {
  return clean({
    '@context': CTX, '@type': f.type, '@id': facilityId(f.slug), name: f.name, url: abs(`/centro/${f.slug}`),
    telephone: f.phone ?? undefined,
    address: { '@type': 'PostalAddress', streetAddress: f.address, addressLocality: cityName, addressRegion: province, addressCountry: 'DO' },
    geo: f.lat != null && f.lng != null ? { '@type': 'GeoCoordinates', latitude: f.lat, longitude: f.lng } : undefined,
    member: doctors.map((v) => ({ '@type': 'IndividualPhysician', '@id': physicianId(v.doctor.slug) })),
  });
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': CTX, '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

export function hubJsonLd(q: HubQuery, doctors: DoctorView[], totalCount: number, path: string, crumbs: { name: string; path: string }[], startPosition = 1) {
  return [
    {
      '@context': CTX, '@type': 'CollectionPage', name: hubHeading(q), url: abs(path),
      about: { '@type': 'MedicalSpecialty', name: q.specialty.name_singular },
      mainEntity: {
        '@type': 'ItemList', numberOfItems: totalCount,
        itemListElement: doctors.map((v, i) => ({ '@type': 'ListItem', position: startPosition + i, url: abs(profilePath(v)) })),
      },
    },
    breadcrumbJsonLd(crumbs),
  ];
}

export function guideJsonLd(g: Guide, reviewer: DoctorView | null, specialtyName: string | null) {
  return clean({
    '@context': CTX, '@type': 'MedicalWebPage', headline: g.title, url: abs(`/guia/${g.slug}`),
    audience: { '@type': 'Patient' },
    about: specialtyName ? { '@type': 'MedicalSpecialty', name: specialtyName } : undefined,
    lastReviewed: g.reviewed_at,
    reviewedBy: reviewer ? { '@type': 'IndividualPhysician', '@id': physicianId(reviewer.doctor.slug), name: reviewer.doctor.display_name } : undefined,
    citation: g.sources.map((s) => s.url),
    publisher: { '@id': ORG_ID },
  });
}

export function siteJsonLd(sameAs: string[] = []) {
  return [
    clean({
      '@context': CTX, '@type': 'Organization', '@id': ORG_ID, name: BRAND, url: `${SITE_URL}/`, logo: abs('/logo.svg'),
      address: { '@type': 'PostalAddress', addressLocality: NAP.locality, addressCountry: NAP.country }, sameAs,
    }),
    { '@context': CTX, '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: BRAND, url: `${SITE_URL}/`, inLanguage: 'es-DO', publisher: { '@id': ORG_ID } },
  ];
}

/** Safe for inlining in <script type="application/ld+json">. */
export const serializeJsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
export { agentNoun };
