import { describe, it, expect } from 'vitest';
import {
  PROOF_ITEMS, WEIGHT_PLACEHOLDER, MULTIPLIER_PLACEHOLDER,
} from './proof';

describe('proof.ts — внутренняя целостность', () => {
  it('минимум три доказательства, дословный порядок из 02-texts.md', () => {
    expect(PROOF_ITEMS.map((i) => i.lead)).toEqual([
      'Сколько это занимает',
      'Сколько весит эта страница',
      'Форма внизу — та самая',
    ]);
  });

  it('у каждого элемента хотя бы один абзац', () => {
    for (const item of PROOF_ITEMS) {
      expect(item.paragraphs.length, item.lead).toBeGreaterThan(0);
    }
  });

  /* Прежняя редакция требовала, чтобы заглушки `[вес]` и `[кратность]` СТОЯЛИ
     на месте: до задачи 15 подставлять числа было запрещено, потому что вес
     страницы менялся с каждой новой секцией, а кратность выведена из веса.
     Сторож сработал — раньше времени числа никто не вписал.

     2026-08-12 задача 15 подставила измеренные 365 КБ и «семь раз». Тест не
     удалён, а вывернут: теперь он требует обратного — чисел на месте и ни
     одной заглушки. Удалить его значило бы потерять проверку в тот самый
     момент, когда она впервые стала проверять готовый результат. */
  it('вес и кратность подставлены числами, заглушек не осталось', () => {
    const weightItem = PROOF_ITEMS.find((i) => i.lead === 'Сколько весит эта страница');
    expect(weightItem).toBeDefined();
    const text = weightItem!.paragraphs.join(' ');

    expect(text, 'заглушка веса осталась в тексте').not.toContain(WEIGHT_PLACEHOLDER);
    expect(text, 'заглушка кратности осталась').not.toContain(MULTIPLIER_PLACEHOLDER);
    expect(text, 'вес не назван числом с единицей').toMatch(/весит\s+\d+\s*КБ/);
    expect(text, 'кратность не названа словом').toMatch(/в\s+[а-яё]+\s+раз\s+больше/i);

    /* Совпадение названного веса с фактическим сверяет `npm run check:budget`:
       он это число уже меряет, и падает при расхождении больше 5%. Здесь
       проверяется только форма — что числа вообще подставлены. */
    for (const item of PROOF_ITEMS) {
      if (item === weightItem) continue;
      const other = item.paragraphs.join(' ');
      expect(other, item.lead).not.toContain(WEIGHT_PLACEHOLDER);
      expect(other, item.lead).not.toContain(MULTIPLIER_PLACEHOLDER);
    }
  });

  it('ссылка «Как это сделано» ведёт в кейс «этот сайт», а не пересказывает разбор здесь', () => {
    const weightItem = PROOF_ITEMS.find((i) => i.lead === 'Сколько весит эта страница');
    expect(weightItem?.linkHref).toBe('/cases/site-v3');
    expect(weightItem?.linkText).toBe('Как это сделано');
  });

  it('карточка сроков сравнивает календарь с календарём — часов в тексте нет', () => {
    const termsItem = PROOF_ITEMS.find((i) => i.lead === 'Сколько это занимает');
    const text = termsItem!.paragraphs.join(' ');
    expect(/\bчас/i.test(text)).toBe(false);
  });
});
