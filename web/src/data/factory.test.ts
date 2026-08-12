import { describe, it, expect } from 'vitest';
import { FACTORY, FACTORY_TOTALS } from './factory';

/** Тест-сторож брифа `02-home-core.md`, раздел 3: «добавили тему — тест падает
 *  и заставляет осознанно обновить и данные, и текст». Ловит расхождение
 *  между тем, что нарисовано, и тем, что реально существует у фабрики. */
describe('factory.ts — тест-сторож чисел ядра', () => {
  it('ровно четыре шаблона', () => {
    expect(FACTORY.length).toBe(4);
  });

  it('сумма тем — 32', () => {
    expect(FACTORY_TOTALS.themes).toBe(32);
  });

  it('сумма демо — 11', () => {
    expect(FACTORY_TOTALS.demos).toBe(11);
  });

  it('FACTORY_TOTALS.templates совпадает с длиной массива, а не задан отдельно', () => {
    expect(FACTORY_TOTALS.templates).toBe(FACTORY.length);
  });

  it('у reservation демо нет — честный ноль, не удалять строку', () => {
    const reservation = FACTORY.find((t) => t.id === 'reservation');
    expect(reservation).toBeDefined();
    expect(reservation?.demos).toBe(0);
    expect(reservation?.label).toBe('БРОНЬ');
  });

  it('подписи — русские, не латиница', () => {
    const labels = FACTORY.map((t) => t.label);
    expect(labels).toEqual(['ЗАПИСЬ', 'АНКЕТА', 'МАГАЗИН', 'БРОНЬ']);
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
});
