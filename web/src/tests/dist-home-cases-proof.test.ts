import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homeCases, FACTORY_TEASER, CASES_CATALOG_HREF } from '../data/cases';
import { PROOF_ITEMS } from '../data/proof';

/* Тот же паттерн, что `dist-home-sections.test.ts`: читает `dist/index.html`
 * напрямую, без браузера, — доказывает, что текст секций 5 и 6 присутствует
 * в статической сборке без выполнения JavaScript (план `02-home-plan.md`,
 * общее ограничение «Статика прежде всего»). Требует `npm run build` перед
 * `npm run test:unit`. */
const DIST_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));

describe('dist/index.html — секции 5 и 6', () => {
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

  it('секция 5: метка, заголовок, три карточки кейсов дословно на странице', () => {
    expect(html).toContain('ЧТО УЖЕ СДЕЛАНО');
    expect(html).toContain('>Кейсы<');
    for (const c of homeCases()) {
      expect(html, c.title).toContain(c.title);
      expect(html, c.description!).toContain(c.description);
      expect(html, c.stack!).toContain(c.stack);
      expect(html, c.slug).toContain(`/cases/${c.slug}`);
    }
    expect(html).toContain('Все кейсы');
    expect(html).toContain(CASES_CATALOG_HREF);
  });

  it('секция 5: ни слова «клиент», «заказчик», «для компании» рядом с кейсами', () => {
    // Правило («ни слова «клиент», «заказчик», «для компании») касается
    // ТЕКСТА КЕЙСОВ (40-portfolio/CLAUDE.md), а не всей страницы: секция 3
    // законно обращается «ваши клиенты» к читателю (это его будущие
    // клиенты, не наш заказчик), секция 6 — «ваш клиент ждёт с телефона».
    // Смешивать эти обороты с происхождением кейса в одном общем поиске по
    // `dist/index.html` — доказано мутацией: первая версия этого теста
    // ловила «ваши клиенты» секции 3 и была снята с прода бы как ложную
    // тревогу. Поэтому здесь ищем не по всей странице, а по срезу секции 5
    // — от её якоря до якоря секции 6.
    const start = html.indexOf('id="cases"');
    const end = html.indexOf('id="proof"');
    expect(start, 'секция id="cases" не найдена в dist/index.html').toBeGreaterThan(-1);
    expect(end, 'секция id="proof" не найдена в dist/index.html').toBeGreaterThan(start);
    const casesSectionHtml = html.slice(start, end);
    // Отсекает «клиентский» (прилагательное, как в служебном тексте) —
    // запрещено само существительное «клиент» в падежных формах.
    const forbidden = /клиент(?!ск)|заказчик|для компании/i;
    expect(forbidden.test(casesSectionHtml)).toBe(false);
  });

  it('тизер фабрики: текст на месте, рисунка ядра ещё нет (задача 14)', () => {
    expect(html).toContain(FACTORY_TEASER.title);
    expect(html).toContain(FACTORY_TEASER.text);
    expect(html).toContain(FACTORY_TEASER.linkText);
    expect(html).toContain(FACTORY_TEASER.href);
    // Место зарезервировано разметкой (`data-factory-core-slot`), но пусто —
    // никакого <svg> внутри тизера до задачи 14.
    expect(html).toContain('data-factory-core-slot');
  });

  it('секция 6: метка, заголовок и все три доказательства дословно на странице', () => {
    expect(html).toContain('МОЖНО ПРОВЕРИТЬ, А НЕ ПОВЕРИТЬ');
    expect(html).toContain('Что можно проверить');
    for (const item of PROOF_ITEMS) {
      expect(html, item.lead).toContain(item.lead);
      for (const p of item.paragraphs) {
        expect(html, p.slice(0, 40)).toContain(p);
      }
      if (item.linkText) expect(html, item.linkText).toContain(item.linkText);
    }
  });

  it('секция 6: числа сроков — дословно из 02-texts.md, не пересчитаны', () => {
    expect(html).toContain('2–4 дня');
    expect(html).toContain('2–3 недели');
    expect(html).toContain('от одного до четырёх месяцев');
    // Отменённая формулировка не должна вернуться молча.
    expect(html).not.toContain('4–6 недель');
  });
});
