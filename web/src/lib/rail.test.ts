import { describe, it, expect } from 'vitest';
import { railPoints, sectionToRailLabel } from './rail';
import { HOME_SECTIONS } from './sections';

describe('railPoints — группировка HOME_SECTIONS в точки рельса', () => {
  it('ровно восемь точек', () => {
    expect(railPoints().length).toBe(8);
  });

  it('метки точек и их порядок — дословно по sections.ts (правка владельца 2026-08-13: «Процесс» и «Гарантии» расцеплены)', () => {
    expect(railPoints().map((p) => p.label)).toEqual([
      'НАЧАЛО', 'УСЛУГИ', 'ЦЕНЫ', 'КЕЙСЫ', 'ПРОЦЕСС', 'ГАРАНТИИ', 'ОБО МНЕ', 'КОНТАКТ',
    ]);
  });

  it('каждая точка несёт все секции своей группы, в порядке страницы', () => {
    const byLabel = new Map(railPoints().map((p) => [p.label, p.sectionIds]));
    expect(byLabel.get('НАЧАЛО')).toEqual(['hero', 'pain']);
    expect(byLabel.get('КЕЙСЫ')).toEqual(['cases', 'proof']);
    expect(byLabel.get('ПРОЦЕСС')).toEqual(['process']);
    expect(byLabel.get('ГАРАНТИИ')).toEqual(['guarantees']);
    expect(byLabel.get('ОБО МНЕ')).toEqual(['about', 'faq']);
    expect(byLabel.get('КОНТАКТ')).toEqual(['contact']);
  });

  it('targetId точки — секция с railFirst: true в её группе, а не первая по обходу', () => {
    for (const p of railPoints()) {
      const section = HOME_SECTIONS.find((s) => s.id === p.targetId);
      expect(section, `точка «${p.label}» указывает на несуществующий якорь ${p.targetId}`)
        .toBeDefined();
      expect(section!.railFirst, `${p.targetId} — не railFirst секция своей группы`)
        .toBe(true);
      expect(section!.railLabel).toBe(p.label);
    }
  });

  it('каждая из одиннадцати секций входит ровно в одну точку', () => {
    const all = railPoints().flatMap((p) => p.sectionIds);
    expect(all.length).toBe(11);
    expect(new Set(all).size).toBe(11);
  });
});

describe('sectionToRailLabel', () => {
  it('каждый из одиннадцати якорей отображается на ожидаемую метку', () => {
    const expected: Record<string, string> = {
      hero: 'НАЧАЛО', pain: 'НАЧАЛО',
      services: 'УСЛУГИ',
      pricing: 'ЦЕНЫ',
      cases: 'КЕЙСЫ', proof: 'КЕЙСЫ',
      process: 'ПРОЦЕСС', guarantees: 'ГАРАНТИИ',
      about: 'ОБО МНЕ', faq: 'ОБО МНЕ',
      contact: 'КОНТАКТ',
    };
    for (const [id, label] of Object.entries(expected)) {
      expect(sectionToRailLabel(id), `${id} → ожидалась точка «${label}»`).toBe(label);
    }
  });

  it('несуществующий якорь не относится ни к одной точке', () => {
    expect(sectionToRailLabel('does-not-exist')).toBeNull();
  });
});
