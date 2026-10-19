import { BRAND, NAP } from '../config.ts';

export interface TrustPageData { slug: string; title: string; description: string; body: string[]; }

// Placeholder editorial copy. Replace with reviewed text (and legal review for privacy) before launch.
export const trustPages: TrustPageData[] = [
  { slug: 'quienes-somos', title: 'Quiénes somos', description: `Conoce a ${BRAND}, el directorio médico verificado de República Dominicana.`,
    body: [`${BRAND} es un directorio de médicos de la República Dominicana. Nuestro objetivo es que encuentres al especialista adecuado con información clara y verificada.`, 'Cada perfil muestra cuándo se verificó el exequátur del profesional y cuándo se revisaron por última vez sus datos.'] },
  { slug: 'metodologia', title: 'Nuestra metodología', description: 'Cómo recopilamos, calculamos y actualizamos los datos del directorio.',
    body: ['Los precios, ARS y horarios son declarados por cada profesional o centro y revisados por nuestro equipo.', 'Cuando mostramos estadísticas (por ejemplo, el rango de precios de una ciudad), indicamos el tamaño de la muestra (n) y la fecha de los datos.', 'Una página de especialidad y ciudad solo se publica para buscadores cuando tiene al menos 5 profesionales verificados.'] },
  { slug: 'como-verificamos', title: 'Cómo verificamos a los médicos', description: 'Revisamos exequátur, especialidad y datos de contacto antes de publicar un perfil.',
    body: ['En el directorio hay dos tipos de perfil. Los perfiles verificados son de médicos afiliados cuyo exequátur comprobamos; muestran foto, la insignia «Médico verificado» y aparecen primero. Los perfiles informativos se crean con datos públicos (por ejemplo, el directorio de una clínica o de una sociedad médica), no han sido verificados, no muestran foto y siempre indican su fuente y la fecha de consulta.', 'Verificamos el exequátur de cada profesional con el servicio oficial de consulta de exequátur y guardamos la fecha y la evidencia de la revisión.', 'Revisamos la pertenencia al Colegio Médico Dominicano cuando aplica y confirmamos los datos de contacto.', 'Repetimos la verificación al menos cada 6 meses. Los perfiles con revisión vencida se marcan para actualización.', 'Si eres uno de los profesionales de un perfil informativo, puedes solicitar su verificación, corrección o retiro desde la página de contacto.'] },
  { slug: 'politica-editorial', title: 'Política editorial', description: 'Principios editoriales, revisión médica y correcciones.',
    body: ['Las guías de salud son informativas, no sustituyen la consulta médica y son revisadas por un profesional con exequátur verificado, cuyo nombre y fecha de revisión se publican.', 'Citamos nuestras fuentes y corregimos los errores en cuanto los detectamos. Escríbenos desde la página de contacto.'] },
  { slug: 'publicidad-y-patrocinios', title: 'Publicidad y patrocinios', description: 'Cómo identificamos los espacios patrocinados.',
    body: ['Los espacios pagados siempre están identificados con la etiqueta «Patrocinado» y un estilo visual distinto.', 'Los patrocinios nunca forman parte de listas ordenadas ni influyen en comparaciones. Los enlaces patrocinados a sitios externos usan rel="sponsored".'] },
  { slug: 'privacidad', title: 'Política de privacidad', description: 'Cómo tratamos los datos personales conforme a la Ley 172-13.',
    body: ['Este texto es provisional y debe ser revisado por un abogado dominicano antes del lanzamiento (Ley 172-13 sobre Protección de Datos Personales).', 'No mostramos la cédula de los profesionales. Guardamos únicamente un hash para evitar duplicados.'] },
  { slug: 'contacto', title: 'Contacto', description: `Escríbenos a ${NAP.email} para consultas, correcciones de perfiles, verificación o retiro de datos, y licencias de datos.`,
    body: [`Correo: ${NAP.email}`, `Dirección: ${NAP.street}, ${NAP.locality}, ${NAP.countryName}`, 'Si eres profesional de la salud y quieres reclamar o corregir tu perfil, escríbenos con tu número de exequátur.'] },
];
export const getTrustPage = (slug: string) => trustPages.find((p) => p.slug === slug) ?? null;
