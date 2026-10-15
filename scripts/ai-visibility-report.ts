// node scripts/ai-visibility-report.ts results.csv   (CSV spec: src/lib/ai-visibility.ts)
import { readFileSync } from 'node:fs';
import { parseCsv, summarize } from '../src/lib/ai-visibility.ts';

const prompts = JSON.parse(readFileSync(new URL('../monitoring/prompts.json', import.meta.url), 'utf8'));
const ids = new Set<string>([...prompts.es, ...prompts.en].map((p: any) => p.id));
const { rows, errors } = parseCsv(readFileSync(process.argv[2], 'utf8'), ids);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.table(summarize(rows));
