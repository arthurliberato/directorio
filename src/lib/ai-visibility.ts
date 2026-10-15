export const ENGINES = ['chatgpt', 'perplexity', 'gemini', 'claude', 'copilot', 'google_ai_mode'] as const;
export interface RunRow { run_month: string; engine: string; prompt_id: string; cited: boolean; cited_url: string; position: number | null; accuracy: string; }

/** CSV columns: run_month,engine,prompt_id,cited,cited_url,position,accuracy,notes  (cited = 1/0/true/false). */
export function parseCsv(text: string, validPromptIds: Set<string>): { rows: RunRow[]; errors: string[] } {
  const rows: RunRow[] = []; const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = lines.shift()?.split(',').map((h) => h.trim()) ?? [];
  for (const need of ['run_month', 'engine', 'prompt_id', 'cited']) if (!header.includes(need)) errors.push(`missing column ${need}`);
  if (errors.length) return { rows, errors };
  lines.forEach((line, i) => {
    const cells = line.split(',').map((c) => c.trim()); const r = Object.fromEntries(header.map((h, j) => [h, cells[j] ?? '']));
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(r.run_month)) return errors.push(`line ${i + 2}: bad run_month`);
    if (!(ENGINES as readonly string[]).includes(r.engine)) return errors.push(`line ${i + 2}: unknown engine ${r.engine}`);
    if (!validPromptIds.has(r.prompt_id)) return errors.push(`line ${i + 2}: unknown prompt_id ${r.prompt_id}`);
    rows.push({ run_month: r.run_month.slice(0, 7), engine: r.engine, prompt_id: r.prompt_id, cited: ['1', 'true', 'yes'].includes(r.cited.toLowerCase()), cited_url: r.cited_url ?? '', position: r.position ? Number(r.position) : null, accuracy: r.accuracy ?? '' });
  });
  return { rows, errors };
}

/** Citation rate per month × engine, plus accuracy of cited answers. */
export function summarize(rows: RunRow[]) {
  const key = (r: RunRow) => `${r.run_month}|${r.engine}`;
  const groups = new Map<string, RunRow[]>();
  for (const r of rows) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([k, rs]) => {
    const [month, engine] = k.split('|'); const cited = rs.filter((r) => r.cited);
    const positioned = cited.filter((r) => r.position != null);
    return {
      month, engine, prompts: rs.length, cited: cited.length, citationRate: Math.round((1000 * cited.length) / rs.length) / 10,
      avgPosition: positioned.length ? Math.round((10 * positioned.reduce((n, r) => n + r.position!, 0)) / positioned.length) / 10 : null,
      inaccurate: cited.filter((r) => r.accuracy === 'inaccurate').length,
    };
  });
}
