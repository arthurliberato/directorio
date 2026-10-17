import { formatDate, formatDays, formatDOP, groupSchedule, joinList, LANGUAGE_NAMES } from './format.ts';
import { hubPath } from './hubs.ts';
import type { DoctorView } from './data.ts';

/** "cardiólogo" + "cardióloga" -> "cardiólogo/a"; identical forms stay as they are. Used when gender is unknown. */
export function neutralAgent(masc: string, fem: string): string {
  if (masc === fem) return masc;
  let i = 0; while (i < masc.length && i < fem.length && masc[i] === fem[i]) i++;
  let j = 0; while (j < masc.length - i && j < fem.length - i && masc[masc.length - 1 - j] === fem[fem.length - 1 - j]) j++;
  return `${masc.slice(0, masc.length - j)}/${fem.slice(i, fem.length - j)}${masc.slice(masc.length - j)}`;
}

export const agentNoun = (v: DoctorView) =>
  v.doctor.gender === 'f' ? v.specialty.agent_f : v.doctor.gender === 'm' ? v.specialty.agent_m : neutralAgent(v.specialty.agent_m, v.specialty.agent_f);
export const titleOf = (v: DoctorView) => (v.doctor.gender === 'f' ? 'Dra.' : v.doctor.gender === 'm' ? 'Dr.' : '');
const articleOf = (v: DoctorView) => (v.doctor.gender === 'f' ? 'La ' : v.doctor.gender === 'm' ? 'El ' : '');
export const profilePath = (v: DoctorView) => `/${v.doctor.slug}`;
export const isListedOnly = (v: DoctorView) => v.doctor.listing_status !== 'affiliated';

/** 40-60 word summary generated only from stored facts (SPEC §5.1). Unknown facts are omitted, never invented. */
export function factSummary(v: DoctorView): string {
  const d = v.doctor;
  const loc = v.locations[0];
  const parts: string[] = [];
  let first = `${articleOf(v)}${d.display_name} es ${agentNoun(v)}`;
  if (loc) first += ` en ${loc.city.name}${loc.sector ? ` (${loc.sector.name})` : ''}`;
  if (d.exequatur_verified_at) first += `, con exequátur verificado el ${formatDate(d.exequatur_verified_at)}`;
  parts.push(first + '.');
  if (loc?.facility && loc.schedule.length) parts.push(`Atiende en ${loc.facility.name}: ${joinList(groupSchedule(loc.schedule).map((g) => `${formatDays(g.days)}, de ${g.open} a ${g.close}`))}.`);
  else if (loc?.facility) parts.push(`Atiende en ${loc.facility.name}${loc.suite ? ` (${loc.suite})` : ''}.`);
  if (v.ars.length) parts.push(`Acepta ${joinList(v.ars.map((a) => a.name))}.`);
  if (d.consultation_fee_min != null) parts.push(`Consulta desde ${formatDOP(d.consultation_fee_min)}.`);
  if (d.languages.length) parts.push(`Atiende en ${joinList(d.languages.map((l) => LANGUAGE_NAMES[l] ?? l))}.`);
  if (d.accepting_new_patients === true) parts.push('Acepta nuevos pacientes.');
  if (isListedOnly(v) && d.source_name) parts.push(`Perfil informativo con datos públicos de ${d.source_name}; no verificado.`);
  return parts.join(' ');
}

export function profileTitle(v: DoctorView, brand: string): string {
  const loc = v.locations[0];
  const name = [titleOf(v), v.doctor.display_name.replace(/^Dra?\.\s*/, '')].filter(Boolean).join(' ');
  return `${name}, ${capitalizeFirst(agentNoun(v))}${loc ? ` en ${loc.city.name}` : ''} | ${brand}`;
}
const capitalizeFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Meta description from facts, hard-capped at 155 chars. */
export function profileMetaDescription(v: DoctorView): string {
  const d = v.doctor; const loc = v.locations[0];
  const bits = [`${d.display_name}, ${agentNoun(v)}${loc ? ` en ${loc.sector ? loc.sector.name + ', ' : ''}${loc.city.name}` : ''}.`];
  if (d.exequatur_verified_at) bits.push('Exequátur verificado.');
  if (v.ars.length) bits.push(`ARS: ${joinList(v.ars.slice(0, 3).map((a) => a.name))}.`);
  if (d.consultation_fee_min != null) bits.push(`Consulta desde ${formatDOP(d.consultation_fee_min)}.`);
  let out = bits.join(' ');
  if (out.length > 155) out = out.slice(0, 154).replace(/\s+\S*$/, '') + '…';
  return out;
}

export const doctorHubLinks = (v: DoctorView) => {
  const loc = v.locations[0];
  const links = [{ label: v.specialty.name_plural, href: hubPath({ specialty: v.specialty }) }];
  if (loc) {
    links.push({ label: `${v.specialty.name_plural} en ${loc.city.name}`, href: hubPath({ specialty: v.specialty, city: loc.city }) });
    if (loc.sector) links.push({ label: `${v.specialty.name_plural} en ${loc.sector.name}`, href: hubPath({ specialty: v.specialty, city: loc.city, sector: loc.sector }) });
  }
  return links;
};

// ---- Facilities -------------------------------------------------------------------------------
import type { Facility } from './types.ts';
export const facilityKind = (f: Facility) => (f.type === 'Hospital' ? 'hospital' : 'clínica o centro médico');

export function facilitySpecialtyCounts(doctors: DoctorView[]): { slug: string; name: string; plural: string; count: number }[] {
  const m = new Map<string, { slug: string; name: string; plural: string; count: number }>();
  for (const v of doctors) { const cur = m.get(v.specialty.slug) ?? { slug: v.specialty.slug, name: v.specialty.name_singular, plural: v.specialty.name_plural, count: 0 }; cur.count++; m.set(v.specialty.slug, cur); }
  return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'));
}

/** Data-driven summary (only stored facts). */
export function facilitySummary(f: Facility, doctors: DoctorView[], place: string): string {
  const specs = facilitySpecialtyCounts(doctors);
  const parts = [`${f.name} es ${f.type === 'Hospital' ? 'un hospital' : 'una clínica o centro médico'} en ${place}.`];
  parts.push(`En el directorio hay ${doctors.length} ${doctors.length === 1 ? 'médico' : 'médicos'} que atienden aquí, en ${specs.length} ${specs.length === 1 ? 'especialidad' : 'especialidades'}: ${joinList(specs.slice(0, 6).map((s) => `${s.name} (${s.count})`))}.`);
  const fees = doctors.map((v) => v.doctor.consultation_fee_min).filter((x): x is number => x != null);
  if (fees.length) parts.push(`Consultas desde ${formatDOP(Math.min(...fees))}.`);
  return parts.join(' ');
}

/** "Dra. María de los Ángeles Pérez" -> "MP": first and last capitalized words (particles like de/del/la are skipped). */
export function initialsOf(displayName: string): string {
  const words = displayName.replace(/^(Dra?\.)\s*/, '').split(/\s+/).filter((w) => /^[A-ZÁÉÍÓÚÑ]/.test(w));
  if (!words.length) return displayName.charAt(0).toUpperCase();
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}
