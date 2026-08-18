import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homeCases, CASES_CATALOG_HREF } from '../data/cases';
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
 * Тизер фабрики (`FactoryTeaser.astro`) снят 2026-08-18 (D-048, бриф
 * `04-cases-brief.md`): «Фабрика ботов» стала четвёртым блоком секции —
 * проверки её текста и плиты переехали в `dist-factory-shelf.test.ts`. */
const DIST_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));

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

  it('секция 5: метка, заголовок, четыре блока кейсов дословно на странице', () => {
    expect(html).toContain('ЧТО УЖЕ СДЕЛАНО');
    expect(html).toContain('>Кейсы<');
    for (const c of homeCases()) {
      expect(html, c.title).toContain(c.title);
      expect(html, c.description!).toContain(c.description);
      expect(html, c.stack!).toContain(c.stack);
      expect(html, c.slug).toContain(`/cases/${c.slug}`);
    }
    expect(html).toContain('Разобрать кейс');
    expect(html).toContain('Все кейсы');
    expect(html).toContain(CASES_CATALOG_HREF);
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
    // Задачи 4–5 плана (`02-case-illustrations.md`) построили «Одну трубу» и
    // «Пример диалога»; D-048 (бриф `04-cases-brief.md`) добавила
    // «Стеллаж» — с этой правки наполнены все четыре поля секции 5.
    expect((section.match(/class="field"/g) || []).length,
      'в секции кейсов сегодня четыре наполненных поля иллюстрации')
      .toBe(4);
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

  it('четвёртый блок «Фабрика ботов»: адрес /cases/bot-factory, ровно один <a>, схема «Стеллаж» на месте', () => {
    const start = html.indexOf('id="cases"');
    const end = html.indexOf('id="process"');
    const section = html.slice(start, end);
    expect(section).toContain('/cases/bot-factory');
    expect(section).toContain('class="cf-stellar"');
    // Подробный разбор содержимого и чисел схемы — `dist-factory-shelf.test.ts`.
  });
});
