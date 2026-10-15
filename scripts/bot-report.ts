// Daily crawler report from the JSONL bot_hit logs: node scripts/bot-report.ts < server.log
// Exit code 1 (alert) if any AI crawler got 403/429/5xx (SPEC §11: "Alert if AI bots get 403s").
import { createInterface } from 'node:readline';

const perBot = new Map<string, { total: number; byStatus: Map<number, number>; ai: boolean }>();
for await (const line of createInterface({ input: process.stdin })) {
  if (!line.includes('"bot_hit"')) continue;
  try {
    const e = JSON.parse(line);
    const b = perBot.get(e.bot) ?? { total: 0, byStatus: new Map(), ai: e.ai };
    b.total++; b.byStatus.set(e.status, (b.byStatus.get(e.status) ?? 0) + 1); perBot.set(e.bot, b);
  } catch { /* ignore non-JSON lines */ }
}
let alert = false;
for (const [bot, b] of [...perBot].sort((a, c) => c[1].total - a[1].total)) {
  const blocked = [...b.byStatus].filter(([s]) => s === 403 || s === 429 || s >= 500).reduce((n, [, c]) => n + c, 0);
  const rate = ((100 * blocked) / b.total).toFixed(1);
  console.log(`${bot.padEnd(18)} ${String(b.total).padStart(6)} hits  ${[...b.byStatus].map(([s, c]) => `${s}:${c}`).join(' ')}  blocked ${rate}%${b.ai ? '  [AI]' : ''}`);
  if (b.ai && blocked > 0) { alert = true; console.error(`ALERT: ${bot} received ${blocked} blocked/error responses`); }
}
if (!perBot.size) console.log('No crawler hits found.');
process.exit(alert ? 1 : 0);
