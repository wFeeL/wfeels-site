import { describe, it, expect } from 'vitest';
import { FACTORY, FACTORY_FRAME, FACTORY_CAPTIONS, FACTORY_TOTALS } from './factory';

/** Тест-сторож брифа `02-home-core.md` (вариант владельца А «Плита»), раздел
 *  3: «добавили тему — тест падает и заставляет осознанно обновить и данные,
 *  и текст». Ловит расхождение между тем, что нарисовано, и тем, что реально
 *  существует у фабрики. */
describe('factory.ts — тест-сторож чисел и подписей плиты', () => {
  it('ровно четыре типа', () => {
    expect(FACTORY.length).toBe(4);
  });

  it('сумма тем — 32', () => {
    expect(FACTORY_TOTALS.themes).toBe(32);
  });

  it('сумма демо — 11 (плита их не показывает, поле обслуживает спеку 04)', () => {
    expect(FACTORY_TOTALS.demos).toBe(11);
  });

  it('FACTORY_TOTALS.templates совпадает с длиной массива, а не задан отдельно', () => {
    expect(FACTORY_TOTALS.templates).toBe(FACTORY.length);
  });

  it('ровно шесть частей каркаса, порядок — дословно таблица брифа раздела 2', () => {
    expect(FACTORY_FRAME).toEqual([
      'вход из Telegram',
      'роли и доступ',
      'база',
      'уведомления',
      'панель владельца',
      'установка',
    ]);
  });

  it('у каждого типа непустые label и own', () => {
    for (const t of FACTORY) {
      expect(t.label.length, t.id).toBeGreaterThan(0);
      expect(t.own.length, t.id).toBeGreaterThan(0);
    }
  });

  it('подписи — русские, регистр как читается', () => {
    const labels = FACTORY.map((t) => t.label);
    expect(labels).toEqual(['Запись', 'Анкета', 'Магазин', 'Бронь']);
  });

  it('у reservation демо нет — честный ноль, не удалять строку', () => {
    const reservation = FACTORY.find((t) => t.id === 'reservation');
    expect(reservation).toBeDefined();
    expect(reservation?.demos).toBe(0);
    expect(reservation?.label).toBe('Бронь');
  });

  it('порядок — по themes убыв., при равенстве demos убыв.', () => {
    for (let i = 1; i < FACTORY.length; i++) {
      const prev = FACTORY[i - 1];
      const cur = FACTORY[i];
      const ok = prev.themes > cur.themes
        || (prev.themes === cur.themes && prev.demos >= cur.demos);
      expect(ok, `${prev.id} → ${cur.id} нарушает порядок`).toBe(true);
    }
  });

  // Форма слова «тем» верна для всех чисел (бриф, раздел 3). Русское
  // склонение: 11–14 всегда родительный множественного («тем») независимо от
  // последней цифры — это и есть исключение, которое ловит правило «% 10 не
  // 1 и не 2–4»: 12 оканчивается на 2, но говорит «тем», не «темы».
  it('форма слова «тем» верна для каждого числа тем', () => {
    expect(FACTORY_CAPTIONS.themes).toBe('тем');
    for (const t of FACTORY) {
      const lastDigit = t.themes % 10;
      const lastTwo = t.themes % 100;
      const needsOther = lastTwo < 11 || lastTwo > 14
        ? (lastDigit === 1 || (lastDigit >= 2 && lastDigit <= 4))
        : false;
      expect(
        !needsOther,
        `${t.id}: ${t.themes} тем — форма слова «тем» неверна для этого числа`,
      ).toBe(true);
    }
  });
});
