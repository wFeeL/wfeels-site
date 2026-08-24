import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PRICING } from '../data/pricing';
import { HERO_TERMS } from '../data/terms';
import { SERVICE_GROUPS } from '../data/services';
import { TOP_CARDS, SHELF_CARDS } from '../data/pricingShowcase';

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
      'Санкт-Петербург', 'работаю удаленно', 'отвечаю в течение дня',
      'пишу код сам, без подрядчиков', '3 года на Python',
    ]) {
      expect(html).toContain(item);
    }
  });

  it('секция 2: метка, заголовок, все четыре строки боли и карточка-ответ', () => {
    expect(html).toContain('ЗНАКОМАЯ БОЛЬ');
    expect(html).toContain('Как обычно бывает');
    expect(html).toContain('Смета растет по ходу, и узнаете вы об этом к сдаче');
    expect(html).toContain('Пишете вы одному, отвечает другой');
    expect(html).toContain('Исполнитель пропадает, а доступов у вас нет');
    expect(html).toContain('Готовое некому подхватить — проще переписать заново');
    // Метка карточки называет её роль («РЕШЕНИЕ»), а не повторяет заголовок:
    // тест сторожит именно это, потому что первая редакция ставила «СО МНОЙ
    // ИНАЧЕ» прямо над «Со мной иначе».
    expect(html).toContain('РЕШЕНИЕ');
    expect(html).toContain('Со мной иначе');
    expect(html).not.toContain('СО МНОЙ ИНАЧЕ');
    expect(html).toContain('До начала работы подписываем договор и ТЗ');
    expect(html).toContain('Новый объем, цену и срок согласуем письменно');
    // Подпись ссылки и её адрес — одна пара (правка владельца 2026-08-19):
    // «↓ Гарантии» обязана вести на `#guarantees`. Прежняя редакция обещала
    // «процесс и гарантии» и вела на `#process`; сторож держит именно
    // соответствие слова адресу, иначе ссылка тихо разойдётся с обещанием.
    expect(html).toContain('Гарантии');
    expect(html).not.toContain('Чем это подтверждается — процесс и гарантии ниже');
    expect(html).toContain('class="answer-link" href="#guarantees"');
  });

  it('секция 3: метка, заголовок и все четыре карточки', () => {
    expect(html).toContain('Что я делаю');
    for (const group of SERVICE_GROUPS) {
      expect(html, group.title).toContain(group.title);
      expect(html, group.stack).toContain(group.stack);
      for (const link of group.links) expect(html, link.text).toContain(link.text);
    }
    expect(html).toContain('Все услуги');
  });

  // Правка владельца 2026-08-21: строка ниш («Под вашу отрасль: …») снята —
  // ссылки вели на несуществующие нишевые страницы, и в ближайшее время их
  // не будет. Обратная проверка, чтобы снятие нельзя было молча откатить.
  it('секция 3: строки ниш «Под вашу отрасль» на странице нет', () => {
    expect(html).not.toContain('Под вашу отрасль');
  });

  it('секция 4: заголовок присутствует, заглушки «Секция 4 — Цены» больше нет', () => {
    expect(html).toContain('Цены');
    expect(html).not.toContain('Секция 4 — Цены');
  });

  it('секция 4: три верхние карточки «Сайты» — витринное имя и цена дословно из pricingShowcase', () => {
    for (const card of TOP_CARDS) {
      expect(html, `карточка «${card.showcaseName}»: имя`).toContain(card.showcaseName);
      expect(html, `карточка «${card.showcaseName}»: цена`).toContain(card.price);
    }
  });

  it('секция 4: новые условия сметы, договора и оплаты показаны дословно', () => {
    expect(html).toContain(
      'Цены указаны «от». После короткого обсуждения пришлю смету со сроками и зафиксирую ее в договоре. Оплата обычно 50% после согласования сметы и 50% перед запуском.',
    );
    expect(html).toContain(
      'Работаю по договору как самозанятый, чек через «Мой налог». Указанные цены ориентировочные и не являются публичной офертой (ст. 437 ГК РФ).',
    );
    expect(html).not.toContain('«От» — потому что цена зависит от объема');
    expect(html).not.toContain('Правки входят в цену');
  });

  it('секция 4: ступень 70 000 ₽ («Сайт до 10 страниц») не показана как карточка/цена в разметке', () => {
    // Порог 70 000 ₽ больше не вынесен в прозу: после обсуждения
    // конкретный график фиксируется в смете и договоре. Сама цена «Сайта до
    // 10 страниц» по-прежнему не должна вернуться карточкой.
    const start = html.indexOf('id="pricing"');
    const end = html.indexOf('id="cases"');
    expect(start, 'секция «pricing» не найдена в dist/index.html').toBeGreaterThan(-1);
    expect(end, 'секция «cases» не найдена в dist/index.html').toBeGreaterThan(start);
    const pricingSectionHtml = html.slice(start, end);
    const occurrences = pricingSectionHtml.split('70 000 ₽').length - 1;
    expect(occurrences, 'ступень 70 000 ₽ не должна повторяться карточкой внутри секции цен').toBe(0);
  });

  it('секция 4: ярлык «Самый популярный» стоит ровно один раз', () => {
    const occurrences = html.split('Самый популярный').length - 1;
    expect(occurrences).toBe(1);
  });

  it('секция 4: полка — шесть карточек', () => {
    for (const card of SHELF_CARDS) {
      expect(html, `карточка «${card.label}»: подпись`).toContain(card.label);
      expect(html, `карточка «${card.label}»: цена`).toContain(card.price);
    }
  });

  it('секция 4: часов рядом с ценой нет — заметка «К_риск» из данных на страницу не идёт', () => {
    expect(html).not.toContain('К_риск');
  });

  it('секция 4: ни одной метки спроса в готовой сборке, кроме разрешённой «Самый популярный» (отмена D-029 владельцем 2026-08-13, часть 2 — сужена до этой строки, не снята)', () => {
    // Слова ниже намеренно не содержат основу «популярн» отдельно: она
    // входит в разрешённую строку «Самый популярный», и её собственный
    // сторож — narrow-тест в `Pricing.markup.test.ts` — уже проверяет, что
    // «популярн» не встречается НИГДЕ, кроме этой ровно одной строки.
    for (const word of ['хит продаж', 'популярное', 'выбор клиентов', 'чаще всего заказывают']) {
      expect(html.toLowerCase(), `метка спроса «${word}»`).not.toContain(word);
    }
  });
});
