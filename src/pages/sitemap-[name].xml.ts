import type { APIRoute } from 'astro';
import { renderUrlset, sitemapFiles } from '../lib/sitemap.ts';
export const GET: APIRoute = ({ params }) => {
  const urls = sitemapFiles().get(params.name!);
  if (!urls) return new Response('Not found', { status: 404 });
  return new Response(renderUrlset(urls), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600' } });
};
