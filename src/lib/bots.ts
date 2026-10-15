// Crawler classification for server-log monitoring (SPEC §11). Order matters: specific tokens first.
export const BOT_PATTERNS: [string, RegExp][] = [
  ['OAI-SearchBot', /OAI-SearchBot/i], ['ChatGPT-User', /ChatGPT-User/i], ['GPTBot', /GPTBot/i],
  ['Claude-SearchBot', /Claude-SearchBot/i], ['Claude-User', /Claude-User/i], ['ClaudeBot', /ClaudeBot/i],
  ['Perplexity-User', /Perplexity-User/i], ['PerplexityBot', /PerplexityBot/i],
  ['Google-Extended', /Google-Extended/i], ['Googlebot', /Googlebot/i], ['Bingbot', /bingbot/i],
  ['Applebot-Extended', /Applebot-Extended/i], ['Applebot', /Applebot/i], ['Bytespider', /Bytespider/i], ['CCBot', /CCBot/i],
];
export const AI_BOTS = new Set(['OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'Claude-SearchBot', 'Claude-User', 'ClaudeBot', 'Perplexity-User', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended']);
export const classifyBot = (ua: string | null): string | null => BOT_PATTERNS.find(([, re]) => re.test(ua ?? ''))?.[0] ?? null;

/** One JSON line per crawler hit -> stdout (collect with your host's log drain). Never logs humans. */
export const botLogLine = (bot: string, status: number, path: string, now = new Date()) =>
  JSON.stringify({ t: now.toISOString(), type: 'bot_hit', bot, ai: AI_BOTS.has(bot), status, path });
