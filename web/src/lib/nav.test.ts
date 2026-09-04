import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  HEADER_CTA_HREF, headerCtaHref, normalizePath, samePath, sections, showFooterCta,
  showHeaderCta,
} from './nav';
import { hasTranslation, LOCALES } from '../i18n/locales';
import { hasHomeSection } from './sections';

describe('normalizePath', () => {
  it('снимает хвостовой слэш', () => expect(normalizePath('/contact/')).toBe('/contact'));
  it('корень остаётся корнем', () => expect(normalizePath('/')).toBe('/'));
  it('снимает якорь и запрос', () => {
    expect(normalizePath('/en/#services')).toBe('/en');
    expect(normalizePath('/cases?from=nav')).toBe('/cases');
  });
});

describe('samePath', () => {
  it('совпадение пути отмечается', () =>
    expect(samePath('/contact', '/contact')).toBe(true));
  it('хвостовой слэш совпадению не мешает', () =>
    expect(samePath('/contact', '/contact/')).toBe(true));
  it('другая страница не отмечается', () =>
    expect(samePath('/services', '/contact')).toBe(false));

  // Ссылка на секцию той же страницы — не «текущая страница»: иначе на любой
  // странице все пункты навигации разом получили бы aria-current, и
  // отметка перестала бы что-либо значить. С этой задачи так устроены ВСЕ
  // пункты шапки — не только английские — и текущий раздел показывает только
  // рельс (задача 4). НЕ «чинить» это: подробное обоснование — рядом с самой
  // функцией в `nav.ts`.
  it('ссылка на секцию не отмечается никогда', () => {
    expect(samePath('/en/#services', '/en')).toBe(false);
    expect(samePath('/en/#services', '/en/')).toBe(false);
    expect(samePath('/#services', '/')).toBe(false);
    expect(samePath('#contact', '/')).toBe(false);
  });
});

/* Разделы читают двое — шапка и подвал. Совпадение того, что они показывают,
   проверяет e2e (`tests/e2e/footer.spec.ts`): здесь проверяются свойства самого
   списка, которые ни один из двух потребителей проверить не может.

   С этой задачи пункты — якоря секций главной (`/#services` и подобные), а не
   адреса отдельных страниц: `/pricing`, `/about` и подобные не существуют.
   Раньше тест утверждал обратное — «пути абсолютные и БЕЗ якоря» — это было
   верно для старого устройства шапки и перестало быть требованием, которое
   стоит защищать: у решения «пункты — якоря» (спека 02, раздел 3) ровно
   противоположная форма. Новый инвариант — якорь ведёт на главную и указывает
   на секцию, которая там реально есть; проверяется через `lib/sections.ts`,
   единственный источник этого списка, а не второй ручной перечень тех же
   строк, который однажды расходится с первым. */
describe('sections', () => {
  it('каждый пункт — путь к главной СВОЕГО языка с якорем на реальную секцию', () => {
    // Английский пункт ведёт на `/en#services`, русский — на `/#services`.
    // Общий шаблон намеренно допускает оба и ровно два: пункт английской
    // шапки, ведущий на `/#…`, менял бы язык страницы нажатием на меню —
    // именно этот дефект тест и сторожит.
    for (const lang of LOCALES) {
      const home = lang === 'ru' ? '' : '/en';
      for (const item of sections(lang)) {
        const m = item.href.match(new RegExp(`^${home}/?#([a-z-]+)$`));
        expect(m, `${item.href} — не якорь главной языка ${lang}`).not.toBeNull();
        const id = m![1];
        expect(hasHomeSection(id), `${item.href} — такой секции нет в lib/sections.ts`)
          .toBe(true);
      }
    }
  });

  // Английская навигация — те же шесть разделов в том же порядке. Перевод
  // не имеет права потерять пункт: список у шапки и подвала один, и потеря
  // прошла бы молча на обеих.
  it('английские разделы — те же шесть якорей в том же порядке', () => {
    const anchors = (lang: 'ru' | 'en') =>
      sections(lang).map((i) => i.href.split('#')[1]);
    expect(anchors('en')).toEqual(anchors('ru'));
    expect(sections('en').map((i) => i.text))
      .toEqual(['Services', 'Pricing', 'Case studies', 'Guarantees', 'About', 'Reviews']);
  });

  it('один и тот же раздел не встречается дважды', () => {
    for (const lang of LOCALES) {
      const hrefs = sections(lang).map((i) => i.href);
      expect(new Set(hrefs).size, `повтор в разделах ${lang}`).toBe(hrefs.length);
    }
  });

  it('в русской навигации ровно шесть пунктов, «Отзывы» идут после «Обо мне»', () => {
    const ru = sections('ru');
    expect(ru.length).toBe(6);
    expect(ru.some((i) => i.text === 'Контакты'), 'пункт «Контакты» вернулся')
      .toBe(false);
    // Порядок — под порядок страницы (правка владельца 2026-08-13): цены
    // идут четвёртой секцией, кейсы пятой, гарантии восьмой — раньше шапка
    // называла «Кейсы» перед «Цены» и спорила со страницей.
    expect(ru.map((i) => i.text))
      .toEqual(['Услуги', 'Цены', 'Кейсы', 'Гарантии', 'Обо мне', 'Отзывы']);
  });

  // Правило, которое переживёт эту задачу: английский раздел появляется в
  // навигации только вместе со своей английской страницей. С возврата
  // английской главной 2026-08-22 список непуст, и тест наконец что-то
  // проверяет: все шесть пунктов — якоря `/en`, страница под которым есть.
  it('английский раздел обязан иметь английскую страницу', () => {
    for (const item of sections('en')) {
      // Якорь снимается перед проверкой: `hasTranslation` спрашивают про
      // СТРАНИЦУ, а `/en#services` — это место на странице `/en`.
      expect(hasTranslation(normalizePath(item.href)), `${item.href} — английской страницы нет`)
        .toBe(true);
    }
  });
});

describe('showHeaderCta', () => {
  // Правило живёт в одном месте, а не в свойстве каждой страницы: новая
  // страница ничего не обязана про кнопку помнить.
  it('на обычной странице кнопка есть', () => {
    expect(showHeaderCta('/')).toBe(true);
    expect(showHeaderCta('/privacy')).toBe(true);
  });
  it('на странице, куда ведёт сама кнопка, её нет', () => {
    expect(showHeaderCta(HEADER_CTA_HREF)).toBe(false);
    expect(showHeaderCta('/contact/')).toBe(false);
  });
  it('после отправки заявки её нет', () =>
    expect(showHeaderCta('/thanks')).toBe(false));
  it('английская версия тех же страниц считается так же', () => {
    expect(showHeaderCta('/en/contact')).toBe(false);
    expect(showHeaderCta('/en')).toBe(true);
  });
});

describe('headerCtaHref', () => {
  it('на главной — якорь этой же страницы, без перехода', () => {
    expect(headerCtaHref('/')).toBe('#contact');
    expect(headerCtaHref('/')).not.toBe(HEADER_CTA_HREF);
  });
  it('хвостовой слэш главной не мешает', () => {
    expect(headerCtaHref('')).toBe('#contact');
  });
  it('на любой другой странице — адрес страницы контактов', () => {
    expect(headerCtaHref('/privacy')).toBe(HEADER_CTA_HREF);
    expect(headerCtaHref('/cases')).toBe(HEADER_CTA_HREF);
  });
  // С возврата английской главной 2026-08-22 на `/en` стоят те же десять
  // секций, что на `/` (`components/home/HomePage.astro` — одна разметка на
  // обе версии), и якорь ведёт к форме на этой же странице. До перевода тест
  // утверждал обратное: секций там не было, и `#contact` вёл бы в пустоту.
  it('на английской главной — тот же якорь, а не уход на русский /contact', () => {
    expect(headerCtaHref('/en')).toBe('#contact');
    expect(headerCtaHref('/en/')).toBe('#contact');
  });

  // Задача Б-2 (2026-08-26): на любой другой английской странице форма живёт
  // на английской главной, а не на русском `/contact` — до правки здесь
  // возвращался `HEADER_CTA_HREF` без учёта языка, и подвал (`Footer.astro`,
  // который до этой же задачи читал `HEADER_CTA_HREF` напрямую, а не эту
  // функцию) уводил читателя английской страницы на русскую форму.
  it('на другой английской странице — английская главная, а не /contact', () => {
    expect(headerCtaHref('/en/privacy')).toBe('/en#contact');
    expect(headerCtaHref('/en/terms')).toBe('/en#contact');
    expect(headerCtaHref('/en/consent')).toBe('/en#contact');
    expect(headerCtaHref('/en/404')).toBe('/en#contact');
    expect(headerCtaHref('/en/privacy')).not.toBe(HEADER_CTA_HREF);
  });
});

/* Полоса действия подвала (`.footer-cta`) — спека
 * `70-workshop/specs/site-v3/09-footer-brief.md`, раздел 3. Правило одной
 * фразой (3.1): полосы нет там, где у страницы есть СВОЁ названное действие
 * внизу, и признаков этому теперь два, оба вычисляемые.
 *
 * Список путей ниже снят С ФАКТА, а не выписан из головы. Снято командой
 * `find dist -name "*.html" | wc -l` по `npm run build` в этом же ворктри —
 * **29** собранных страниц. Список путей ниже — результат того же обхода,
 * переведённый в маршруты.
 *
 * Ожидание для каждого пути не переписано вторым ручным перечнем «где полоса
 * есть/нет» — это повторило бы ошибку раздела 3.2 (список из варианта был
 * неполон) на новом месте. Вместо этого ожидание читается из СОДЕРЖИМОГО
 * уже собранной страницы: признак 1 — есть ли внутри `<main>` тег `<form>`
 * (раздел 3.3, «страница, содержащая `main form`, полосы не получает»);
 * признак 2 — несёт ли `<meta name="robots">` страницы `nofollow` (та же
 * функция `showFooterCta`, второй аргумент). Правка 2026-08-26 сняла с
 * `/thanks` последний путь-литерал этого теста: он снимался прежде особым
 * случаем «формы уже нет, но исключение по имени», теперь скрывается тем же
 * признаком 2, что и `/404`, — обходом читается функцией, а не угадывается
 * по имени. */
describe('showFooterCta', () => {
  const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));

  function htmlFiles(dir: string): string[] {
    if (!existsSync(dir)) return [];
    const out: string[] = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) out.push(...htmlFiles(p));
      else if (e.name.endsWith('.html')) out.push(p);
    }
    return out;
  }

  /** Путь файла в `dist/` → маршрут сайта (`cases/index.html` → `/cases`,
   *  `404.html` → `/404`, корневой `index.html` → `/`). */
  function routeOf(file: string): string {
    const rel = file.slice(DIST.length);
    if (rel === 'index.html') return '/';
    const withoutIndex = rel.endsWith('/index.html')
      ? rel.slice(0, -'/index.html'.length)
      : rel.slice(0, -'.html'.length);
    return `/${withoutIndex}`;
  }

  /** Есть ли в собранной странице своя форма внизу — признак 1 раздела 3.1,
   *  проверенный содержимым, а не названием пути. */
  function hasOwnMainForm(html: string): boolean {
    const main = html.match(/<main[\s>][\s\S]*?<\/main>/);
    return !!main && main[0].includes('<form');
  }

  /** Объявлена ли страница служебным конечным экраном — признак 2
   *  раздела 3.1, тот же самый, что читает `dist-footer-cta.test.ts`:
   *  `<meta name="robots">` несёт `nofollow`. */
  function isServiceScreen(html: string): boolean {
    const match = html.match(/<meta name="robots" content="([^"]*)"/);
    return !!match && match[1].includes('nofollow');
  }

  if (!existsSync(DIST)) {
    it('сборка существует (npm run build перед этим набором)', () => {
      throw new Error(
        `\nВ ${DIST} нет ни одного .html. Сначала выполни \`npm run build\` в ` +
        'web/, затем повтори `npm run test:unit` — раздел «Проверка» README.',
      );
    });
    return;
  }

  // Playwright может оставить служебный `/dev/ui`; это тестовая оболочка,
  // не маршрут production-сборки и не должна менять продуктовые итоги.
  const files = htmlFiles(DIST).filter((f) => !/[/\\]dev[/\\]/.test(f));
  const pages = files.map((f) => ({ path: routeOf(f), html: readFileSync(f, 'utf8') }));

  it('обход dist нашёл все реальные страницы — не меньше, чем сегодня (29)', () => {
    expect(pages.length).toBeGreaterThanOrEqual(29);
  });

  for (const { path, html } of pages) {
    const mainForm = hasOwnMainForm(html);
    const serviceScreen = isServiceScreen(html);
    const expectHidden = mainForm || serviceScreen;

    it(`${path} — полоса ${expectHidden ? 'скрыта' : 'показана'} (main form: ${mainForm}, служебный экран: ${serviceScreen})`, () => {
      expect(showFooterCta(path, serviceScreen)).toBe(!expectHidden);
    });
  }

  it('посчитано верное число страниц с полосой и без — 13 и 16 из 29', () => {
    const shown = pages.filter(({ path, html }) =>
      showFooterCta(path, isServiceScreen(html))).length;
    expect(shown).toBe(13);
    expect(pages.length - shown).toBe(16);
  });

  // Отдельно, без обращения к dist: сама формула читается по путям из
  // раздела 3.1 буквально — эти примеры называют правило по имени (признак
  // 1), а обход выше проверяет оба признака на каждой реальной странице.
  it('правило по имени: главная, /contact и посадочная услуги — без полосы', () => {
    expect(showFooterCta('/')).toBe(false);
    expect(showFooterCta('/contact')).toBe(false);
    expect(showFooterCta('/contact/')).toBe(false);
    expect(showFooterCta('/services/website')).toBe(false);
  });

  it('правило по имени: каталог услуг — не посадочная, полоса есть', () => {
    expect(showFooterCta('/services')).toBe(true);
    expect(showFooterCta('/services/')).toBe(true);
  });

  it('локаль снимается так же, как у showHeaderCta', () => {
    expect(showFooterCta('/en')).toBe(false);
    expect(showFooterCta('/en/contact')).toBe(false);
    expect(showFooterCta('/en/privacy')).toBe(true);
    expect(showFooterCta('/en/404')).toBe(true);
  });

  // Признак 2 — признак, а не переименованный список путей: без пути `/404`
  // получал бы полосу как обычная страница, а с ним снимает её только тогда,
  // когда САМА СТРАНИЦА объявила себя служебным конечным экраном. `/thanks`
  // без пути в перечне `FOOTER_CTA_HIDDEN_EXACT` ведёт себя так же —
  // разница целиком в аргументе, а не в адресе.
  it('второй признак — параметр, а не список: страница без nofollow получает полосу', () => {
    expect(showFooterCta('/404', true)).toBe(false);
    expect(showFooterCta('/404', false)).toBe(true);
    expect(showFooterCta('/thanks', true)).toBe(false);
    expect(showFooterCta('/thanks', false)).toBe(true);
    expect(showFooterCta('/en/thanks', true)).toBe(false);
    expect(showFooterCta('/en/thanks', false)).toBe(true);
  });
});
