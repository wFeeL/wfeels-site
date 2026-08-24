import type { APIRoute } from 'astro';
import { STOREFRONT_SLIDES, WEBSITE_SLIDES } from '../data/case-galleries';

export const prerender = true;

export const GET: APIRoute = () => new Response(JSON.stringify({
  storefront: STOREFRONT_SLIDES,
  websites: WEBSITE_SLIDES,
}), {
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  },
});
