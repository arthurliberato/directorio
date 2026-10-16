import { MIN_DOCTORS_FOR_HUB_INDEX, MIN_VERIFIED_POINTS_FOR_PROFILE } from '../config.ts';
import type { DoctorView } from './data.ts';

export type RobotsValue = 'index,follow' | 'noindex,follow';
export interface IndexDecision { robots: RobotsValue; indexable: boolean; reason: string; }

/** Verified data points beyond the name: confirmed address, ARS list, schedule, photo, bio (SPEC §4.2). */
export function verifiedPoints(v: DoctorView): number {
  let pts = 0;
  if (v.locations.some((l) => l.address)) pts++;
  if (v.ars.length > 0) pts++;
  if (v.locations.some((l) => l.schedule.length > 0)) pts++;
  if (v.doctor.photo_url) pts++;
  if (v.doctor.bio) pts++;
  return pts;
}

export function profileIndexDecision(v: DoctorView): IndexDecision {
  const d = v.doctor;
  const yes = (reason: string): IndexDecision => ({ robots: 'index,follow', indexable: true, reason });
  const no = (reason: string): IndexDecision => ({ robots: 'noindex,follow', indexable: false, reason });
  if (d.index_status === 'force_index') return yes('override: force_index');
  if (d.index_status === 'force_noindex') return no('override: force_noindex');
  if (!d.exequatur_verified_at) return no('exequatur not verified');
  const pts = verifiedPoints(v);
  if (d.claimed) return yes('verified + claimed');
  if (pts >= MIN_VERIFIED_POINTS_FOR_PROFILE) return yes(`verified + ${pts} data points`);
  return no(`only ${pts} verified data points (< ${MIN_VERIFIED_POINTS_FOR_PROFILE}) and not claimed`);
}

export type HubDecision =
  | { kind: 'not_found'; reason: string }
  | ({ kind: 'render' } & IndexDecision);

/** n = published doctors for the facet combination (SPEC §4.1). 0 => real 404; 1-4 => noindex,follow. */
export function hubIndexDecision(n: number): HubDecision {
  if (n === 0) return { kind: 'not_found', reason: '0 results' };
  if (n < MIN_DOCTORS_FOR_HUB_INDEX) return { kind: 'render', robots: 'noindex,follow', indexable: false, reason: `${n} doctors (< ${MIN_DOCTORS_FOR_HUB_INDEX})` };
  return { kind: 'render', robots: 'index,follow', indexable: true, reason: `${n} doctors` };
}

export type MissingKey = 'foto' | 'ars' | 'horario' | 'bio' | 'direccion';
/** Which of the five profile data points are still missing (admin to-do list). */
export function missingPoints(v: DoctorView): MissingKey[] {
  const out: MissingKey[] = [];
  if (!v.locations.some((l) => l.address)) out.push('direccion');
  if (v.ars.length === 0) out.push('ars');
  if (!v.locations.some((l) => l.schedule.length > 0)) out.push('horario');
  if (!v.doctor.photo_url) out.push('foto');
  if (!v.doctor.bio) out.push('bio');
  return out;
}
