import { describe, it, expect } from 'vitest';
import {
  PROCESS_STEPS, GUARANTEES, DOWN_PAYMENT_PERCENT, MILESTONE_THRESHOLD,
  WARRANTY_DAYS, PAYMENT_SOURCE, WARRANTY_SOURCE, CHECKED_AT,
} from './process';

/* `process.ts` — ручной файл, тот же паттерн, что `terms.ts`: этот тест не
 * читает PRICING.md/SERVICES.md (сайт отдельный репозиторий), а проверяет
 * внутреннюю целостность и то, что план требует от секций 7 и 8. */

describe('process.ts — внутренняя целостность', () => {
  it('дата сверки задана и в формате YYYY-MM-DD', () => {
    expect(CHECKED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('источники оплаты и гарантии указаны', () => {
    expect(PAYMENT_SOURCE).toMatch(/^PRICING\.md:\d+/);
    expect(WARRANTY_SOURCE).toMatch(/^SERVICES\.md:\d+/);
  });

  it('ровно пять шагов, в порядке спеки 02-texts.md, без номера в строке заголовка (02-process-options.md, П2-Б)', () => {
    expect(PROCESS_STEPS.map((s) => s.title)).toEqual([
      'Разбор задачи',
      'Смета и план',
      'Работа с показом по ходу',
      'Сдача и передача',
      'Тридцать дней после сдачи',
    ]);
  });

  it('шаг 5 короче остальных — полная гарантия живёт в секции 8', () => {
    const step5 = PROCESS_STEPS[4].text;
    const others = PROCESS_STEPS.slice(0, 4).map((s) => s.text.length);
    expect(step5.length).toBeLessThan(Math.min(...others));
  });

  it('про предоплату в шагах секции 7 ни слова — условия оплаты живут в секции 8', () => {
    const text = PROCESS_STEPS.map((s) => s.text).join(' ');
    expect(/предоплат|аванс/i.test(text)).toBe(false);
  });

  it('разбор не называется «бесплатным аудитом»', () => {
    const step1 = PROCESS_STEPS[0].text;
    expect(/аудит/i.test(step1)).toBe(false);
  });

  it('ровно пять гарантий, в порядке спеки плюс перенесённая пятая', () => {
    expect(GUARANTEES.map((g) => g.title)).toEqual([
      'Оплата половинами',
      'Исходники и инструкция — ваши',
      'Обычный стек, без привязки ко мне',
      'Тридцать дней на недочеты',
      'Сколько это занимает',
    ]);
  });

  it('пятая гарантия несёт оба абзаца снятой секции 6, дословно', () => {
    const timing = GUARANTEES[4];
    expect(timing.text).toContain('2–4 дня');
    expect(timing.text).toContain('2–3 недели');
    expect(timing.note).toContain('от одного до четырех месяцев');
    expect(timing.note).toContain('беру мало проектов');
  });

  it('формулировка оплаты содержит оговорку про 70 000 ₽ — «по вехам» без неё шире условия', () => {
    const payment = GUARANTEES[0].text;
    expect(payment).toContain(MILESTONE_THRESHOLD);
    expect(payment).toContain('по вехам');
  });

  it('доля предоплаты — 50, ступень вех — «70 000 ₽», гарантия — 30 дней', () => {
    expect(DOWN_PAYMENT_PERCENT).toBe(50);
    expect(MILESTONE_THRESHOLD).toBe('70 000 ₽');
    expect(WARRANTY_DAYS).toBe(30);
  });

  it('гарантии срока деньгами нет и договор не упоминается (D-019)', () => {
    const text = GUARANTEES.map((g) => g.text).join(' ');
    expect(/договор/i.test(text)).toBe(false);
    expect(/вернём деньги|возврат средств|неустойк/i.test(text)).toBe(false);
  });

  it('формулировка про 30 дней показывает границу: недочёты по ТЗ, а не новые пожелания', () => {
    const warranty = GUARANTEES[3].text;
    expect(warranty).toMatch(/согласованным ТЗ/);
    expect(warranty).toMatch(/[Нн]овые пожелания/);
  });

  it('ни одна запись не задвоена', () => {
    const stepTitles = PROCESS_STEPS.map((s) => s.title);
    const guaranteeTitles = GUARANTEES.map((g) => g.title);
    expect(new Set(stepTitles).size).toBe(stepTitles.length);
    expect(new Set(guaranteeTitles).size).toBe(guaranteeTitles.length);
  });
});

/* Сторож связи «число ↔ слово», заведён 2026-08-20.
 *
 * До этой даты `WARRANTY_DAYS` держала цифру на странице — итоговую полосу
 * «30 дней» в секции 7. Полосу сняла правка владельца («убираем надпись
 * "30 дней"»), и цифры на странице не осталось: срок звучит только словом —
 * в шаге 5 секции 7 и в гарантии секции 8. Константа при этом остаётся
 * единственной машинной привязкой срока к источнику `SERVICES.md:151`, и
 * удалять её означало бы оборвать привязку.
 *
 * Поэтому она работает здесь: смена срока в SERVICES.md → смена
 * `WARRANTY_DAYS` → этот набор краснеет до тех пор, пока словесная форма в
 * текстах не приведена в соответствие. Текст владельца сторож не правит и
 * не переписывает — только не даёт числу и слову разойтись молча. */
const DAYS_IN_WORDS: Readonly<Record<number, string>> = {
  7: 'семь',
  10: 'десять',
  14: 'четырнадцать',
  15: 'пятнадцать',
  20: 'двадцать',
  30: 'тридцать',
  45: 'сорок пять',
  60: 'шестьдесят',
  90: 'девяносто',
};

describe('гарантийный срок: WARRANTY_DAYS и словесная форма в текстах', () => {
  const word = DAYS_IN_WORDS[WARRANTY_DAYS];

  it('для WARRANTY_DAYS известна словесная форма', () => {
    expect(
      word,
      `нет словесной формы для ${WARRANTY_DAYS} дней: добавь её в DAYS_IN_WORDS ` +
      'и приведи к ней тексты секций 7 и 8',
    ).toBeTypeOf('string');
  });

  it('гарантия секции 8 называет тот же срок словом', () => {
    const warranty = GUARANTEES[3];
    const text = `${warranty.title} ${warranty.text}`.toLowerCase();
    expect(
      text,
      `гарантия «${warranty.title}» обязана называть ${WARRANTY_DAYS} дней словом «${word}»`,
    ).toContain(String(word));
  });

  it('шаг 5 секции 7 называет тот же срок словом', () => {
    const step = PROCESS_STEPS[4];
    const text = `${step.title} ${step.text}`.toLowerCase();
    expect(
      text,
      `шаг «${step.title}» обязан называть ${WARRANTY_DAYS} дней словом «${word}»`,
    ).toContain(String(word));
  });

  /* Проверка сужена до двух записей, которые несут ИМЕННО гарантийный срок:
   * пятая гарантия «Сколько это занимает» законно называет цифрами сроки
   * работ («2–4 дня», «2–3 недели») — это другой факт и другой источник. */
  it('цифрой гарантийный срок не назван — иначе словесная связь с WARRANTY_DAYS обрывается', () => {
    const text = [
      `${PROCESS_STEPS[4].title} ${PROCESS_STEPS[4].text}`,
      `${GUARANTEES[3].title} ${GUARANTEES[3].text}`,
    ].join(' ');
    expect(/\d+\s*(дн[еяию]|день)/i.test(text)).toBe(false);
  });
});
