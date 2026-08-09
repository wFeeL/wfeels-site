import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { isIndexable } from './src/lib/sitemap.ts';
import { devPagesEnabled } from './src/lib/dev-pages.ts';

const SITE = process.env.SITE_URL ?? 'http://localhost:4321';

/** Служебная витрина компонентов существует как маршрут только там, где она
 *  нужна: в разработке и в сборке под тесты.
 *
 *  Файл лежит ВНЕ `src/pages/` намеренно — всё, что лежит там, становится
 *  страницей безусловно, и другого способа не выпустить её в боевую сборку
 *  нет. Раньше витрину закрывали `noindex` и правило в Caddy: страница в
 *  `dist` была, и та же сборка на любой другой раздаче показала бы её наружу.
 *  Теперь в боевой сборке маршрута просто не существует — закрывать нечего.
 *
 *  Условие живёт в `lib/dev-pages.ts` и проверено юнит-тестом: забыть снять
 *  флаг нельзя, по умолчанию витрины нет. */
const devPages = {
  name: 'dev-pages',
  hooks: {
    'astro:config:setup'({ command, injectRoute }) {
      if (!devPagesEnabled(command, process.env)) return;
      injectRoute({ pattern: '/dev/ui', entrypoint: './src/dev/ui.astro' });
    },
  },
};

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
    devPages,
    sitemap({
      filter: (page) => isIndexable(new URL(page).pathname),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
