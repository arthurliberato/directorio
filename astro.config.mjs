import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

// Server-rendered on every request, cached at the CDN (see src/middleware.ts).
// Trailing-slash policy: NEVER. Enforced with 301s in middleware.
// Hosting: Vercel (serverless; VERCEL=1 is set during its builds) or any Node host (Render, VPS, local).
export default defineConfig({
  output: 'server',
  adapter: process.env.VERCEL ? vercel() : node({ mode: 'standalone' }),
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  security: { checkOrigin: false },
  devToolbar: { enabled: false },
});
