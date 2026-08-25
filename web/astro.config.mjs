import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { isIndexable } from './src/lib/sitemap.ts';
import { productionSite } from './src/lib/seo.ts';
import { devPagesEnabled } from './src/lib/dev-pages.ts';
import { compactReadableHtmlIntegration } from './src/lib/compactReadableHtml.ts';

// Canonical/sitemap всегда описывают публичный сайт, даже когда HTML собирают
// для локального preview. Явное неверное значение роняет сборку до записи dist.
const SITE = productionSite(process.env.SITE_URL);

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
  /* Панель разработчика Astro (плашка внизу экрана в `astro dev`) выключена по
     просьбе владельца: она перекрывает нижний край страницы ровно там, где он
     смотрит вёрстку. В боевую сборку панель не попадала никогда — это
     инструмент режима разработки, `astro build` его не выпускает. */
  devToolbar: { enabled: false },
  /* Сжатие разметки выключено — правка владельца 2026-08-18, пункт 1 списка:
     «собранный `dist/index.html` разбить на читаемые блоки по секциям».
     Astro по умолчанию склеивает разметку в длинные строки; на замере до
     правки главная выходила в 39 строках, самая длинная — 75 273 символа,
     и править в ней тексты или искать секцию глазами было нечем.

     Цена названа владельцем в самом пункте: вес страницы, который сторожит
     гейт (`scripts/check-budget.mjs`, предел 500 КБ по D-035). Отступы и
     переводы строк — самые сжимаемые байты, какие бывают, поэтому по сети
     цена почти нулевая: gzip съедает их почти целиком. Гейт считает сырые
     байты, поэтому число на странице («Замер», `data/pageWeight.ts`) после
     этой правки обязано быть пересчитано — иначе страница соврёт о себе,
     а гейт это поймает. */
  compressHTML: false,
  /* Возврат сжатия ловит сторож `tests/dist-readable-html.test.ts`: он
     считает строки собранной главной и требует, чтобы у каждой секции была
     своя. Одной строки в этом файле хватает, чтобы правку владельца
     отменить, — поэтому она закрыта тестом, а не только комментарием. */
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
    routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false },
  },
  integrations: [
    mdx(),
    devPages,
    compactReadableHtmlIntegration(),
    sitemap({
      filter: (page) => isIndexable(new URL(page).pathname),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
