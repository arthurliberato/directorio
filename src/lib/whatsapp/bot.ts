// Guiddo WhatsApp bot: a pure function from one inbound message to the replies. It reads the same in-memory
// catalog as the website (src/lib/data.ts), so answers can never disagree with the pages. No server-side session:
// the state lives in the ids of the buttons/list rows we send (s = specialty slug, c = city slug, a = ars slug).
import { BOT_NAME, NAP, SITE_URL } from '../../config.ts';
import { getTrustPage } from '../../data/trust.ts';
import { canBook, whatsappBookingLink } from '../booking.ts';
import {
  doctorsForFacility, getArs, getArsBySlug, getCities, getCityBySlug, getDoctorBySlug, getFacilities, getFacilityBySlug, getGuideBySlug, getGuides,
  getSpecialties, getSpecialtyBySlug, isAffiliated, publishedDoctors, queryHub, type DoctorView,
} from '../data.ts';
import { agentNoun, profilePath, titleOf } from '../facts.ts';
import { formatDate, formatFeeRange, formatScheduleLines, joinList } from '../format.ts';
import { hubPath, sortDoctors } from '../hubs.ts';
import { hasPhrase, norm, parseQuery } from '../search.ts';
import { buttons, clip, image, list, text, type Out, type Row } from './messages.ts';
import type { Inbound } from './client.ts';
import { cancelRequest, pendingFor, startRequest } from './appointments.ts';

const PAGE = 8; // rows per list page; leaves room for "more" / "filter" rows (WhatsApp lists max 10)
const abs = (p: string) => `${SITE_URL}${p}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;


// ---- Fixed texts -------------------------------------------------------------------------------
const EMERGENCY = /\b(emergencia|urgencia|infarto|no respira|ahogo|desmayo|sangrado|hemorragia|ambulancia|convulsi\w+|suicid\w+|envenen\w+)\b/;
const HANDOFF = /\b(asesor\w*|operador\w*|agente humano|persona real|hablar con (una |un )?(persona|alguien|humano)|atencion al cliente)\b/;
const GREETING = /^(hola|buenas?|buenos dias|buenas tardes|buenas noches|menu|inicio|ayuda|start|empezar|comenzar|opciones|hi|hello)\b/;

const welcome = (): Out[] => [
  text(`👋 Hola, soy *${BOT_NAME}*, el directorio de médicos de República Dominicana.\n\nTe ayudo a encontrar médicos por especialidad, ciudad y seguro (ARS), ver clínicas y hospitales, leer guías de salud y programar citas.\n\nNo escribas información médica personal en este chat. En una emergencia llama al *911*.`),
  menu(),
];

export function menu(body = '¿Qué quieres hacer?'): Out {
  return list(body, 'Ver opciones', [
    { id: 'm:doc', title: 'Buscar médico', description: 'Por especialidad, ciudad y seguro' },
    { id: 'm:cen', title: 'Clínicas y hospitales', description: 'Médicos que atienden en cada centro' },
    { id: 'm:gui', title: 'Guías de salud', description: 'Respuestas claras, revisadas por médicos' },
    { id: 'm:ver', title: 'Cómo verificamos', description: 'Qué significa «Médico verificado»' },
    { id: 'm:hum', title: 'Hablar con una persona', description: 'Correcciones, afiliación y dudas' },
  ]);
}
const menuButton = (): Out => buttons('¿Algo más?', [{ id: 'menu', title: 'Menú principal' }]);

function emergency(): Out[] {
  return [text('🚨 Si es una emergencia médica, llama ya al *911* o acude a la sala de emergencias más cercana. Este chat no atiende urgencias.'), menuButton()];
}
function handoff(): Out[] {
  return [text(`Con gusto te atiende una persona del equipo de ${BOT_NAME}. Escríbenos a ${NAP.email} (o desde ${abs('/contacto')}) con tu consulta; si eres profesional de la salud, incluye tu número de exequátur. Respondemos en horario laboral.`), menuButton()];
}
function howWeVerify(): Out[] {
  const t = getTrustPage('como-verificamos');
  const body = t ? t.body.slice(0, 2).join('\n\n') : 'Verificamos el exequátur de cada médico afiliado.';
  return [text(`*${t?.title ?? 'Cómo verificamos'}*\n\n${body}\n\nMás detalle: ${abs('/como-verificamos')}`), menuButton()];
}

// ---- Catalog helpers ---------------------------------------------------------------------------
const nameOf = (v: DoctorView) => v.doctor.display_name;
const placeOf = (v: DoctorView) => { const l = v.locations[0]; return l ? `${l.sector ? l.sector.name + ', ' : ''}${l.city.name}` : ''; };
const rowOfDoctor = (v: DoctorView): Row => ({ id: `d:${v.doctor.slug}`, title: nameOf(v), description: `${isAffiliated(v.doctor) ? '✔ Verificado · ' : ''}${v.specialty.name_singular}${placeOf(v) ? ' · ' + placeOf(v) : ''}` });
const withAll = (x: string | undefined) => x ?? 'all';

function specialtiesWithCounts(cityId?: number) {
  const counts = new Map<number, number>();
  for (const v of publishedDoctors()) if (!cityId || v.locations.some((l) => l.city_id === cityId)) counts.set(v.specialty.id, (counts.get(v.specialty.id) ?? 0) + 1);
  return getSpecialties().filter((s) => counts.has(s.id)).map((s) => ({ s, n: counts.get(s.id)! })).sort((a, b) => b.n - a.n || a.s.name_singular.localeCompare(b.s.name_singular, 'es'));
}

function specialtyList(cityId: number | undefined, citySlug: string | undefined, page: number): Out[] {
  const all = specialtiesWithCounts(cityId);
  if (!all.length) return [text('Todavía no tenemos médicos publicados en esa búsqueda.'), menu()];
  const slice = all.slice(page * PAGE, page * PAGE + PAGE);
  const rows: Row[] = slice.map(({ s, n }) => ({ id: citySlug ? `r:${s.slug}:${citySlug}:all:0` : `c:${s.slug}`, title: s.name_singular, description: plural(n, 'médico', 'médicos') }));
  if ((page + 1) * PAGE < all.length) rows.push({ id: `sp:${withAll(citySlug)}:${page + 1}`, title: 'Más especialidades', description: `Quedan ${all.length - (page + 1) * PAGE}` });
  const where = citySlug ? ` en ${getCityBySlug(citySlug)!.name}` : '';
  return [list(`¿Qué especialidad buscas${where}? También puedes escribirla, por ejemplo: «cardiólogo en Santiago con Humano».`, 'Especialidades', rows)];
}

function cityStep(spec: string): Out[] {
  const s = getSpecialtyBySlug(spec); if (!s) return [menu()];
  const byCity = new Map<number, number>();
  for (const v of publishedDoctors()) if (v.specialty.id === s.id) for (const c of new Set(v.locations.map((l) => l.city_id))) byCity.set(c, (byCity.get(c) ?? 0) + 1);
  const cities = getCities().filter((c) => byCity.has(c.id)).sort((a, b) => byCity.get(b.id)! - byCity.get(a.id)!);
  if (cities.length <= 1) return results(spec, cities[0]?.slug, undefined, 0);
  const rows: Row[] = [{ id: `r:${spec}:all:all:0`, title: 'Todas las ciudades', description: plural(publishedDoctors().filter((v) => v.specialty.id === s.id).length, 'médico', 'médicos') }];
  for (const c of cities.slice(0, 9)) rows.push({ id: `r:${spec}:${c.slug}:all:0`, title: c.name, description: plural(byCity.get(c.id)!, 'médico', 'médicos') });
  return [list(`*${s.name_singular}*. ¿En qué ciudad?`, 'Ciudades', rows)];
}

function arsStep(spec: string, city?: string): Out[] {
  const s = getSpecialtyBySlug(spec); if (!s) return [menu()];
  const c = city ? getCityBySlug(city) : null;
  const base = queryHub({ specialty: s, city: c ?? undefined });
  const rows: Row[] = getArs().map((a) => ({ a, n: base.filter((v) => v.ars.some((x) => x.id === a.id)).length })).filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n).slice(0, 10).map(({ a, n }) => ({ id: `r:${spec}:${withAll(city)}:${a.slug}:0`, title: a.name, description: plural(n, 'médico', 'médicos') }));
  if (!rows.length) return [text('Aún no tenemos seguros registrados para esta búsqueda.'), menuButton()];
  return [list('¿Con qué seguro (ARS)?', 'Seguros', rows)];
}

function results(spec: string, city: string | undefined, ars: string | undefined, offset: number): Out[] {
  const s = getSpecialtyBySlug(spec); if (!s) return [menu()];
  const c = city ? getCityBySlug(city) : null; const a = ars ? getArsBySlug(ars) : null;
  const found = sortDoctors(queryHub({ specialty: s, city: c ?? undefined, ars: a ?? undefined }), null);
  const label = `${s.name_plural}${c ? ` en ${c.name}` : ''}${a ? ` · ${a.name}` : ''}`;
  if (!found.length) return [text(`No encontré ${s.name_plural.toLowerCase()}${c ? ` en ${c.name}` : ''}${a ? ` que acepten ${a.name}` : ''}. Prueba con otra ciudad o sin filtrar por seguro.`), menu()];
  const wantMore = offset + PAGE < found.length;
  const wantArs = !a && offset === 0 && getArs().some((x) => found.some((v) => v.ars.some((y) => y.id === x.id)));
  const size = 10 - (wantMore ? 1 : 0) - (wantArs ? 1 : 0);
  const rows = found.slice(offset, offset + size).map(rowOfDoctor);
  const shown = rows.length;
  if (offset + shown < found.length) rows.push({ id: `r:${spec}:${withAll(city)}:${withAll(ars)}:${offset + shown}`, title: 'Ver más resultados', description: `Quedan ${found.length - offset - shown}` });
  if (wantArs) rows.push({ id: `ar:${spec}:${withAll(city)}`, title: 'Filtrar por seguro', description: 'Elige tu ARS' });
  const verified = found.filter((v) => isAffiliated(v.doctor)).length;
  return [list(`*${label}*: ${plural(found.length, 'médico', 'médicos')}${verified ? ` (${verified} verificado${verified === 1 ? '' : 's'}, primero en la lista)` : ''}.\nMás en la web: ${abs(hubPath({ specialty: s, city: c ?? undefined, ars: a ?? undefined }))}`, 'Ver médicos', rows)];
}

// ---- Doctor ------------------------------------------------------------------------------------
function doctorCard(v: DoctorView): string {
  const d = v.doctor; const loc = v.locations[0]; const aff = isAffiliated(d);
  const lines = [`*${[titleOf(v), d.display_name.replace(/^Dra?\.\s*/, '')].filter(Boolean).join(' ')}*`, `${aff ? '✅ Médico verificado' : 'ℹ️ Perfil informativo · no verificado'}`, `${agentNoun(v)[0].toUpperCase()}${agentNoun(v).slice(1)}`];
  if (loc) {
    lines.push(`📍 ${loc.facility ? loc.facility.name + ', ' : ''}${loc.suite ? loc.suite + ', ' : ''}${loc.address}${loc.sector && !loc.address.toLowerCase().includes(loc.sector.name.toLowerCase()) ? ', ' + loc.sector.name : ''}, ${loc.city.name}`);
    const sched = formatScheduleLines(loc.schedule); if (aff && sched.length) lines.push(`🕒 ${sched.join(' · ')}`);
  }
  if (v.ars.length) lines.push(`🏥 Seguros: ${joinList(v.ars.map((a) => a.name))}`);
  const fee = formatFeeRange(d.consultation_fee_min, d.consultation_fee_max); if (fee) lines.push(`💵 Consulta: ${fee}`);
  // Listed doctors: never a direct phone; only the clinic switchboard (+ extension), as on the website.
  const phone = aff ? d.phone ?? loc?.phone : loc?.facility?.phone ?? loc?.phone;
  if (phone) lines.push(`📞 ${phone}${!d.phone && loc?.phone_ext ? ` ext. ${loc.phone_ext}` : ''}${loc?.facility && (!aff || !d.phone) ? ` (central de ${loc.facility.name})` : ''}`);
  if (aff && d.exequatur_verified_at) lines.push(`Exequátur verificado el ${formatDate(d.exequatur_verified_at)}.`);
  if (!aff) lines.push(`_Datos públicos${d.source_name ? ' de ' + d.source_name : ''}; no verificados por ${BOT_NAME}._`);
  lines.push(`Perfil completo: ${abs(profilePath(v))}`);
  return lines.join('\n');
}

function doctorReply(slug: string): Out[] {
  const v = getDoctorBySlug(slug); if (!v) return [text('No encontré ese perfil.'), menu()];
  const d = v.doctor; const loc = v.locations[0];
  const card = doctorCard(v);
  const actions = [
    ...(canBook(d) ? [{ id: `bk:${d.slug}`, title: 'Programar cita' }] : []),
    { id: `r:${v.specialty.slug}:${withAll(loc?.city.slug)}:all:0`, title: 'Ver similares' },
    { id: 'menu', title: 'Menú principal' },
  ];
  const photo = isAffiliated(d) && d.photo_url ? (d.photo_url.startsWith('/') ? abs(d.photo_url) : d.photo_url) : null; // photos: verified doctors only
  return photo && /^https:/.test(photo) ? [image(photo, card), buttons('¿Qué quieres hacer?', actions)] : [buttons(card, actions)];
}

function bookingReply(slug: string, from: string): Out[] {
  const v = getDoctorBySlug(slug); if (!v) return [menu()];
  const d = v.doctor;
  if (!canBook(d)) {
    const phone = v.locations[0]?.facility?.phone ?? v.locations[0]?.phone;
    return [text(`${d.display_name} tiene un perfil informativo y todavía no recibe citas por ${BOT_NAME}.${phone ? ` Puedes llamar a la central: ${phone}.` : ''}`), menuButton()];
  }
  if (!d.whatsapp) return [text(`Reserva en línea con ${d.display_name}:\n${d.booking_url}`), menuButton()];
  if (from) startRequest(from, d.slug);
  const online = d.booking_url ? `\n\nTambién puedes reservar en línea: ${d.booking_url}` : '';
  return [buttons(`Para pedir tu cita con *${d.display_name}*, escribe en *un solo mensaje* tu nombre y el día u horario que prefieres. Ejemplo: «María Pérez, martes en la tarde».\n\nNo incluyas información médica. Al enviarlo, compartimos tu nombre y número con el consultorio para coordinar la cita.${online}`, [{ id: 'menu', title: 'Cancelar' }])];
}

// ---- Facilities & guides -----------------------------------------------------------------------
function facilityList(page: number): Out[] {
  const all = getFacilities().map((f) => ({ f, n: doctorsForFacility(f.id).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n || a.f.name.localeCompare(b.f.name, 'es'));
  if (!all.length) return [text('Aún no hay clínicas con médicos publicados.'), menu()];
  const rows: Row[] = all.slice(page * PAGE, page * PAGE + PAGE).map(({ f, n }) => ({ id: `f:${f.slug}`, title: f.name, description: `${f.type === 'Hospital' ? 'Hospital' : 'Clínica'} · ${plural(n, 'médico', 'médicos')}` }));
  if ((page + 1) * PAGE < all.length) rows.push({ id: `fl:${page + 1}`, title: 'Más centros', description: `Quedan ${all.length - (page + 1) * PAGE}` });
  return [list('Clínicas y hospitales con médicos en el directorio:', 'Centros', rows)];
}

function facilityReply(slug: string): Out[] {
  const f = getFacilityBySlug(slug); if (!f) return [menu()];
  const docs = doctorsForFacility(f.id); const city = getCities().find((c) => c.id === f.city_id);
  const lines = [`*${f.name}*`, `${f.type === 'Hospital' ? 'Hospital' : 'Clínica o centro médico'}${city ? ' en ' + city.name : ''}`, `📍 ${f.address}`];
  if (f.phone) lines.push(`📞 ${f.phone}`);
  if (f.website) lines.push(`🌐 ${f.website}`);
  lines.push(`${plural(docs.length, 'médico', 'médicos')} en el directorio.`, `Más: ${abs('/centro/' + f.slug)}`);
  return [buttons(lines.join('\n'), [{ id: `fd:${f.slug}`, title: 'Ver sus médicos' }, { id: 'm:cen', title: 'Otros centros' }, { id: 'menu', title: 'Menú principal' }])];
}

function facilityDoctors(slug: string): Out[] {
  const f = getFacilityBySlug(slug); if (!f) return [menu()];
  const docs = sortDoctors(doctorsForFacility(f.id), null).slice(0, 10);
  return [list(`Médicos en *${f.name}*:`, 'Ver médicos', docs.map(rowOfDoctor))];
}

function guideList(): Out[] {
  const gs = getGuides();
  if (!gs.length) return [text('Pronto publicaremos guías de salud.'), menu()];
  return [list('Guías de salud, revisadas por un médico verificado:', 'Guías', gs.slice(0, 10).map((g) => ({ id: `g:${g.slug}`, title: g.title, description: g.answer_summary })))];
}
function guideReply(slug: string): Out[] {
  const g = getGuideBySlug(slug); if (!g) return [menu()];
  return [text(`*${g.title}*\n\n${g.answer_summary}\n\nGuía completa (${g.read_minutes} min, revisada el ${formatDate(g.reviewed_at)}): ${abs('/guia/' + g.slug)}\n\n_Información general; no sustituye la consulta médica._`), menuButton()];
}

// ---- Free text ---------------------------------------------------------------------------------
function freeText(raw: string): Out[] {
  const q = norm(raw);
  if (!q) return welcome();
  if (EMERGENCY.test(q)) return emergency();
  if (HANDOFF.test(q)) return handoff();
  if (GREETING.test(q) && q.split(' ').length <= 2) return welcome();
  if (/\b(verific\w*|exequatur)\b/.test(q) && q.split(' ').length <= 6) return howWeVerify();
  if (/\b(clinicas?|hospitales|hospital|centros? medicos?)\b/.test(q) && !getSpecialties().some((s) => hasPhrase(q, norm(s.name_singular)))) return facilityList(0);
  if (/\b(guias?|consejos)\b/.test(q)) return guideList();

  const { specialty: spec, city, ars } = parseQuery(raw);

  if (spec) return results(spec.slug, city?.slug, ars?.slug, 0);
  if (city) return specialtyList(city.id, city.slug, 0);

  const tokens = q.replace(/\b(dr|dra|doctor|doctora|medico|medica)\b/g, ' ').split(' ').filter((t) => t.length >= 3);
  if (tokens.length) {
    const hits = sortDoctors(publishedDoctors().filter((v) => { const n = norm(v.doctor.display_name); return tokens.every((t) => n.includes(t)); }), null).slice(0, 10);
    if (hits.length === 1) return doctorReply(hits[0].doctor.slug);
    if (hits.length) return [list(`Encontré ${plural(hits.length, 'médico', 'médicos')} con ese nombre:`, 'Ver médicos', hits.map(rowOfDoctor))];
  }
  return [text('No entendí tu mensaje 🤔. Puedes escribir algo como «pediatra en Santiago», «Dr. Pérez», o elegir una opción del menú.'), menu()];
}

// ---- Entry point -------------------------------------------------------------------------------
/** Handles an inbound message. Returns the replies and a coarse intent label for logs (never the text). */
export interface BotResult { out: Out[]; intent: string; /** The patient wrote an appointment request: the caller must run submitRequest() and send its result instead of `out`. */ request?: { slug: string; message: string } }
export function respond(msg: Pick<Inbound, 'kind' | 'text' | 'replyId'> & { from?: string }): BotResult {
  const waiting = msg.from ? pendingFor(msg.from) : null;
  if (waiting && msg.kind === 'text' && (msg.text ?? '').trim()) { cancelRequest(msg.from!); return { out: [], intent: 'appt', request: { slug: waiting, message: msg.text!.trim() } }; }
  if (waiting && msg.from) cancelRequest(msg.from); // any other tap or message abandons the request
  if (msg.kind === 'other') return { out: [text('Por ahora solo puedo leer mensajes de texto. Elige una opción:'), menu()], intent: 'unsupported' };
  if (msg.kind === 'text') {
    const out = freeText(msg.text ?? '');
    return { out, intent: out.some((m) => m.type === 'list' && m.rows[0]?.id === 'm:doc') ? 'menu' : 'text' };
  }
  const [k, a, b, c, d] = (msg.replyId ?? '').split(':');
  const intent = k || 'menu';
  switch (k) {
    case 'm': return { intent: `m:${a}`, out: a === 'doc' ? specialtyList(undefined, undefined, 0) : a === 'cen' ? facilityList(0) : a === 'gui' ? guideList() : a === 'ver' ? howWeVerify() : a === 'hum' ? handoff() : [menu()] };
    case 'sp': return { intent, out: specialtyList(a !== 'all' ? getCityBySlug(a)?.id : undefined, a !== 'all' ? a : undefined, Number(b) || 0) };
    case 'c': return { intent, out: cityStep(a) };
    case 'r': return { intent, out: results(a, b === 'all' ? undefined : b, c === 'all' ? undefined : c, Number(d) || 0) };
    case 'ar': return { intent, out: arsStep(a, b === 'all' ? undefined : b) };
    case 'd': return { intent, out: doctorReply(a) };
    case 'bk': return { intent, out: bookingReply(a, msg.from ?? '') };
    case 'f': return { intent, out: facilityReply(a) };
    case 'fd': return { intent, out: facilityDoctors(a) };
    case 'fl': return { intent, out: facilityList(Number(a) || 0) };
    case 'g': return { intent, out: guideReply(a) };
    default: return { intent: 'menu', out: welcome() };
  }
}

