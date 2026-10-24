// Root slugs that doctor profiles must never use (SPEC §3). Specialty slugs are added at runtime.
export const RESERVED_ROOT_SLUGS = [
  'especialidad', 'ciudad', 'ars', 'guia', 'centro', 'en', 'metodologia', 'quienes-somos',
  'como-verificamos', 'politica-editorial', 'publicidad-y-patrocinios', 'privacidad', 'contacto', 'doctores', 'disponibles',
  'buscar', 'api', 'admin', 'pagina', 'llms.txt', 'robots.txt', 'sitemap-index.xml',
];

export function isReservedSlug(slug: string, specialtySlugs: string[]): boolean {
  const s = slug.toLowerCase();
  return RESERVED_ROOT_SLUGS.includes(s) || s.startsWith('sitemap') || specialtySlugs.includes(s);
}

export function slugify(input: string): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const isValidSlug = (s: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
