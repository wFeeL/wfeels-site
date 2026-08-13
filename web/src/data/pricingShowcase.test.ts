import { describe, it, expect } from 'vitest';
import { PRICING } from './pricing';
import { TOP_CARDS, SHELF_ROWS, SUPPORT_AUDIT_ROW } from './pricingShowcase';

/* Явный маппинг «имя ступени → витринное имя» (спека `02-redesign-options.md`,
 * «Принято владельцем», пункт 7): падает, если ступень из `data/pricing.ts`
 * исчезла или переименовалась — модуль сам кидает ошибку при импорте
 * (`stage()`/`group()`/`serviceHref()`), поэтому сначала проверяем, что
 * импорт вообще прошёл (иначе весь файл теста красный с понятной причиной),
 * а дальше — что витрина смотрит на верные числа и подписи. */

describe('pricingShowcase — три верхние карточки «Сайты»', () => {
  it('три карточки, витринные имена не совпадают с именами ступеней прайса', () => {
    expect(TOP_CARDS.map((c) => c.showcaseName)).toEqual([
      'Лендинг на готовом шаблоне',
      'Лендинг',
      'Корпоративный сайт',
    ]);
    const stageNames = PRICING.find((g) => g.name === 'Сайты')!.entries.map((e) => e.name);
    for (const card of TOP_CARDS) {
      expect(stageNames, `«${card.showcaseName}» не должно совпадать с именем ступени`)
        .not.toContain(card.showcaseName);
    }
  });

  it('цены карточек — 15 000 / 30 000 / 50 000 ₽, дословно из data/pricing.ts', () => {
    expect(TOP_CARDS.map((c) => c.price)).toEqual(['15 000 ₽', '30 000 ₽', '50 000 ₽']);
  });

  it('ступень 70 000 ₽ («Сайт до 10 страниц») среди карточек нет', () => {
    for (const card of TOP_CARDS) {
      expect(card.price).not.toBe('70 000 ₽');
    }
  });

  it('«Корпоративный сайт»: первая строка состава — «до пяти страниц»', () => {
    const corp = TOP_CARDS.find((c) => c.showcaseName === 'Корпоративный сайт')!;
    expect(corp.composition[0]).toBe('до пяти страниц');
  });

  it('«Лендинг»: первая строка состава — «Всё из «Лендинга»»', () => {
    const mid = TOP_CARDS.find((c) => c.showcaseName === 'Лендинг')!;
    expect(mid.composition[0]).toBe('Всё из «Лендинга»');
  });

  it('только средняя карточка несёт ярлык «Советую этот вариант»', () => {
    const recommended = TOP_CARDS.filter((c) => c.recommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].showcaseName).toBe('Лендинг');
    expect(recommended[0].recommended!.label).toBe('Советую этот вариант');
  });

  it('причина ярлыка взята из состава ступени «Лендинг с индивидуальным дизайном»', () => {
    const stage = PRICING.find((g) => g.name === 'Сайты')!.entries
      .find((e) => e.name === 'Лендинг с индивидуальным дизайном')!;
    const mid = TOP_CARDS.find((c) => c.showcaseName === 'Лендинг')!;
    expect(mid.recommended!.reason.toLowerCase().replace(/\.$/, ''))
      .toBe(stage.whatIncluded!.toLowerCase());
  });

  it('причина не содержит меток спроса — статистики продаж не существует (D-029)', () => {
    const demandWords = ['хит продаж', 'популярн', 'выбор клиентов', 'чаще всего заказывают', 'бестселлер', 'лидер продаж'];
    for (const card of TOP_CARDS) {
      if (!card.recommended) continue;
      for (const word of demandWords) {
        expect(card.recommended.reason.toLowerCase()).not.toContain(word);
      }
    }
  });
});

describe('pricingShowcase — полка остальных групп', () => {
  it('три строки — Автоматизация и интеграции / ИИ / Telegram, в этом порядке', () => {
    expect(SHELF_ROWS.map((r) => r.label)).toEqual([
      'Автоматизация и интеграции', 'ИИ', 'Telegram',
    ]);
  });

  it('цена каждой строки — самая дешёвая числовая ступень своей группы', () => {
    expect(SHELF_ROWS.find((r) => r.label === 'Автоматизация и интеграции')!.price).toBe('7 500 ₽');
    expect(SHELF_ROWS.find((r) => r.label === 'ИИ')!.price).toBe('18 000 ₽');
    expect(SHELF_ROWS.find((r) => r.label === 'Telegram')!.price).toBe('9 000 ₽');
  });

  it('у каждой строки есть непустая ссылка на посадочную', () => {
    for (const row of SHELF_ROWS) {
      expect(row.href, `строка «${row.label}»`).toMatch(/^\/services\//);
    }
  });

  it('строка «поддержка и аудит» — две записи с непустыми ценами и ссылками', () => {
    expect(SUPPORT_AUDIT_ROW).toHaveLength(2);
    expect(SUPPORT_AUDIT_ROW.map((r) => r.label)).toEqual(['Поддержка', 'Аудит']);
    expect(SUPPORT_AUDIT_ROW.find((r) => r.label === 'Поддержка')!.price).toBe('10 000 ₽/мес');
    expect(SUPPORT_AUDIT_ROW.find((r) => r.label === 'Аудит')!.price).toBe('4 000 ₽');
    for (const row of SUPPORT_AUDIT_ROW) {
      expect(row.href, `строка «${row.label}»`).toMatch(/^\/services\//);
    }
  });

  it('часов рядом с ценой нет ни в одной строке', () => {
    const hoursLike = /^\d+[–-]\d+$/;
    for (const row of [...SHELF_ROWS, ...SUPPORT_AUDIT_ROW]) {
      expect(hoursLike.test(row.price), `строка «${row.label}»`).toBe(false);
    }
  });
});
