import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROCESS_STEPS, GUARANTEES, MILESTONE_THRESHOLD } from '../data/process';

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

  it('секция 8: метка, заголовок и все пять гарантий дословно на странице', () => {
    expect(html).toContain('ГАРАНТИИ');
    expect(html).toContain('>Что я гарантирую<');
    for (const g of GUARANTEES) {
      expect(html, g.title).toContain(g.title);
      expect(html, g.text).toContain(g.text);
      if (g.note) expect(html, g.note).toContain(g.note);
    }
    expect(html).toContain(MILESTONE_THRESHOLD);
  });

  it('пятая гарантия «Сколько это занимает» — перенос секции 6, числа сроков дословны', () => {
    expect(html).toContain('Сколько это занимает');
    expect(html).toContain('2–4 дня');
    expect(html).toContain('2–3 недели');
    expect(html).toContain('от одного до четырех месяцев');
    // Отменённая формулировка не должна вернуться молча.
    expect(html).not.toContain('4–6 недель');
  });

  it('формулировка оплаты в разметке несёт оговорку про 70 000 ₽', () => {
    const start = html.indexOf('id="guarantees"');
    const end = html.indexOf('id="about"');
    expect(start, 'секция id="guarantees" не найдена в dist/index.html').toBeGreaterThan(-1);
    expect(end, 'секция id="about" не найдена в dist/index.html').toBeGreaterThan(start);
    const section = html.slice(start, end);
    expect(section).toContain('50%');
    expect(section).toContain('70 000 ₽');
    expect(section).toContain('по вехам');
  });

  it('в секциях 7 и 8 нет упоминания договора и гарантии срока деньгами', () => {
    const start = html.indexOf('id="process"');
    const end = html.indexOf('id="about"');
    const section = html.slice(start, end);
    expect(/договор/i.test(section)).toBe(false);
    expect(/вернём деньги|возврат средств|неустойк/i.test(section)).toBe(false);
  });
});
