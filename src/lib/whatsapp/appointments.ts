// Appointment requests from the bot: the patient talks to guiddo, guiddo hands the request to the verified doctor's own
// WhatsApp. Only affiliated doctors with a WhatsApp number can receive requests (same rule as the website's booking panel).
import { BOT_NAME, SITE_URL } from '../../config.ts';
import { canBook } from '../booking.ts';
import { getDoctorBySlug } from '../data.ts';
import { profilePath } from '../facts.ts';
import type { Run } from '../admin-db.ts';
import { clip, text, type Out } from './messages.ts';

const PENDING_TTL_MS = 30 * 60_000;
const MAX_PER_HOUR = 3;

/** "This patient is writing an appointment request for doctor X". Postgres-backed in production (serverless instances share
 *  nothing), in memory without a database (tests, local runs). */
export interface PendingStore {
  get(from: string, now?: number): Promise<string | null>;
  set(from: string, slug: string, now?: number): Promise<void>;
  clear(from: string): Promise<void>;
}
export function memoryPending(): PendingStore {
  const m = new Map<string, { slug: string; at: number }>();
  return {
    async get(from, now = Date.now()) { const p = m.get(from); if (!p) return null; if (now - p.at > PENDING_TTL_MS) { m.delete(from); return null; } return p.slug; },
    async set(from, slug, now = Date.now()) { m.set(from, { slug, at: now }); },
    async clear(from) { m.delete(from); },
  };
}
export function dbPending(run: Run): PendingStore {
  return {
    async get(from) {
      const rows = await run("select doctor_slug from bot_pending where phone = $1 and created_at > now() - interval '30 minutes'", [from]);
      return rows[0]?.doctor_slug ?? null;
    },
    async set(from, slug) { await run('insert into bot_pending (phone, doctor_slug) values ($1, $2) on conflict (phone) do update set doctor_slug = excluded.doctor_slug, created_at = now()', [from, slug]); },
    async clear(from) { await run('delete from bot_pending where phone = $1', [from]); },
  };
}
const memStore = memoryPending();
/** The store for the current process: Postgres when DATABASE_URL is set, memory otherwise. */
export async function pendingStore(): Promise<PendingStore> {
  if (!process.env.DATABASE_URL) return memStore;
  const { withDb } = await import('../admin-run.ts');
  const wrap = <T>(f: (run: Run) => Promise<T>) => withDb(f, { reload: false });
  return { get: (f) => wrap((run) => dbPending(run).get(f)), set: (f, s) => wrap((run) => dbPending(run).set(f, s)), clear: (f) => wrap((run) => dbPending(run).clear(f)) };
}

export interface Deps {
  /** How many requests this patient sent in the last hour. */
  recentCount(phone: string, now?: number): Promise<number>;
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
  if (!v || !canBook(v.doctor) || !v.doctor.whatsapp) return [text('Este doctor no recibe citas por este chat. Escribe «menú» para ver más opciones.')];
  if ((await deps.recentCount(o.from, now)) >= MAX_PER_HOUR) return [text('Ya enviaste varias solicitudes en la última hora. Espera un poco y vuelve a intentarlo, por favor.')];
  const message = clip(o.message, 500);
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
    recentCount: async (phone) => !hasDb ? memRecent(phone) : withDb((run) => countRecent(run, phone), { reload: false }),
    save: async (doctorId, phone, message) => !hasDb ? (memRecentAdd(phone), null) : withDb((run) => insertRequest(run, { doctorId, phone, message }), { reload: false }),
    mark: async (id, status, error) => { if (hasDb) await withDb((run) => markRequest(run, id, status, error), { reload: false }); },
    notify: async (to, body, vars) => {
      const tpl = process.env.WHATSAPP_TEMPLATE_APPT; // approved template: required to message a doctor who has not written to us in the last 24 h
      if (tpl) await sendTemplate(to, tpl, process.env.WHATSAPP_TEMPLATE_LANG ?? 'es', [vars.doctor, vars.message, vars.link]);
      else await sendMessages(to, [text(body)]);
    },
  };
}

const memHits = new Map<string, number[]>();
const memRecent = (phone: string, now = Date.now()) => (memHits.get(phone) ?? []).filter((t) => now - t < 3_600_000).length;
const memRecentAdd = (phone: string) => memHits.set(phone, [...(memHits.get(phone) ?? []), Date.now()]);
export async function countRecent(run: Run, phone: string): Promise<number> {
  const rows = await run("select count(*)::int as n from appointment_requests where patient_phone = $1 and created_at > now() - interval '1 hour'", [phone]);
  return Number(rows[0]?.n ?? 0);
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
