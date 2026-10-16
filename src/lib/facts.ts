import { formatDate, formatDays, formatDOP, groupSchedule, joinList, LANGUAGE_NAMES } from './format.ts';
import { hubPath } from './hubs.ts';
import type { DoctorView } from './data.ts';

export const agentNoun = (v: DoctorView) => (v.doctor.gender === 'f' ? v.specialty.agent_f : v.specialty.agent_m);
export const titleOf = (v: DoctorView) => (v.doctor.gender === 'f' ? 'Dra.' : 'Dr.');
export const profilePath = (v: DoctorView) => `/${v.doctor.slug}`;

/** 40-60 word summary generated only from stored facts (SPEC §5.1). Unknown facts are omitted, never invented. */
export function factSummary(v: DoctorView): string {
  const d = v.doctor;
  const loc = v.locations[0];
  const art = d.gender === 'f' ? 'La' : 'El';
  const parts: string[] = [];
  let first = `${art} ${d.display_name} es ${agentNoun(v)}`;
  if (loc) first += ` en ${loc.city.name} (${loc.sector.name})`;
  if (d.exequatur_verified_at) first += `, con exequátur verificado el ${formatDate(d.exequatur_verified_at)}`;
  parts.push(first + '.');
  if (loc?.facility && loc.schedule.length) parts.push(`Atiende en ${loc.facility.name}: ${joinList(groupSchedule(loc.schedule).map((g) => `${formatDays(g.days)}, de ${g.open} a ${g.close}`))}.`);
  else if (loc?.facility) parts.push(`Atiende en ${loc.facility.name}.`);
  if (v.ars.length) parts.push(`Acepta ${joinList(v.ars.map((a) => a.name))}.`);
  if (d.consultation_fee_min != null) parts.push(`Consulta desde ${formatDOP(d.consultation_fee_min)}.`);
  if (d.languages.length) parts.push(`Atiende en ${joinList(d.languages.map((l) => LANGUAGE_NAMES[l] ?? l))}.`);
  if (d.accepting_new_patients === true) parts.push('Acepta nuevos pacientes.');
  return parts.join(' ');
}

export function profileTitle(v: DoctorView, brand: string): string {
  const loc = v.locations[0];
  return `${v.doctor.display_name}, ${capitalizeFirst(agentNoun(v))}${loc ? ` en ${loc.city.name}` : ''} | ${brand}`;
}
const capitalizeFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Meta description from facts, hard-capped at 155 chars. */
export function profileMetaDescription(v: DoctorView): string {
  const d = v.doctor; const loc = v.locations[0];
  const bits = [`${d.display_name}, ${agentNoun(v)}${loc ? ` en ${loc.sector.name}, ${loc.city.name}` : ''}.`];
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
    links.push({ label: `${v.specialty.name_plural} en ${loc.sector.name}`, href: hubPath({ specialty: v.specialty, city: loc.city, sector: loc.sector }) });
  }
  return links;
};
