import type { APIRoute } from 'astro';
import {
  STOREFRONT_SLIDES,
  STOREFRONT_SLIDES_EN,
  WEBSITE_SLIDES,
  WEBSITE_SLIDES_EN,
} from '../data/case-galleries';

export const prerender = true;

export const GET: APIRoute = () => new Response(JSON.stringify({
  'storefront-ru': STOREFRONT_SLIDES,
  'storefront-en': STOREFRONT_SLIDES_EN,
  'websites-ru': WEBSITE_SLIDES,
  'websites-en': WEBSITE_SLIDES_EN,
}), {
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  },
});
