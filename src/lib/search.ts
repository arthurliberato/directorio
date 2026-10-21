// Free-text search shared by the website's search box and the WhatsApp bot: finds a specialty, city and ARS inside a sentence
// ("pediatra en santiago con humano"). Accent- and case-insensitive; the longest specialty phrase wins.
import { getArs, getCities, getSpecialties } from './data.ts';
import type { Ars, City, Specialty } from './types.ts';

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const hasPhrase = (hay: string, key: string) => key.length >= 3 && (` ${hay} `).includes(` ${key} `);

export function parseQuery(raw: string): { specialty?: Specialty; city?: City; ars?: Ars } {
  const q = norm(raw);
  let specialty: Specialty | undefined; let best = 0;
  for (const s of getSpecialties()) for (const k of [s.slug, norm(s.name_singular), norm(s.name_plural), norm(s.field_name), norm(s.agent_f), norm(s.agent_m)]) if (hasPhrase(q, k) && k.length > best) { specialty = s; best = k.length; }
  const city = getCities().find((c) => hasPhrase(q, norm(c.name)));
  const ars = getArs().find((a) => hasPhrase(q, norm(a.name).replace(/^ars /, '')) || hasPhrase(q, norm(a.name)));
  return { specialty, city, ars };
}
