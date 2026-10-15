// Mobile Lighthouse gate (SPEC §9): fails if performance < 90 (and a11y/SEO/best-practices < 95).
// Usage: BASE=http://127.0.0.1:4321 [CHROME_PATH=...] node scripts/lighthouse.mjs   (server must be running)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4321';
const PAGES = ['/', '/dra-maria-perez-cardiologa', '/cardiologos/santo-domingo', '/guia/cuanto-cuesta-consulta-cardiologo'];
const MIN = { performance: 90, accessibility: 95, seo: 95, 'best-practices': 95 };
const dir = mkdtempSync(join(tmpdir(), 'lh-'));
let failed = 0;
for (const [i, path] of PAGES.entries()) {
  const out = join(dir, `${i}.json`);
  execFileSync('npx', ['lighthouse', BASE + path, '--chrome-flags=--headless=new --no-sandbox', '--only-categories=performance,accessibility,seo,best-practices', '--output=json', `--output-path=${out}`, '--quiet'], { stdio: 'inherit' });
  const r = JSON.parse(readFileSync(out, 'utf8'));
  const scores = Object.fromEntries(Object.entries(r.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
  const bad = Object.entries(MIN).filter(([k, min]) => scores[k] < min);
  console.log(path, scores, `LCP ${r.audits['largest-contentful-paint'].displayValue}`, `CLS ${r.audits['cumulative-layout-shift'].displayValue}`);
  if (bad.length) { failed++; console.error('  below threshold:', bad.map(([k]) => k).join(', ')); }
}
process.exit(failed ? 1 : 0);
