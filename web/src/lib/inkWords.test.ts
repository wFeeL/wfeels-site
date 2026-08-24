import { describe, expect, it } from 'vitest';
import { inkWordCount, inkWords } from './inkWords';

describe('lib/inkWords', () => {
  it('режет по обычному пробелу и сохраняет знаки препинания', () => {
    expect(inkWords('Каждое слово — из данных.')).toEqual([
      'Каждое', 'слово', '—', 'из', 'данных.',
    ]);
  });

  it('не разрывает неразрывные пробелы', () => {
    expect(inkWords('слово\u00A0и я\u202Fи он')).toEqual([
      'слово\u00A0и', 'я\u202Fи', 'он',
    ]);
  });

  it('не создаёт пустые обёртки из повторных пробелов', () => {
    expect(inkWords('раз   два')).toEqual(['раз', 'два']);
  });

  it('отклоняет цифры и пустой текст', () => {
    expect(() => inkWords('от 70 000 ₽')).toThrowError(/цифра/);
    expect(() => inkWords('   ')).toThrowError(/пустой текст/);
  });

  it('считает тем же разбором', () => {
    expect(inkWordCount('раз два три')).toBe(3);
  });
});
