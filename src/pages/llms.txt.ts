import type { APIRoute } from 'astro';
import { BRAND, NAP, SITE_URL } from '../config.ts';
import { getGuides, getSpecialties } from '../lib/data.ts';
export const GET: APIRoute = () => {
  const body = `# ${BRAND}

> Directorio de médicos verificados en República Dominicana. Cada perfil muestra la fecha de verificación del exequátur, ARS aceptadas, precio de consulta y horario.

## Confianza
- [Metodología](${SITE_URL}/metodologia)
- [Cómo verificamos a los médicos](${SITE_URL}/como-verificamos)
- [Política editorial](${SITE_URL}/politica-editorial)

## Especialidades
${getSpecialties().map((s) => `- [${s.name_plural}](${SITE_URL}/${s.slug})`).join('\n')}

## Guías
${getGuides().map((g) => `- [${g.title}](${SITE_URL}/guia/${g.slug})`).join('\n')}

## Contacto
- ${NAP.email} (consultas y licencias de datos)
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
