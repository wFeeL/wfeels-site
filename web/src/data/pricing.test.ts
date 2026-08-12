import { describe, it, expect } from 'vitest';
import { PRICING, USD_REFERENCE_RATE, CHECKED_AT } from './pricing';

/* `pricing.ts` — сгенерированный файл (`70-workshop/tools/generate_pricing.py`
 * из `10-offer/PRICING.md`, задача 8 плана `70-workshop/plans/site-v3/
 * 02-home-plan.md`). Этот тест `PRICING.md` НЕ читает и с базой знаний не
 * связан: сайт — отдельный репозиторий, и тест, лезущий за его границу,
 * сломается у любого, кто склонирует сайт один (без базы знаний рядом).
 * Вместо сверки с источником — проверка внутренней целостности сгенерированного
 * файла: у каждой записи есть source, ни одна не осталась без цены, ни одна
 * ступень не задвоена. Сверку с самим PRICING.md делает генератор и его
 * собственные тесты в базе (`70-workshop/tools/test_generate_pricing.py`). */

describe('pricing.ts — внутренняя целостность сгенерированного файла', () => {
  it('дата сверки задана и в формате YYYY-MM-DD', () => {
    expect(CHECKED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('курс ₽/$ живёт в одном месте — USD_REFERENCE_RATE — и задан', () => {
    expect(USD_REFERENCE_RATE.rubPerUsd).toBeGreaterThan(0);
    expect(typeof USD_REFERENCE_RATE.source).toBe('string');
    expect(USD_REFERENCE_RATE.source.length).toBeGreaterThan(0);
  });

  // Пять групп секции 4 «Цены»: четыре группы секции 3 главной плюс
  // «Поддержка» — она нужна только ценам, в перечне услуг секции 3 её нет.
  it('пять групп в порядке, зафиксированном спекой 02-home раздел 7', () => {
    expect(PRICING.map((g) => g.name)).toEqual([
      'Сайты',
      'Автоматизация и интеграции',
      'ИИ',
      'Telegram',
      'Поддержка',
    ]);
  });

  it('в каждой группе есть хотя бы одна запись', () => {
    for (const group of PRICING) {
      expect(group.entries.length, `группа «${group.name}» пуста`).toBeGreaterThan(0);
    }
  });

  it('у каждой записи есть source — раздел и строка PRICING.md, откуда она взята', () => {
    for (const group of PRICING) {
      for (const entry of group.entries) {
        expect(entry.source, `«${entry.name}» без source`).toBeTruthy();
        expect(entry.source, `«${entry.name}»: source не похож на ссылку на PRICING.md`)
          .toMatch(/^PRICING\.md:\d+/);
      }
    }
  });

  it('ни одна запись не осталась без цены', () => {
    for (const group of PRICING) {
      for (const entry of group.entries) {
        expect(entry.price.trim().length, `«${entry.name}» без цены`).toBeGreaterThan(0);
      }
    }
  });

  it('ни одна ступень не задвоена — ни внутри группы, ни между группами', () => {
    const keys = PRICING.flatMap((group) => group.entries.map((entry) => `${group.name}::${entry.name}`));
    expect(new Set(keys).size, 'повтор одной и той же ступени').toBe(keys.length);
  });

  it('часов рядом с ценой нет — «Что НЕ попадает в результат», задача 8', () => {
    // Диапазоны часов из PRICING.md имеют вид "10–12" — короткое тире между
    // двумя числами без ₽ и без слов. Цена — либо число с ₽, либо словесная
    // формулировка («считать индивидуально», «по ставке, без абонплаты»).
    const hoursLike = /^\d+[–-]\d+$/;
    for (const group of PRICING) {
      for (const entry of group.entries) {
        expect(hoursLike.test(entry.price), `«${entry.name}»: похоже на часы, не на цену`)
          .toBe(false);
      }
    }
  });

  it('priceUsdReference — целое положительное число либо null, не отрицательное и не ноль', () => {
    for (const group of PRICING) {
      for (const entry of group.entries) {
        if (entry.priceUsdReference !== null) {
          expect(Number.isInteger(entry.priceUsdReference)).toBe(true);
          expect(entry.priceUsdReference).toBeGreaterThan(0);
        }
      }
    }
  });

  it('строка про границу «больше 10 страниц» присутствует в группе «Сайты»', () => {
    const sites = PRICING.find((g) => g.name === 'Сайты');
    expect(sites).toBeTruthy();
    const boundary = sites!.entries.find((e) => e.name === 'Больше 10 страниц');
    expect(boundary, 'границы «больше 10 страниц» нет среди ступеней «Сайты»').toBeTruthy();
    expect(boundary!.priceUsdReference).toBeNull();
  });
});
