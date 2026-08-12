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

  it('заглушки веса и кратности стоят вместе, только в карточке веса страницы', () => {
    const weightItem = PROOF_ITEMS.find((i) => i.lead === 'Сколько весит эта страница');
    expect(weightItem).toBeDefined();
    const text = weightItem!.paragraphs.join(' ');
    expect(text).toContain(WEIGHT_PLACEHOLDER);
    expect(text).toContain(MULTIPLIER_PLACEHOLDER);
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
