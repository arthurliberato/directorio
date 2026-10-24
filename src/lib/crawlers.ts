import { SITE_MODE, SITE_URL } from '../config.ts';

// Named crawlers (SPEC §7.1). Keep in sync with vendor docs before launch (SPEC §14).
export const SEARCH_BOTS = ['Googlebot', 'Bingbot', 'Applebot'];
export const AI_SEARCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User'];
export const AI_TRAINING_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended'];
export const FILTER_DISALLOWS = ['/buscar', '/admin', '/api/', '/*?*orden=', '/*?*genero=', '/*?*precio=', '/*?*disponibilidad=', '/*?*dia=', '/*?*hora=', '/disponibles'];

/** A bot matching a specific group ignores `*`, so Disallow lines are repeated in every group. */
export function buildRobotsTxt(mode = SITE_MODE, site = SITE_URL): string {
  if (mode === 'prototype') return `# Prototype / illustrative data: nothing may be indexed.\nUser-agent: *\nDisallow: /\n`;
  const group = (label: string, bots: string[]) =>
    `# ${label}\n` + bots.map((b) => `User-agent: ${b}\nAllow: /\n${FILTER_DISALLOWS.map((d) => `Disallow: ${d}`).join('\n')}\n`).join('\n');
  return [
    group('Search engines', SEARCH_BOTS),
    group('AI search / retrieval', AI_SEARCH_BOTS),
    group('AI training (decision: allow — brand recall in models)', AI_TRAINING_BOTS),
    `# Everyone: no search/filter/sort URLs\nUser-agent: *\n${FILTER_DISALLOWS.map((d) => `Disallow: ${d}`).join('\n')}\n`,
    `Sitemap: ${site}/sitemap-index.xml\n`,
  ].join('\n');
}
