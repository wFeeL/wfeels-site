import { describe, it, expect } from 'vitest';
import { CASES } from './cases';
import { FACTORY_TOTALS, FACTORY_CAPTIONS } from './factory';

/** Два места на странице называют числа фабрики СЛОВАМИ, а не рисуют их
 *  автоматически:
 *   - описание кейса «Фабрика ботов» (`data/cases.ts`): «Четыре типа,
 *     тридцать две темы»;
 *   - подпись пучка `FACTORY_CAPTIONS.moves` (`data/factory.ts`):
 *     «…переезжает целиком в каждый из четырёх».
 *
 *  Рисунок «Стеллаж» рядом берёт те же величины из `FACTORY_TOTALS`, то есть
 *  из данных. Связи между словами и числом нет и быть не может: слова —
 *  утверждённый владельцем текст, число — данные. Вырастет число тем —
 *  рисунок пересчитается сам, а предложение соврёт, и никто этого не
 *  заметит: слова не выглядят числами и мимо любого поиска по цифрам
 *  проходят молча.
 *
 *  До 2026-08-18 источником был `FACTORY_TEASER.text` (снят вместе с
 *  тизером-плитой, D-048) — сторож переехал на `bot-factory.description` и
 *  `FACTORY_CAPTIONS.moves`, сам приём не изменился.
 *
 *  Текст правится только владельцем. Если тест покраснел — значит поменялись
 *  ДАННЫЕ, и решение принимает владелец: либо текст переписывается под новое
 *  число, либо число неверно. Молча подгонять любую из сторон нельзя. */
const WORD_TO_NUMBER: Record<string, number> = {
  один: 1, два: 2, две: 2, три: 3, четыре: 4, четырех: 4, пять: 5, шесть: 6,
  семь: 7, восемь: 8, девять: 9, десять: 10, одиннадцать: 11,
  двенадцать: 12, тринадцать: 13, двадцать: 20, тридцать: 30,
};

/** «тридцать две» → 32. Составные числительные записаны через пробел. */
function wordsToNumber(phrase: string): number | null {
  // На сайте вместо «ё» пишется «е» (решение владельца 2026-08-19), но
  // словарь обязан разбирать обе записи: он читает и текст страницы, и
  // цитаты в тесте. Нормализация — единственное место, где это учтено.
  const parts = phrase.toLowerCase().replace(/ё/g, 'е').trim().split(/\s+/);
  let sum = 0;
  for (const part of parts) {
    const value = WORD_TO_NUMBER[part];
    if (value === undefined) return null;
    sum += value;
  }
  return sum > 0 ? sum : null;
}

describe('словарь числительных сам себе не врёт', () => {
  it('разбирает известные числа и отвергает неизвестные слова', () => {
    expect(wordsToNumber('тридцать две')).toBe(32);
    expect(wordsToNumber('одиннадцать')).toBe(11);
    expect(wordsToNumber('четыре')).toBe(4);
    expect(wordsToNumber('пёстрый')).toBeNull();
  });
});

describe('описание «Фабрики ботов» — слова не расходятся с числами рисунка', () => {
  const description = CASES.find((c) => c.slug === 'bot-factory')?.description ?? '';

  it('описание bot-factory найдено', () => {
    expect(description).not.toBe('');
  });

  it.each([
    ['тип', 'templates' as const],
    ['тем', 'themes' as const],
  ])('число перед «%s» совпадает с FACTORY_TOTALS', (noun, key) => {
    const match = description.match(
      new RegExp(`([А-Яа-яЁё]+(?:\\s+[А-Яа-яЁё]+)?)\\s+${noun}`, 'i'),
    );
    expect(match, `в описании не нашлось числительного перед «${noun}»`).not.toBeNull();

    const phrase = match![1];
    const words = phrase.split(/\s+/);
    const parsed = wordsToNumber(phrase)
      ?? words.map((w) => wordsToNumber(w)).find((n) => n !== null)
      ?? null;

    expect(parsed, `«${phrase}» не разобралось в число — словарь неполон, дополни его`)
      .not.toBeNull();
    expect(
      parsed,
      `описание говорит «${phrase} ${noun}», а данные — ${FACTORY_TOTALS[key]}. ` +
        'Расходятся текст и рисунок на одном экране: правит владелец, не реализация.',
    ).toBe(FACTORY_TOTALS[key]);
  });
});

describe('подпись пучка FACTORY_CAPTIONS.moves — числительное совпадает с FACTORY_TOTALS.templates', () => {
  it('«…в каждый из четырёх» — число совпадает с числом типов', () => {
    const match = FACTORY_CAPTIONS.moves.match(/в каждый из ([а-яё]+)/i);
    expect(match, 'в подписи не нашлось «в каждый из <число>»').not.toBeNull();

    const parsed = wordsToNumber(match![1]);
    expect(parsed, `«${match![1]}» не разобралось в число — словарь неполон, дополни его`)
      .not.toBeNull();
    expect(
      parsed,
      `подпись говорит «в каждый из ${match![1]}», а данные — ${FACTORY_TOTALS.templates}. ` +
        'Расходятся подпись и рисунок на одном экране: правит владелец, не реализация.',
    ).toBe(FACTORY_TOTALS.templates);
  });
});
