// Mentions of a doctor in press, articles, videos and social posts (migration 007). Pure helpers: validation, labels, JSON-LD.
import { SITE_URL } from '../config.ts';
import type { DoctorMention, MentionKind, MentionTextOrigin } from './types.ts';

const abs = (path: string) => `${SITE_URL}${path}`;
export const MENTION_KINDS: MentionKind[] = ['press', 'article', 'video', 'social'];
export const MENTION_KIND_LABEL: Record<MentionKind, string> = { press: 'Prensa', article: 'Artículo', video: 'Video', social: 'Publicación en redes' };
export const MENTION_ORIGIN_LABEL: Record<MentionTextOrigin, string> = { excerpt: 'Extracto', summary: 'Resumen de guiddo' };
export const MENTION_SUMMARY_MAX = 600;

export interface MentionInput {
  kind: string; title: string; source_name: string; url: string; published_on: string | null; image_url: string | null;
  summary: string | null; summary_origin: string | null; published: boolean;
}

export function validateMention(m: MentionInput): string[] {
  const errs: string[] = [];
  if (!(MENTION_KINDS as string[]).includes(m.kind)) errs.push('tipo no válido');
  if (m.title.trim().length < 3 || m.title.length > 200) errs.push('título: entre 3 y 200 caracteres');
  if (m.source_name.trim().length < 2 || m.source_name.length > 100) errs.push('fuente: entre 2 y 100 caracteres');
  try { if (new URL(m.url).protocol !== 'https:') throw new Error(); } catch { errs.push('el enlace debe ser una URL https:// válida'); }
  if (m.image_url && !/^(https:\/\/\S+|\/[a-z0-9._\/-]+)$/i.test(m.image_url)) errs.push('la foto debe ser una URL https:// o una ruta del sitio como /img/foto.jpg');
  if (m.published && !m.image_url) errs.push('cada publicación necesita una foto para publicarse');
  if (m.published_on && (!/^\d{4}-\d{2}-\d{2}$/.test(m.published_on) || Number.isNaN(Date.parse(m.published_on)))) errs.push('fecha de publicación no válida (AAAA-MM-DD)');
  if (m.summary && m.summary.length > MENTION_SUMMARY_MAX) errs.push(`el texto no puede pasar de ${MENTION_SUMMARY_MAX} caracteres`);
  if (m.summary && !(m.summary_origin === 'excerpt' || m.summary_origin === 'summary')) errs.push('indica si el texto es un extracto o un resumen');
  return errs;
}

/** Schema.org for the items that are visible on the page (same records as the HTML). */
export function mentionsJsonLd(list: DoctorMention[]) {
  return list.map((m) => Object.fromEntries(Object.entries({
    '@type': m.kind === 'article' || m.kind === 'press' ? 'Article' : m.kind === 'social' ? 'SocialMediaPosting' : 'CreativeWork',
    headline: m.title, name: m.title, url: m.url, image: m.image_url ? (m.image_url.startsWith('/') ? abs(m.image_url) : m.image_url) : undefined, datePublished: m.published_on ?? undefined,
    publisher: { '@type': 'Organization', name: m.source_name },
  }).filter(([, v]) => v != null)));
}
