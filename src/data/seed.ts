// ILLUSTRATIVE SEED DATA. Not real doctors. Replaced by Postgres (db/schema.sql) in production.
import type { Ars, City, Doctor, DoctorArs, Facility, Guide, Location, RedirectRow, Sector, Specialty } from '../lib/types.ts';

export const specialties: Specialty[] = [
  { id: 1, slug: 'cardiologos', name_singular: 'Cardiología', name_plural: 'Cardiólogos', field_name: 'Cardiología', agent_f: 'cardióloga', agent_m: 'cardiólogo', schema_enum: 'Cardiovascular', icon: 'heart' },
  { id: 2, slug: 'pediatras', name_singular: 'Pediatría', name_plural: 'Pediatras', field_name: 'Pediatría', agent_f: 'pediatra', agent_m: 'pediatra', schema_enum: 'Pediatric', icon: 'baby' },
  { id: 3, slug: 'ginecologos', name_singular: 'Ginecología', name_plural: 'Ginecólogos', field_name: 'Ginecología', agent_f: 'ginecóloga', agent_m: 'ginecólogo', schema_enum: 'Gynecologic', icon: 'flower' },
  { id: 4, slug: 'dermatologos', name_singular: 'Dermatología', name_plural: 'Dermatólogos', field_name: 'Dermatología', agent_f: 'dermatóloga', agent_m: 'dermatólogo', schema_enum: 'Dermatology', icon: 'sparkle' },
  { id: 5, slug: 'medicos-generales', name_singular: 'Medicina general', name_plural: 'Médicos generales', field_name: 'Medicina general', agent_f: 'médica general', agent_m: 'médico general', schema_enum: 'PrimaryCare', icon: 'stethoscope' },
  { id: 6, slug: 'ortopedas', name_singular: 'Ortopedia', name_plural: 'Ortopedas', field_name: 'Ortopedia', agent_f: 'ortopeda', agent_m: 'ortopeda', schema_enum: 'Musculoskeletal', icon: 'bone' },
  { id: 7, slug: 'oftalmologos', name_singular: 'Oftalmología', name_plural: 'Oftalmólogos', field_name: 'Oftalmología', agent_f: 'oftalmóloga', agent_m: 'oftalmólogo', schema_enum: 'Optometric', icon: 'eye' },
  { id: 8, slug: 'neurologos', name_singular: 'Neurología', name_plural: 'Neurólogos', field_name: 'Neurología', agent_f: 'neuróloga', agent_m: 'neurólogo', schema_enum: 'Neurologic', icon: 'brain' },
];

export const cities: City[] = [
  { id: 1, slug: 'santo-domingo', name: 'Santo Domingo', province: 'Distrito Nacional' },
  { id: 2, slug: 'santiago', name: 'Santiago', province: 'Santiago' },
  { id: 3, slug: 'la-romana', name: 'La Romana', province: 'La Romana' },
  { id: 4, slug: 'san-pedro-de-macoris', name: 'San Pedro de Macorís', province: 'San Pedro de Macorís' },
  { id: 5, slug: 'punta-cana', name: 'Punta Cana', province: 'La Altagracia' },
  { id: 6, slug: 'puerto-plata', name: 'Puerto Plata', province: 'Puerto Plata' },
];

export const sectors: Sector[] = [
  { id: 1, slug: 'piantini', name: 'Piantini', city_id: 1 },
  { id: 2, slug: 'naco', name: 'Naco', city_id: 1 },
  { id: 3, slug: 'gazcue', name: 'Gazcue', city_id: 1 },
  { id: 4, slug: 'evaristo-morales', name: 'Evaristo Morales', city_id: 1 },
  { id: 5, slug: 'los-jardines', name: 'Los Jardines Metropolitanos', city_id: 2 },
  { id: 6, slug: 'centro-santiago', name: 'Centro de Santiago', city_id: 2 },
];

export const ars: Ars[] = [
  { id: 1, slug: 'humano', name: 'ARS Humano' },
  { id: 2, slug: 'universal', name: 'ARS Universal' },
  { id: 3, slug: 'senasa', name: 'SeNaSa' },
  { id: 4, slug: 'mapfre-salud', name: 'Mapfre Salud' },
  { id: 5, slug: 'reservas', name: 'ARS Reservas' },
];

export const facilities: Facility[] = [
  { id: 1, slug: 'centro-medico-del-caribe', name: 'Centro Médico del Caribe', type: 'MedicalClinic', address: 'Av. Abraham Lincoln 000, Piantini', city_id: 1, sector_id: 1, phone: '+1-809-555-0101', website: null, lat: 18.4716, lng: -69.9402, updated_at: '2026-10-01' },
  { id: 2, slug: 'clinica-corazones', name: 'Clínica Corazones', type: 'MedicalClinic', address: 'Av. Tiradentes 000, Naco', city_id: 1, sector_id: 2, phone: '+1-809-555-0102', website: null, lat: 18.4803, lng: -69.9285, updated_at: '2026-10-01' },
  { id: 3, slug: 'hospital-metropolitano-ejemplo', name: 'Hospital Metropolitano (ejemplo)', type: 'Hospital', address: 'Calle Arzobispo Nouel 000, Gazcue', city_id: 1, sector_id: 3, phone: '+1-809-555-0103', website: null, lat: 18.4655, lng: -69.9031, updated_at: '2026-10-01' },
  { id: 4, slug: 'centro-medico-cibao', name: 'Centro Médico del Cibao', type: 'MedicalClinic', address: 'Av. 27 de Febrero 000, Los Jardines', city_id: 2, sector_id: 5, phone: '+1-809-555-0104', website: null, lat: 19.4517, lng: -70.6970, updated_at: '2026-10-01' },
];

const FEMALE = ['María', 'Ana', 'Carmen', 'Laura', 'Rosa', 'Lucía', 'Patricia', 'Sofía', 'Daniela', 'Elena', 'Isabel', 'Marta'];
const MALE = ['Rafael', 'Juan', 'Carlos', 'Luis', 'Miguel', 'José', 'Pedro', 'Andrés', 'Fernando', 'Ricardo', 'Héctor', 'Manuel'];
const LAST = ['Pérez', 'Rodríguez', 'Santos', 'Gómez', 'Martínez', 'Fernández', 'Díaz', 'Reyes', 'Ramírez', 'Castillo', 'Peña', 'Núñez', 'Almonte', 'Cabrera', 'Guzmán', 'Mejía', 'Taveras', 'Polanco', 'Jiménez', 'Báez'];
const UNIVERSITIES = ['Universidad Autónoma de Santo Domingo (UASD)', 'Pontificia Universidad Católica Madre y Maestra (PUCMM)', 'Universidad Iberoamericana (UNIBE)', 'Instituto Tecnológico de Santo Domingo (INTEC)'];
const SUBS: Record<string, string[]> = {
  cardiologos: ['Cardiología clínica', 'Ecocardiografía', 'Cardiología preventiva', 'Electrofisiología'],
  pediatras: ['Pediatría general', 'Neonatología', 'Pediatría del desarrollo'],
  ginecologos: ['Obstetricia', 'Ginecología general', 'Salud reproductiva'],
  dermatologos: ['Dermatología clínica', 'Dermatología estética'],
  ortopedas: ['Cirugía de rodilla', 'Traumatología deportiva', 'Cirugía de columna'],
};
const FEE_BASE: Record<string, number> = { cardiologos: 2500, pediatras: 1800, ginecologos: 2200, dermatologos: 2800, ortopedas: 2600 };
const SCHEDULES = [
  [1, 2, 3, 4].map((day) => ({ day: day as 1, open: '08:00', close: '12:00' })),
  [1, 3, 5].map((day) => ({ day: day as 1, open: '14:00', close: '18:00' })),
  [2, 4].map((day) => ({ day: day as 1, open: '09:00', close: '13:00' })),
  [1, 2, 3, 4, 5].map((day) => ({ day: day as 1, open: '15:00', close: '19:00' })),
];

// [specialty slug, city id, how many doctors]
const PLAN: [string, number, number][] = [
  ['cardiologos', 1, 9], ['cardiologos', 2, 3],
  ['pediatras', 1, 6], ['ginecologos', 1, 5],
  ['dermatologos', 1, 2], ['ortopedas', 1, 5],
];

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const doctors: Doctor[] = [];
export const locations: Location[] = [];
export const doctorArs: DoctorArs[] = [];

let id = 0;
let n = 0;
for (const [specSlug, cityId, count] of PLAN) {
  const spec = specialties.find((s) => s.slug === specSlug)!;
  const citySectors = sectors.filter((s) => s.city_id === cityId);
  const cityFacilities = facilities.filter((f) => f.city_id === cityId);
  for (let i = 0; i < count; i++, n++) {
    id++;
    const female = n % 2 === 0;
    const first = (female ? FEMALE : MALE)[n % 12];
    const last = LAST[(n * 7) % LAST.length];
    const last2 = LAST[(n * 3 + 11) % LAST.length];
    const gender = female ? 'f' : 'm';
    const agent = female ? spec.agent_f : spec.agent_m;
    const title = female ? 'Dra.' : 'Dr.';
    let slug = `${female ? 'dra' : 'dr'}-${strip(first)}-${strip(last)}-${strip(agent)}`;
    if (doctors.some((d) => d.slug === slug)) slug += `-${cityId === 1 ? 'santo-domingo' : 'santiago'}`;
    if (doctors.some((d) => d.slug === slug)) slug += `-${id}`;
    const sector = citySectors[(n + i) % citySectors.length];
    const facility = cityFacilities[(n + i) % cityFacilities.length];
    const fee = FEE_BASE[specSlug] + ((n * 250) % 1500);
    const verifiedDay = 1 + ((n * 3) % 14);
    const d: Doctor = {
      id, slug, full_legal_name: `${first} ${last} ${last2}`, display_name: `${title} ${first} ${last}`, gender,
      specialty_id: spec.id, subspecialties: [SUBS[specSlug][i % SUBS[specSlug].length]],
      exequatur_number: `EX-${1000 + id}`, exequatur_decree: `Decreto ${100 + id}-${15 + (id % 8)}`,
      exequatur_verified_at: `2026-10-${String(verifiedDay).padStart(2, '0')}`,
      cmd_member: n % 3 !== 0, cmd_verified_at: n % 3 !== 0 ? '2026-09-20' : null,
      specialty_verified_at: `2026-10-${String(verifiedDay).padStart(2, '0')}`,
      claimed: n % 4 === 0, claimed_at: n % 4 === 0 ? '2026-10-05' : null,
      bio: `${title} ${first} ${last} es ${agent} con consulta en ${cities.find((c) => c.id === cityId)!.name}. Datos ilustrativos de ejemplo.`,
      education: [UNIVERSITIES[n % UNIVERSITIES.length]],
      languages: n % 3 === 0 ? ['es', 'en'] : ['es'],
      photo_url: null,
      consultation_fee_min: fee, consultation_fee_max: fee + 1000, currency: 'DOP',
      accepting_new_patients: n % 5 !== 4,
      whatsapp: `+1809555${String(1000 + id).slice(-4)}`, phone: `+1-809-555-${String(1000 + id).slice(-4)}`,
      website: null, gbp_url: null, sameas_urls: [],
      data_verified_at: `2026-10-${String(verifiedDay).padStart(2, '0')}`,
      updated_at: `2026-10-${String(verifiedDay).padStart(2, '0')}`,
      index_status: 'auto', sponsored: false,
      listing_status: 'affiliated', source_name: null, source_url: null, source_retrieved_at: null,
    };
    doctors.push(d);
    locations.push({
      id, doctor_id: id, facility_id: facility.id, address: facility.address, sector_id: sector.id, city_id: cityId,
      lat: facility.lat, lng: facility.lng, schedule: SCHEDULES[n % SCHEDULES.length], phone: facility.phone, suite: null, phone_ext: null,
    });
    for (let k = 0; k < 3; k++) {
      doctorArs.push({ doctor_id: id, ars_id: ars[(n + k * 2) % ars.length].id, verified_at: d.data_verified_at! });
    }
  }
}

// --- Edge cases that exercise the indexing rules -------------------------------------------
// Unverified exequatur: never published, never in hubs.
doctors.push({ ...doctors[0], id: 900, slug: 'dr-sin-verificar-cardiologo', display_name: 'Dr. Sin Verificar', full_legal_name: 'Sin Verificar', gender: 'm', exequatur_verified_at: null, claimed: false, claimed_at: null, data_verified_at: null, listing_status: 'draft' });
locations.push({ ...locations[0], id: 900, doctor_id: 900 });
// Verified but thin (only an address): profile stays noindex,follow.
doctors.push({ ...doctors[1], id: 901, slug: 'dr-datos-minimos-pediatra', display_name: 'Dr. Datos Mínimos', full_legal_name: 'Datos Mínimos', gender: 'm', specialty_id: 2, subspecialties: [], bio: null, education: [], whatsapp: null, claimed: false, claimed_at: null });
locations.push({ ...locations[0], id: 901, doctor_id: 901, schedule: [], facility_id: null });
// Listed doctors: public-source profiles (not verified, no photo, gender unknown => neutral wording).
const LISTED: [string, string, number, string, string | null, string | null][] = [
  ['Marcos Tejeda Liriano', 'cardiologos', 1, 'Clínica Ejemplo A', 'consultorio 405, 4.º', '60405'],
  ['Yudelka Brito Paulino', 'cardiologos', 1, 'Clínica Ejemplo A', 'consultorio 610', '60610'],
  ['Rolando Estévez Cuello', 'pediatras', 1, 'Clínica Ejemplo A', null, null],
  ['Idalia Pimentel Rosa', 'cardiologos', 2, 'Clínica Ejemplo B', 'torre A, suite 502', '7502'],
];
LISTED.forEach(([name, specSlug, cityId, clinic, suite, ext], i) => {
  const spec = specialties.find((x) => x.slug === specSlug)!; const id2 = 950 + i;
  doctors.push({ ...doctors[0], id: id2, slug: `${strip(name)}-${strip(spec.field_name)}`, full_legal_name: name, display_name: name, gender: null,
    specialty_id: spec.id, subspecialties: [], exequatur_number: null, exequatur_decree: null, exequatur_verified_at: null, cmd_member: false, cmd_verified_at: null,
    specialty_verified_at: null, claimed: false, claimed_at: null, bio: null, education: ['MD UASD; posgrado en ' + spec.field_name], languages: ['es'], photo_url: '/img/never-shown.jpg',
    consultation_fee_min: null, consultation_fee_max: null, accepting_new_patients: null, whatsapp: null, phone: null, website: null, data_verified_at: null,
    updated_at: '2026-10-10', listing_status: 'listed', source_name: clinic, source_url: 'https://clinica-ejemplo.example/directorio', source_retrieved_at: '2026-10-10' });
  locations.push({ id: id2, doctor_id: id2, facility_id: cityId === 1 ? 1 : 4, address: cityId === 1 ? facilities[0].address : facilities[3].address, sector_id: null, city_id: cityId,
    lat: null, lng: null, schedule: [], phone: cityId === 1 ? '+1-809-555-0101' : '+1-809-555-0104', suite, phone_ext: ext });
});

// Sponsored placement (labeled, outside any ranking).
doctors[2].sponsored = true;

export const redirects: RedirectRow[] = [
  { from_path: '/dr-rafael-santos', to_path: `/${doctors[1].slug}`, status: 301 },
];

const reviewer = doctors[0];
export const guides: Guide[] = [
  {
    id: 1, slug: 'cuanto-cuesta-consulta-cardiologo', title: '¿Cuánto cuesta una consulta con cardiólogo en República Dominicana?',
    category: 'Costos', icon: 'heart', read_minutes: 4, reviewer_doctor_id: reviewer.id, reviewed_at: '2026-10-01',
    answer_summary: 'El precio de la consulta depende de la ciudad, el centro médico y la experiencia del especialista. Abajo mostramos el rango real de los perfiles verificados del directorio, con su fecha y tamaño de muestra.',
    body: [
      'Los precios que ves en [BRAND] son los que cada médico o centro declara y que verificamos al momento de la revisión. Pueden cambiar; confirma siempre con el consultorio antes de tu cita.',
      'Si tienes seguro (ARS), la consulta puede estar cubierta total o parcialmente según tu plan. Pregunta por el copago antes de agendar.',
    ],
    sources: [{ title: 'Ministerio de Salud Pública de la República Dominicana', url: 'https://www.msp.gob.do' }],
    related_specialty_slugs: ['cardiologos'],
  },
  {
    id: 2, slug: 'cuando-visitar-cardiologo', title: '¿Cuándo deberías visitar a un cardiólogo?',
    category: 'Salud del corazón', icon: 'heart', read_minutes: 4, reviewer_doctor_id: reviewer.id, reviewed_at: '2026-10-01',
    answer_summary: 'Consulta a un cardiólogo si tu médico general te lo recomienda o si tienes factores de riesgo o síntomas persistentes. Ante dolor de pecho intenso o dificultad para respirar, busca atención de emergencia.',
    body: ['Esta guía es informativa y no reemplaza la evaluación de un profesional de la salud.'],
    sources: [{ title: 'Organización Mundial de la Salud: enfermedades cardiovasculares', url: 'https://www.who.int/health-topics/cardiovascular-diseases' }],
    related_specialty_slugs: ['cardiologos'],
  },
  {
    id: 3, slug: 'como-elegir-medico-que-acepte-tu-ars', title: 'Cómo elegir un médico que acepte tu ARS',
    category: 'Seguros médicos', icon: 'shield', read_minutes: 5, reviewer_doctor_id: reviewer.id, reviewed_at: '2026-10-01',
    answer_summary: 'Filtra por tu ARS en el directorio, confirma con el consultorio que tu plan específico está activo y pregunta por el copago antes de agendar.',
    body: ['La lista de ARS de cada perfil indica cuándo fue verificada por última vez. Aun así, la cobertura depende de tu plan.'],
    sources: [{ title: 'Superintendencia de Salud y Riesgos Laborales (SISALRIL)', url: 'https://www.sisalril.gob.do' }],
    related_specialty_slugs: ['cardiologos', 'pediatras'],
  },
  {
    id: 4, slug: 'tu-primera-consulta-que-llevar-y-preguntar', title: 'Tu primera consulta: qué llevar y qué preguntar',
    category: 'Tu consulta', icon: 'clipboard', read_minutes: 6, reviewer_doctor_id: reviewer.id, reviewed_at: '2026-10-01',
    answer_summary: 'Lleva tu documento de identidad, carnet de ARS, estudios previos y la lista de medicamentos que tomas. Prepara tus preguntas por escrito.',
    body: ['Anota síntomas, desde cuándo los tienes y qué los mejora o empeora.'],
    sources: [{ title: 'Ministerio de Salud Pública de la República Dominicana', url: 'https://www.msp.gob.do' }],
    related_specialty_slugs: ['medicos-generales'],
  },
];

export const SEED_TODAY = '2026-10-15';
