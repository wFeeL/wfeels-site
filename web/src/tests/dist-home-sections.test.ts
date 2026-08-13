import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PRICING } from '../data/pricing';
import { HERO_TERMS } from '../data/terms';
import { SERVICE_GROUPS, NICHES } from '../data/services';

/* Проверяет две вещи разом, требуемые планом (задачи 5–7, «Приёмка»):
 *
 *   1. текст секций 1–3 присутствует в `dist/index.html` без выполнения
 *      JavaScript — читает файл сборки напрямую, без браузера;
 *   2. числа таблицы первого экрана в разметке — ровно те, что лежат в
 *      `data/pricing.ts` и `data/terms.ts`, а не переписаны отдельно: тест
 *      вычисляет ожидаемую строку из данных и ищет её в HTML, а не хранит
 *      число во второй раз сам.
 *
 * Тот же паттерн `existsSync`-гейта, что в `lib/sections.test.ts`: без сборки
 * тест падает с понятной причиной, а не тихо пропускается. */
const DIST_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));

function priceFor(groupName: string, entryName: string): string {
  const entry = PRICING.find((g) => g.name === groupName)
    ?.entries.find((e) => e.name === entryName);
  if (!entry) throw new Error(`тест: нет «${entryName}» в группе «${groupName}» pricing.ts`);
  return entry.price;
}

describe('dist/index.html — секции 1–3', () => {
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

  it('секция 1: метка, заголовок, подзаголовок, кнопки — дословно на странице', () => {
    expect(html).toContain('КОГДА КОНСТРУКТОРА УЖЕ НЕ ХВАТАЕТ');
    expect(html).toContain('Сайты и автоматизация — дни вместо недель');
    expect(html).toContain('Проектирую и проверяю сам, а');
    expect(html).toContain('Обсудить задачу');
    expect(html).toContain('Смотреть цены');
  });

  it('секция 1: три строки таблицы — цена и срок совпадают с данными, не с текстом теста', () => {
    const rows: Array<[string, string, string]> = [
      ['Сайты и лендинги', HERO_TERMS[0].term, priceFor('Сайты', 'Лендинг из шаблона')],
      ['Автоматизация и интеграции', HERO_TERMS[1].term, priceFor('Автоматизация и интеграции', 'Одна интеграция')],
      ['ИИ-консультант', HERO_TERMS[2].term, priceFor('ИИ', 'Консультант на готовых материалах')],
    ];
    for (const [label, term, price] of rows) {
      expect(html, `строка «${label}»: срок`).toContain(term);
      expect(html, `строка «${label}»: цена`).toContain(`от ${price}`);
    }
  });

  it('секция 1: строка регалий — все пять пунктов на странице', () => {
    for (const item of [
      'Санкт-Петербург', 'работаю удалённо', 'отвечаю в течение дня',
      'пишу код сам, без подрядчиков', '3 года на Python',
    ]) {
      expect(html).toContain(item);
    }
  });

  it('секция 2: метка, заголовок и все пять пунктов боли', () => {
    expect(html).toContain('ЗНАКОМАЯ БОЛЬ');
    expect(html).toContain('Как обычно бывает');
    expect(html).toContain('Десятки откликов, и все одинаковые.');
    expect(html).toContain('Смета растёт по ходу.');
    expect(html).toContain('Пишет один, отвечает другой.');
    expect(html).toContain('Исполнитель пропадает.');
    expect(html).toContain('Готовое некому подхватить.');
  });

  it('секция 3: метка, заголовок, все четыре карточки и все ниши', () => {
    expect(html).toContain('Что я делаю');
    for (const group of SERVICE_GROUPS) {
      expect(html, group.title).toContain(group.title);
      expect(html, group.stack).toContain(group.stack);
      for (const link of group.links) expect(html, link.text).toContain(link.text);
    }
    for (const niche of NICHES) expect(html, niche.text).toContain(niche.text);
    expect(html).toContain('Все услуги');
  });

  it('секция 4: заголовок присутствует, заглушки «Секция 4 — Цены» больше нет', () => {
    expect(html).toContain('Цены');
    expect(html).not.toContain('Секция 4 — Цены');
  });

  it('секция 4: пять групп и все ступени — имя и цена дословно из data/pricing.ts', () => {
    for (const group of PRICING) {
      expect(html, `группа «${group.name}»`).toContain(group.name);
      for (const entry of group.entries) {
        expect(html, `«${entry.name}»: название ступени`).toContain(entry.name);
        expect(html, `«${entry.name}»: цена`).toContain(entry.price);
      }
    }
  });

  it('секция 4: часов рядом с ценой нет — заметка «К_риск» из данных на страницу не идёт', () => {
    expect(html).not.toContain('К_риск');
  });
});
