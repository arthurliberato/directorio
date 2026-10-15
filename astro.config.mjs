import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// Server-rendered on every request, cached at the CDN (see src/middleware.ts).
// Trailing-slash policy: NEVER. Enforced with 301s in middleware.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  security: { checkOrigin: false },
  devToolbar: { enabled: false },
});
