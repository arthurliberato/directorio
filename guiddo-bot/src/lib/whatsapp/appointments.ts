// Appointment requests from the bot: the patient talks to guiddo, guiddo hands the request to the verified doctor's own
// WhatsApp. Only affiliated doctors with a WhatsApp number can receive requests (same rule as the website's booking panel).
import { BOT_NAME, SITE_URL } from '../../config.ts';
import { canBook } from '../booking.ts';
import { getDoctorBySlug } from '../data.ts';
import { profilePath } from '../facts.ts';
import type { Run } from '../admin-db.ts';
import { clip, text, type Out } from './messages.ts';

const PENDING_TTL_MS = 30 * 60_000;
const pending = new Map<string, { slug: string; at: number }>();
const recent = new Map<string, number[]>();
const MAX_PER_HOUR = 3;

export function startRequest(from: string, slug: string, now = Date.now()) { pending.set(from, { slug, at: now }); }
export function cancelRequest(from: string) { pending.delete(from); }
/** The doctor this patient is currently writing a request for (expires after 30 minutes). */
export function pendingFor(from: string, now = Date.now()): string | null {
  const p = pending.get(from);
  if (!p) return null;
  if (now - p.at > PENDING_TTL_MS) { pending.delete(from); return null; }
  return p.slug;
}
const overLimit = (from: string, now: number) => { const l = (recent.get(from) ?? []).filter((t) => now - t < 3_600_000); recent.set(from, l); return l.length >= MAX_PER_HOUR; };

export interface Deps {
  /** Saves the request; returns its id or null when there is no database. */
  save(doctorId: number, phone: string, message: string): Promise<number | null>;
  mark(id: number, status: 'forwarded' | 'failed', error?: string): Promise<void>;
  /** Delivers the request to the doctor's WhatsApp. Throws on failure. */
  notify(doctorWa: string, body: string, vars: { message: string; link: string; doctor: string }): Promise<void>;
}

export const doctorNotice = (message: string, patientPhone: string) =>
  `📅 Nueva solicitud de cita por ${BOT_NAME}:\n\n«${message}»\n\nResponde al paciente aquí: https://wa.me/${patientPhone.replace(/\D/g, '')}`;

/** Handles the patient's request message. Always returns what to tell the patient. */
export async function submitRequest(o: { slug: string; from: string; message: string }, deps: Deps, now = Date.now()): Promise<Out[]> {
  const v = getDoctorBySlug(o.slug);
  if (!v || !canBook(v.doctor) || !v.doctor.whatsapp) return [text('Este profesional no recibe citas por este chat. Escribe «menú» para ver más opciones.')];
  if (overLimit(o.from, now)) return [text('Ya enviaste varias solicitudes en la última hora. Espera un poco y vuelve a intentarlo, por favor.')];
  const message = clip(o.message, 500);
  recent.set(o.from, [...(recent.get(o.from) ?? []), now]);
  let id: number | null = null;
  try { id = await deps.save(v.doctor.id, o.from, message); } catch (e) { console.error('[wa] could not save request', (e as Error).message); }
  const link = `https://wa.me/${o.from.replace(/\D/g, '')}`;
  try {
    await deps.notify(v.doctor.whatsapp, doctorNotice(message, o.from), { message, link, doctor: v.doctor.display_name });
    if (id != null) await deps.mark(id, 'forwarded').catch(() => {});
    return [text(`✅ Listo. Enviamos tu solicitud a ${v.doctor.display_name}. El consultorio te escribirá a este mismo número para confirmar la cita.\n\nPerfil: ${SITE_URL}${profilePath(v)}`)];
  } catch (e) {
    console.error('[wa] could not forward request', (e as Error).message);
    if (id != null) await deps.mark(id, 'failed', (e as Error).message.slice(0, 300)).catch(() => {});
    // saved => the team follows up from the admin panel; not saved either => hand the patient a direct link so nothing is lost
    return id != null
      ? [text(`Recibimos tu solicitud para ${v.doctor.display_name}. El equipo de ${BOT_NAME} se encargará de que llegue al consultorio y te escribirán a este número.`)]
      : [text(`No pudimos enviar tu solicitud ahora mismo. Puedes escribirle directamente al consultorio:\nhttps://wa.me/${v.doctor.whatsapp.replace(/\D/g, '')}`)];
  }
}

/** Production dependencies: Postgres (when configured) + WhatsApp Cloud API. */
export async function productionDeps(): Promise<Deps> {
  const { withDb } = await import('../admin-run.ts');
  const { sendMessages, sendTemplate } = await import('./client.ts');
  const hasDb = !!process.env.DATABASE_URL;
  return {
    save: async (doctorId, phone, message) => !hasDb ? null : withDb((run) => insertRequest(run, { doctorId, phone, message }), { reload: false }),
    mark: async (id, status, error) => { if (hasDb) await withDb((run) => markRequest(run, id, status, error), { reload: false }); },
    notify: async (to, body, vars) => {
      const tpl = process.env.WHATSAPP_TEMPLATE_APPT; // approved template: required to message a doctor who has not written to us in the last 24 h
      if (tpl) await sendTemplate(to, tpl, process.env.WHATSAPP_TEMPLATE_LANG ?? 'es', [vars.doctor, vars.message, vars.link]);
      else await sendMessages(to, [text(body)]);
    },
  };
}

export async function insertRequest(run: Run, o: { doctorId: number; phone: string; message: string }): Promise<number> {
  const rows = await run('insert into appointment_requests (doctor_id, patient_phone, message) values ($1, $2, $3) returning id', [o.doctorId, o.phone, o.message]);
  return Number(rows[0].id);
}
export async function markRequest(run: Run, id: number, status: 'forwarded' | 'failed', error?: string): Promise<void> {
  await run('update appointment_requests set status = $2, error = $3, forwarded_at = case when $2 = \'forwarded\' then now() else null end where id = $1', [id, status, error ?? null]);
}
export const listRequests = (run: Run, limit = 100) =>
  run('select r.id, r.created_at, r.forwarded_at, r.status, r.error, r.patient_phone, r.message, d.display_name, d.slug from appointment_requests r join doctors d on d.id = r.doctor_id order by r.created_at desc limit $1', [limit]);
