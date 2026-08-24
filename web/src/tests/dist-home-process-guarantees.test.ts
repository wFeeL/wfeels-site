import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROCESS_STEPS, GUARANTEES } from '../data/process';
import { HERO_TERMS } from '../data/terms';

/* Тот же паттерн, что `dist-home-cases.test.ts`: читает `dist/index.html`
 * напрямую, без браузера, — доказывает, что текст секций 7 и 8 присутствует
 * в статической сборке без выполнения JavaScript (план `02-home-plan.md`,
 * общее ограничение «Статика прежде всего»). Требует `npm run build` перед
 * `npm run test:unit`. */
const DIST_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));

describe('dist/index.html — секции 7 и 8', () => {
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

  it('секция 7: метка, заголовок и все пять шагов дословно на странице', () => {
    expect(html).toContain('КАК ЭТО БУДЕТ');
    expect(html).toContain('>Как я работаю<');
    for (const step of PROCESS_STEPS) {
      expect(html, step.title).toContain(step.title);
    }
  });

  it('секция 8: метка, заголовок и все четыре гарантии дословно на странице', () => {
    expect(html).toContain('ГАРАНТИИ');
    expect(html).toContain('>Что я гарантирую<');
    for (const g of GUARANTEES) {
      expect(html, g.title).toContain(g.title);
      expect(html, g.text).toContain(g.text);
    }
  });

  it('гарантии «Сколько это занимает» на странице нет, а срок работ назван по-прежнему', () => {
    // Правка владельца 2026-08-20 сняла пятую гарантию вместе с доводом про
    // студии. Проверяется срез секции, а не вся страница: слова «сколько» и
    // «занимает» могут законно встретиться в другом тексте.
    const start = html.indexOf('id="guarantees"');
    const end = html.indexOf('id="about"');
    const section = html.slice(start, end);
    expect(section).not.toContain('Сколько это занимает');
    expect(section).not.toContain('от одного до четырех месяцев');
    expect(section).not.toContain('беру мало проектов');
    // Отменённая формулировка не должна вернуться молча.
    expect(html).not.toContain('4–6 недель');
    // Срок работ со страницы не исчез — его называет таблица первого экрана
    // (`data/terms.ts`), и это единственное оставшееся место. Без этой
    // строки снятие гарантии могло бы молча унести с сайта сроки целиком.
    expect(html, 'срок работ из data/terms.ts').toContain(HERO_TERMS[0].term);
  });

  it('договорный порядок присутствует в разметке', () => {
    const start = html.indexOf('id="process"');
    const end = html.indexOf('id="about"');
    expect(start, 'секция id="process" не найдена в dist/index.html').toBeGreaterThan(-1);
    expect(end, 'секция id="about" не найдена в dist/index.html').toBeGreaterThan(start);
    const section = html.slice(start, end);
    expect(section).toContain('Смета, договор и ТЗ');
    expect(section).toContain('Цена, сроки и объем — в договоре');
    expect(section).toContain('письменного согласования');
  });

  it('в секции 7 срока цифрой нет — итоговая полоса «30 дней» снята правкой владельца 2026-08-20', () => {
    const start = html.indexOf('id="process"');
    const end = html.indexOf('id="guarantees"');
    expect(start, 'секция id="process" не найдена в dist/index.html').toBeGreaterThan(-1);
    expect(end, 'секция id="guarantees" не найдена в dist/index.html').toBeGreaterThan(start);
    const section = html.slice(start, end);
    // `&nbsp;` в разметке — та самая неразрывная связка снятой выноски.
    expect(/\d+(&nbsp;|\s)*дн/i.test(section)).toBe(false);
    // Срок при этом обязан остаться словом — шаг 5 не тронут.
    expect(section).toContain('Тридцать дней');
  });

  it('в секциях 7 и 8 есть договор, но нет гарантии срока деньгами', () => {
    const start = html.indexOf('id="process"');
    const end = html.indexOf('id="about"');
    const section = html.slice(start, end);
    expect(/договор/i.test(section)).toBe(true);
    expect(/вернём деньги|возврат средств|неустойк/i.test(section)).toBe(false);
  });
});
