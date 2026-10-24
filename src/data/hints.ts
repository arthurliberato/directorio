// Plain-language hint shown next to a specialty on the signs (design kit §8). Only for specialties with an obvious everyday word; the rest show no hint.
export const SPECIALTY_HINTS: Record<string, string> = {
  pediatras: 'Niños', ginecologos: 'Mujer', dermatologos: 'Piel', cardiologos: 'Corazón', oftalmologos: 'Ojos', ortopedas: 'Huesos', traumatologos: 'Huesos',
  psiquiatras: 'Mente', psicologos: 'Mente', neurologos: 'Cerebro', urologos: 'Riñón y vías urinarias', gastroenterologos: 'Estómago', otorrinolaringologos: 'Oído, nariz y garganta',
  neumologos: 'Pulmones', endocrinologos: 'Hormonas', nutriologos: 'Alimentación', odontologos: 'Dientes', geriatras: 'Adultos mayores', 'medicos-generales': 'Medicina general', internistas: 'Adultos',
};

/** Organ / body-part icon per specialty (falls back to the icon stored in the database, then to the stethoscope). Names live in Icon.astro. */
export const SPECIALTY_ICONS: Record<string, string> = {
  cardiologos: 'heart', 'cirujanos-cardiovasculares': 'heart', 'cirujanos-vasculares': 'heart', pediatras: 'baby', neonatologos: 'baby', 'cirujanos-pediatricos': 'baby',
  ginecologos: 'uterus', obstetras: 'uterus', 'especialistas-en-fertilidad': 'uterus', dermatologos: 'layers', 'medicos-estetica': 'layers', 'cirujanos-plasticos': 'layers',
  ortopedas: 'bone', traumatologos: 'bone', reumatologos: 'bone', fisiatras: 'bone', 'medicos-del-deporte': 'bone', oftalmologos: 'eye',
  neurologos: 'brain', neurocirujanos: 'brain', psiquiatras: 'brain', psicologos: 'brain', urologos: 'kidney', nefrologos: 'kidney',
  gastroenterologos: 'stomach', 'cirujanos-bariatricos': 'stomach', coloproctologos: 'gut', hepatologos: 'liver', otorrinolaringologos: 'ear', neumologos: 'lungs', 'cirujanos-toracicos': 'lungs',
  endocrinologos: 'thyroid', diabetologos: 'drop', hematologos: 'drop', oncologos: 'ribbon', 'cirujanos-oncologos': 'ribbon', radiooncologos: 'ribbon', mastologos: 'ribbon',
  podologos: 'foot', 'cirujanos-de-mano': 'hand', geneticistas: 'dna', infectologos: 'virus', alergologos: 'flower', radiologos: 'xray', patologos: 'microscope', nutriologos: 'apple',
  intensivistas: 'plus', emergenciologos: 'plus', odontologos: 'tooth', ortodoncistas: 'tooth', endodoncistas: 'tooth', periodoncistas: 'tooth', 'cirujanos-maxilofaciales': 'tooth',
};
export const specialtyIcon = (slug: string, stored?: string | null) => SPECIALTY_ICONS[slug] ?? stored ?? 'stethoscope';
