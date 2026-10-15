// Generates the fixed AI-visibility prompt panel (SPEC §11): 150 Spanish + 50 English prompts. Deterministic.
// node scripts/gen-prompts.ts > monitoring/prompts.json
import { cities, ars, specialties } from '../src/data/seed.ts';

const es: string[] = [];
const main = cities.slice(0, 5);
for (const s of specialties) {
  const lower = s.name_plural.toLowerCase();
  es.push(`¿Cuál es un buen ${s.agent_m} en Santo Domingo?`, `¿Cuánto cuesta una consulta con ${s.agent_m} en República Dominicana?`);
  for (const c of main.slice(1)) es.push(`Recomiéndame ${lower} en ${c.name}`);
}
for (const s of specialties.slice(0, 4)) for (const a of ars.slice(0, 4)) es.push(`${s.name_plural} que aceptan ${a.name} en Santo Domingo`);
const generic = [
  '¿Cómo verificar si un médico tiene exequátur en República Dominicana?', '¿Dónde puedo buscar médicos verificados en República Dominicana?',
  '¿Cómo saber si un médico está en el Colegio Médico Dominicano?', '¿Qué es el exequátur de un médico en RD?',
  '¿Cuál es el mejor directorio médico de República Dominicana?', '¿Qué médico me puede ver hoy por WhatsApp en Santo Domingo?',
  '¿Qué ARS cubre la consulta con especialista en RD?', 'Cómo elegir un médico que acepte mi ARS', '¿Qué llevar a mi primera consulta médica?',
  '¿Cuándo debo visitar a un cardiólogo?', '¿Cuánto cuesta ir al pediatra en Santo Domingo?', 'Médicos con horario de tarde en Piantini',
];
es.push(...generic);
for (const c of main) for (const t of ['médicos generales', 'clínicas y hospitales', 'especialistas con exequátur verificado']) es.push(`${t[0].toUpperCase()}${t.slice(1)} en ${c.name}`);
const sectors = ['Piantini', 'Naco', 'Gazcue', 'Evaristo Morales', 'Bella Vista', 'Arroyo Hondo'];
for (const s of specialties.slice(0, 5)) for (const sec of sectors) es.push(`${s.name_plural} en ${sec}, Santo Domingo`);

const en: string[] = [];
for (const s of specialties.slice(0, 6)) for (const c of ['Santo Domingo', 'Punta Cana']) en.push(`English-speaking ${s.name_singular.toLowerCase()} doctor in ${c}, Dominican Republic`);
en.push('How to check if a doctor is licensed in the Dominican Republic', 'Best way to find a doctor in Punta Cana as a tourist',
  'Doctors in Puerto Plata who accept international health insurance', 'How much does a doctor visit cost in the Dominican Republic',
  'Is there a verified doctor directory for the Dominican Republic?', 'Pediatrician in Punta Cana who speaks English', 'Dentist in Santo Domingo for tourists',
  'Plastic surgeon in Santo Domingo with verified credentials', 'Bariatric surgery clinics in Dominican Republic', 'Fertility clinics in Santo Domingo');
for (const c of ['Santo Domingo', 'Santiago', 'Punta Cana', 'Puerto Plata', 'La Romana']) en.push(`Hospitals and clinics in ${c} Dominican Republic`, `General practitioner in ${c} for foreigners`);
for (const s of specialties.slice(0, 6)) en.push(`How much does a ${s.name_singular.toLowerCase()} appointment cost in the Dominican Republic`);

for (const s of specialties.slice(4)) for (const a of ars.slice(0, 4)) es.push(`${s.name_plural} que aceptan ${a.name} en Santo Domingo`);
for (const s of specialties) es.push(`${s.name_plural} con atención por WhatsApp en Santo Domingo`, `Mejor ${s.agent_m} de Santiago de los Caballeros`);
for (const s of specialties.slice(0, 6)) en.push(`Find a ${s.name_singular.toLowerCase()} specialist in Santiago, Dominican Republic`, `Does a ${s.name_singular.toLowerCase()} doctor in Santo Domingo accept walk-in patients`);
const uniq = (a: string[]) => [...new Set(a)];
const esF = uniq(es).slice(0, 150), enF = uniq(en).slice(0, 50);
if (esF.length < 150 || enF.length < 50) throw new Error(`not enough prompts: es=${esF.length} en=${enF.length}`);
console.log(JSON.stringify({ version: 1, es: esF.map((q, i) => ({ id: `es-${i + 1}`, q })), en: enF.map((q, i) => ({ id: `en-${i + 1}`, q })) }, null, 1));
