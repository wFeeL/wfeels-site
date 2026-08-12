import { describe, it, expect } from 'vitest';
import { HERO_TERMS, CHECKED_AT } from './terms';

/* `terms.ts` — ручной файл (см. шапку самого файла), в отличие от
 * `pricing.ts`. Этот тест не читает SERVICES.md — сайт отдельный репозиторий,
 * а проверяет внутреннюю целостность: у каждой записи есть `source`, порядок
 * и состав совпадают с таблицей первого экрана (спека 02-texts.md, секция 1). */

describe('terms.ts — внутренняя целостность', () => {
  it('дата сверки задана и в формате YYYY-MM-DD', () => {
    expect(CHECKED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('ровно три строки, в порядке таблицы первого экрана', () => {
    expect(HERO_TERMS.map((t) => t.label)).toEqual([
      'Сайты и лендинги',
      'Автоматизация и интеграции',
      'ИИ-консультант',
    ]);
  });

  it('у каждой записи есть source — ссылка на SERVICES.md', () => {
    for (const entry of HERO_TERMS) {
      expect(entry.source, `«${entry.label}» без source`).toMatch(/^SERVICES\.md:\d+/);
    }
  });

  it('срок набран в форме «от N–N дней», а не голым диапазоном', () => {
    for (const entry of HERO_TERMS) {
      expect(entry.term, `«${entry.label}»: «${entry.term}»`).toMatch(/^от \d+–\d+ дней$/);
    }
  });

  it('ни одна строка не задвоена', () => {
    const labels = HERO_TERMS.map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
