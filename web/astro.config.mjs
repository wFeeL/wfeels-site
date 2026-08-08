import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const SITE = process.env.SITE_URL ?? 'http://localhost:4321';

// Юридические и служебные страницы: пока в них плейсхолдеры вместо реквизитов
// (см. Задачи 8, 11), они не должны попадать в sitemap.
const EXCLUDED = ['/dev/', '/politika', '/oferta', '/soglasie', '/spasibo'];

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
      filter: (page) => !EXCLUDED.some((p) => new URL(page).pathname.startsWith(p)),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
