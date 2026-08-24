import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homeCases } from '../data/cases';
import {
  CASE_GALLERIES_URL,
  STOREFRONT_SLIDES,
  WEBSITE_SLIDES,
} from '../data/case-galleries';
import { PAGE_WEIGHT_KB } from '../data/pageWeight';

/* Тот же паттерн, что `dist-home-sections.test.ts`: читает `dist/index.html`
 * напрямую, без браузера, — доказывает, что текст секции 5 присутствует
 * в статической сборке без выполнения JavaScript (план `02-home-plan.md`,
 * общее ограничение «Статика прежде всего»). Требует `npm run build` перед
 * `npm run test:unit`.
 *
 * Секция 6 «Что можно проверить» снята 2026-08-13 (D-030, бриф
 * `02-case-illustrations.md`) — её проверки отсюда удалены, а не
 * закомментированы: файл раньше назывался `dist-home-cases-proof.test.ts`.
 *
 * «Фабрика ботов» снята с главной правкой владельца 2026-08-19: её проверки
 * (`dist-factory-shelf.test.ts` и оба e2e-сторожа «Стеллажа») удалены вместе
 * с предметом, а не оставлены пустыми. Сторож отсутствия живёт ниже — по
 * срезу секции, и в `data/cases.test.ts`.
 *
 * Правка владельца 2026-08-20 оставила на главной один блок — «Этот сайт».
 * «ИИ-консультант» и «Заявка-Хаб» с неё ушли, но из данных и из кода не
 * удалены: их проверки не выброшены, а переведены на новое состояние —
 * сторож ниже требует, чтобы их разметки в секции не было. С 2026-08-24
 * вторым блоком добавлен Telegram Mini App, третьим — сайты. */
const DIST_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));
const DIST_GALLERIES = fileURLToPath(new URL('../../dist/case-galleries.json', import.meta.url));

describe('dist/index.html — секция 5', () => {
  it('сборка существует (npm run build перед этим набором)', () => {
    if (!existsSync(DIST_INDEX)) {
      throw new Error(
        `\n${DIST_INDEX} не найден. Сначала выполни \`npm run build\` в web/, ` +
        'затем повтори `npm run test:unit`.',
      );
    }
    expect(true).toBe(true);
  });

  if (!existsSync(DIST_INDEX)) return;
  const html = readFileSync(DIST_INDEX, 'utf8');
  const galleryManifest = existsSync(DIST_GALLERIES)
    ? JSON.parse(readFileSync(DIST_GALLERIES, 'utf8'))
    : null;

  it('секция 5: метка, заголовок во множественном числе, оба блока дословно', () => {
    expect(html).toContain('ЧТО УЖЕ СДЕЛАНО');
    expect(html).toContain('>Кейсы<');
    for (const c of homeCases()) {
      expect(html, c.title).toContain(c.title);
      expect(html, c.description!).toContain(c.description);
      expect(html, c.stack!).toContain(c.stack);
    }
  });

  /* Сторож правки владельца 2026-08-20 (вечер): «пока убираем ссылку с кейса
     „Этот сайт“, иначе она ведет на несуществующую страницу». Прежде здесь
     стояло `toContain('/cases/' + c.slug)` и `toContain('Разобрать кейс')` —
     обе проверки требовали ровно того, что снято, и обе вывернуты, а не
     удалены: без них ссылка могла бы вернуться молча. Живучесть самой
     ловушки — обходом всех ссылок главной в `dist-home-links.test.ts`. */
  it('в блоке кейса нет ни ссылки на страницу кейса, ни метки «Разобрать кейс»', () => {
    const start = html.indexOf('id="cases"');
    const end = html.indexOf('id="process"');
    const section = html.slice(start, end);
    for (const c of homeCases()) {
      expect(section, `ссылка на /cases/${c.slug}`).not.toMatch(
        new RegExp(`href=["']\\/cases\\/${c.slug}(?:[\\/"'#?])`),
      );
    }
    expect(section, 'метка «Разобрать кейс →»').not.toContain('Разобрать кейс');
    // Ни одного `<a>` в секции вовсе: заголовок был единственной ссылкой
    // блока (вариант В, D-047), других в секции не было и не появилось.
    expect(section, 'в секции кейсов не должно остаться ссылок').not.toContain('<a ');
  });

  /* Сторож снятия кнопки «Все кейсы» (правка владельца 2026-08-20). Прежде
     на этом месте стояло `expect(html).toContain(CASES_CATALOG_HREF)` — и
     именно оно держало дефект зелёным: кнопка вела на `/cases`, страницы по
     адресу не существовало, а тест подтверждал наличие АДРЕСА в разметке.
     Теперь проверяется отсутствие кнопки, а живучесть самой ловушки —
     обходом всех ссылок главной в `dist-home-links.test.ts`. */
  it('кнопки «Все кейсы» на главной нет, и адреса /cases в разметке тоже', () => {
    const start = html.indexOf('id="cases"');
    const end = html.indexOf('id="process"');
    const section = html.slice(start, end);
    expect(section).not.toContain('Все кейсы');
    expect(section).not.toContain('href="/cases"');
  });

  it('снятые с главной кейсы на ней не выводятся: ни заголовка, ни рисунка', () => {
    const start = html.indexOf('id="cases"');
    const end = html.indexOf('id="process"');
    const section = html.slice(start, end);
    for (const title of ['ИИ-консультант', 'Заявка-Хаб']) {
      expect(section, title).not.toContain(title);
    }
    // Рисунки остались в коде (их возьмёт страница каталога), но на главной
    // их разметки быть не должно — иначе они молча весили бы страницу.
    expect(section).not.toContain('data-case-flow');
    expect(section).not.toContain('data-case-dialogue');
  });

  it('Telegram Mini App: три приложения, девять экранов и один ресурс первой загрузки', () => {
    const start = html.indexOf('id="cases"');
    const end = html.indexOf('id="process"');
    const section = html.slice(start, end);
    expect(section).toContain('data-storefront-gallery');
    expect(section).toContain('data-gallery-key="storefront"');
    expect(section).toContain(`data-slides-src="${CASE_GALLERIES_URL}"`);
    expect(section).toContain('/cases/storefront/yasmina-home.avif');
    expect(galleryManifest?.storefront).toEqual(STOREFRONT_SLIDES);
    expect((section.match(/<img\b[^>]*\bdata-storefront-screen\b/g) || []).length).toBe(1);
  });

  it('Сайты: три направления, девять экранов и отложенный первый ресурс', () => {
    const start = html.indexOf('id="cases"');
    const end = html.indexOf('id="process"');
    const section = html.slice(start, end);
    expect(section).toContain('data-website-gallery');
    expect(section).toContain('data-defer="true"');
    expect(section).toContain('data-gallery-key="websites"');
    expect(section).toContain(`data-slides-src="${CASE_GALLERIES_URL}"`);
    expect(galleryManifest?.websites).toEqual(WEBSITE_SLIDES);
    const websiteImage = section.match(/<img\b[^>]*\bdata-website-screen\b[^>]*>/)?.[0];
    expect(websiteImage).toBeTruthy();
    expect(websiteImage).not.toMatch(/\bsrc=/);
  });

  it('блок «Этот сайт»: иллюстрация «Замер» несёт машинный якорь гейта веса', () => {
    // С 2026-08-14 (пункт 7 списка правок владельца) прозаической подписи
    // под полем больше нет — коэффициент печатается внутри самой
    // иллюстрации. `check-budget.mjs` находит её по этому атрибуту; сюда
    // выведена только сама проверка присутствия, подробный разбор чисел —
    // `dist-case-weight-illustration.test.ts`.
    expect(html, 'data-illustration="case-weight"').toContain(
      'data-illustration="case-weight"',
    );
  });

  it('блок «Этот сайт»: число внутри поля иллюстрации — вес из data/pageWeight.ts', () => {
    const start = html.indexOf('id="cases"');
    const end = html.indexOf('id="process"');
    const section = html.slice(start, end);
    // Поле — по одному на блок, и число обязано совпадать с длиной
    // `homeCases()`. «Одной трубы» и «Примера диалога» на главной нет;
    // второе поле теперь занимает галерея Telegram Mini App.
    expect((section.match(/class="[^"]*\bfield\b[^"]*"/g) || []).length,
      'в секции кейсов ровно по одному наполненному полю иллюстрации на блок')
      .toBe(homeCases().length);
    expect(section, 'вес страницы не найден внутри поля «Замер»')
      .toContain(String(PAGE_WEIGHT_KB));
  });

  it('секция 5: ни слова «клиент», «заказчик», «для компании» рядом с кейсами', () => {
    // Правило («ни слова «клиент», «заказчик», «для компании») касается
    // ТЕКСТА КЕЙСОВ (40-portfolio/CLAUDE.md), а не всей страницы: секция 3
    // законно обращается «ваши клиенты» к читателю (это его будущие
    // клиенты, не наш заказчик). Смешивать эти обороты с происхождением
    // кейса в одном общем поиске по `dist/index.html` — доказано мутацией:
    // первая версия этого теста ловила «ваши клиенты» секции 3 и была снята
    // с прода бы как ложную тревогу. Поэтому здесь ищем не по всей странице,
    // а по срезу секции 5 — от её якоря до якоря следующей секции («Как я
    // работаю» — секция 6 «Что можно проверить» снята, точки рельса сдвинуты).
    const start = html.indexOf('id="cases"');
    const end = html.indexOf('id="process"');
    expect(start, 'секция id="cases" не найдена в dist/index.html').toBeGreaterThan(-1);
    expect(end, 'секция id="process" не найдена в dist/index.html').toBeGreaterThan(start);
    const casesSectionHtml = html.slice(start, end);
    // Отсекает «клиентский» (прилагательное, как в служебном тексте) —
    // запрещено само существительное «клиент» в падежных формах.
    const forbidden = /клиент(?!ск)|заказчик|для компании/i;
    expect(forbidden.test(casesSectionHtml)).toBe(false);
  });

  it('«Фабрики ботов» на главной нет: ни адреса, ни заголовка, ни схемы «Стеллаж»', () => {
    // Сторож снятия (правка владельца 2026-08-19). Проверяется срез секции
    // 5, а не вся страница: слово «фабрика» может законно появиться в
    // тексте другой секции, а вот блок кейса — нет.
    const start = html.indexOf('id="cases"');
    const end = html.indexOf('id="process"');
    const section = html.slice(start, end);
    expect(section).not.toContain('/cases/bot-factory');
    expect(section).not.toContain('Фабрика ботов');
    expect(section).not.toContain('class="cf-stellar"');
  });
});
