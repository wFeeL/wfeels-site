import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { isIndexable } from './src/lib/sitemap.ts';

const SITE = process.env.SITE_URL ?? 'http://localhost:4321';

export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'never',
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
    routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false },
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => isIndexable(new URL(page).pathname),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
