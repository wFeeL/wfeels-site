import { describe, it, expect } from 'vitest';
import { PRICING } from './pricing';
import { TOP_CARDS, SHELF_CARDS } from './pricingShowcase';

/* Явный маппинг «имя ступени → витринное имя» — падает, если ступень из
 * `data/pricing.ts` исчезла или переименовалась: модуль сам кидает ошибку
 * при импорте (`stage()`/`group()`/`serviceHref()`), поэтому сначала
 * проверяем, что импорт вообще прошёл (иначе весь файл теста красный с
 * понятной причиной), а дальше — что витрина смотрит на верные числа и
 * подписи.
 *
 * Правка владельца 2026-08-13 («Секция цен — десять правок владельца»,
 * часть 1): три верхние карточки стали направлениями («Лендинг» /
 * «Корпоративный сайт» / «Telegram-бот»), полка — шестью карточками. */

describe('pricingShowcase — три верхние карточки-направления', () => {
  it('три карточки, витринные имена — Лендинг / Корпоративный сайт / Telegram-бот', () => {
    expect(TOP_CARDS.map((c) => c.showcaseName)).toEqual([
      'Лендинг',
      'Корпоративный сайт',
      'Telegram-бот',
    ]);
  });

  it('цены карточек — 20 000 / 30 000 / 12 000 ₽, дословно из data/pricing.ts', () => {
    expect(TOP_CARDS.map((c) => c.price)).toEqual(['20 000 ₽', '30 000 ₽', '12 000 ₽']);
  });

  it('сроки карточек — от 5 / от 8 / от 3 дней (решение владельца 2026-08-13)', () => {
    expect(TOP_CARDS.map((c) => c.timeframe)).toEqual(['от 5 дней', 'от 8 дней', 'от 3 дней']);
  });

  it('ступень «Лендинг из шаблона» (10 000 ₽) и «Сайт до 10 страниц» (45 000 ₽) среди карточек нет', () => {
    for (const card of TOP_CARDS) {
      expect(card.price).not.toBe('10 000 ₽');
      expect(card.price).not.toBe('45 000 ₽');
    }
  });

  it('у каждой карточки ровно пять пунктов состава', () => {
    for (const card of TOP_CARDS) {
      expect(card.composition, `карточка «${card.showcaseName}»`).toHaveLength(5);
    }
  });

  it('«Корпоративный сайт»: первая строка состава — «Все из «Лендинга»»', () => {
    const corp = TOP_CARDS.find((c) => c.showcaseName === 'Корпоративный сайт')!;
    expect(corp.composition[0]).toBe('Все из «Лендинга»');
  });

  it('только «Корпоративный сайт» несёт ярлык рекомендации', () => {
    const recommended = TOP_CARDS.filter((c) => c.recommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].showcaseName).toBe('Корпоративный сайт');
  });

  it('у каждой карточки есть глагол для кнопки, не «Заказать»', () => {
    for (const card of TOP_CARDS) {
      expect(card.cta, `карточка «${card.showcaseName}»`).toBeTruthy();
      expect(card.cta.toLowerCase()).not.toBe('заказать');
    }
  });
});

describe('pricingShowcase — полка из шести карточек', () => {
  it('шесть карточек, дословный порядок и подписи по брифу владельца', () => {
    expect(SHELF_CARDS.map((c) => c.label)).toEqual([
      'Лендинг на готовом шаблоне',
      'Бот-приемщик заявок',
      'Автоматизация и интеграции',
      'ИИ-консультант',
      'Поддержка',
      'Аудит сайта',
    ]);
  });

  it('цены полки — дословно из data/pricing.ts', () => {
    const byLabel = Object.fromEntries(SHELF_CARDS.map((c) => [c.label, c.price]));
    expect(byLabel['Лендинг на готовом шаблоне']).toBe('10 000 ₽');
    expect(byLabel['Бот-приемщик заявок']).toBe('6 000 ₽');
    expect(byLabel['Автоматизация и интеграции']).toBe('5 000 ₽');
    expect(byLabel['ИИ-консультант']).toBe('12 000 ₽');
    expect(byLabel['Поддержка']).toBe('6 000 ₽/мес');
    expect(byLabel['Аудит сайта']).toBe('3 000 ₽');
  });

  it('у каждой карточки полки есть непустая ссылка на посадочную', () => {
    for (const card of SHELF_CARDS) {
      expect(card.href, `карточка «${card.label}»`).toMatch(/^\/services\//);
    }
  });

  it('часов рядом с ценой нет ни в одной карточке полки', () => {
    const hoursLike = /^\d+[–-]\d+$/;
    for (const card of SHELF_CARDS) {
      expect(hoursLike.test(card.price), `карточка «${card.label}»`).toBe(false);
    }
  });
});

describe('pricingShowcase — маппинг ступеней (сверка с PRICING.md)', () => {
  it('состав ступеней прайса, на которые ссылается витрина, всё ещё существует', () => {
    const sitesStages = PRICING.find((g) => g.name === 'Сайты')!.entries.map((e) => e.name);
    expect(sitesStages).toContain('Лендинг с индивидуальным дизайном');
    expect(sitesStages).toContain('Сайт до 5 страниц');
    const telegramStages = PRICING.find((g) => g.name === 'Telegram')!.entries.map((e) => e.name);
    expect(telegramStages).toContain('Бот под задачу');
  });
});
