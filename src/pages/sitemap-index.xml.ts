import type { APIRoute } from 'astro';
import { renderIndex, sitemapFiles } from '../lib/sitemap.ts';
export const GET: APIRoute = () => new Response(renderIndex(sitemapFiles()), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600' } });
