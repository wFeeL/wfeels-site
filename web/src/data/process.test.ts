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
      'Смета, договор и ТЗ',
      'Работа с показом по ходу',
      'Сдача и приемка',
      'Тридцать дней после приемки',
    ]);
  });

  it('шаг 5 короче остальных — полная гарантия живёт в секции 8', () => {
    const step5 = PROCESS_STEPS[4].text;
    const others = PROCESS_STEPS.slice(0, 4).map((s) => s.text.length);
    expect(step5.length).toBeLessThan(Math.min(...others));
  });

  it('работа начинается только после договора, платежа и материалов', () => {
    const step = PROCESS_STEPS[1].text;
    expect(step).toContain('после подписания договора');
    expect(step).toContain('первого платежа');
    expect(step).toContain('материалов');
  });

  it('разбор не называется «бесплатным аудитом»', () => {
    const step1 = PROCESS_STEPS[0].text;
    expect(/аудит/i.test(step1)).toBe(false);
  });

  it('ровно четыре гарантии, в порядке спеки', () => {
    expect(GUARANTEES.map((g) => g.title)).toEqual([
      'Цена, сроки и объем — в договоре',
      'Состав передачи — в ТЗ',
      'Обычный стек, без привязки ко мне',
      'Тридцать дней на исправления',
    ]);
  });

  /* Сторож снятия, а не памятник. Гарантия «Сколько это занимает» (перенос
     из снятой секции 6, D-030) снята правкой владельца 2026-08-20 вместе с
     доводом про студии. Вернуть её молча — через данные, мимо решения —
     нельзя: проверяется и заголовок, и текст обоих абзацев. */
  it('гарантия «Сколько это занимает» снята целиком (правка владельца 2026-08-20)', () => {
    expect(GUARANTEES.map((g) => g.title)).not.toContain('Сколько это занимает');
    const all = GUARANTEES.map((g) => `${g.title} ${g.text}`).join(' ');
    expect(all).not.toContain('2–3 недели');
    expect(all).not.toContain('от одного до четырех месяцев');
    expect(all).not.toContain('беру мало проектов');
  });

  it('первая гарантия фиксирует существенные условия и письменные изменения', () => {
    const terms = GUARANTEES[0].text;
    expect(terms).toContain('в договоре и ТЗ');
    expect(terms).toContain('критерии приемки');
    expect(terms).toContain('письменного согласования');
  });

  it('доля предоплаты — 50, ступень вех — «70 000 ₽», гарантия — 30 дней', () => {
    expect(DOWN_PAYMENT_PERCENT).toBe(50);
    expect(MILESTONE_THRESHOLD).toBe('70 000 ₽');
    expect(WARRANTY_DAYS).toBe(30);
  });

  it('договор и ТЗ упомянуты, но гарантии срока деньгами нет', () => {
    const text = GUARANTEES.map((g) => g.text).join(' ');
    expect(/договор/i.test(text)).toBe(true);
    expect(/ТЗ/.test(text)).toBe(true);
    expect(/вернём деньги|возврат средств|неустойк/i.test(text)).toBe(false);
  });

  it('формулировка про 30 дней показывает границу: расхождения по ТЗ, а не новые функции', () => {
    const warranty = GUARANTEES[3].text;
    expect(warranty).toMatch(/согласованным ТЗ/);
    expect(warranty).toMatch(/[Нн]овые функции/);
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

  /* Проверка сужена до двух записей, которые несут ИМЕННО гарантийный срок,
   * и сужение остаётся осмысленным после снятия гарантии «Сколько это
   * занимает» (2026-08-20): цифрами сроки РАБОТ на странице по-прежнему
   * называет таблица первого экрана (`data/terms.ts`) — это другой факт и
   * другой источник, и общий поиск по всем текстам ловил бы его как
   * нарушение. Ослаблять сторож нельзя: гарантийный срок обязан звучать
   * словом, иначе связь с `WARRANTY_DAYS` обрывается молча. */
  it('цифрой гарантийный срок не назван — иначе словесная связь с WARRANTY_DAYS обрывается', () => {
    const text = [
      `${PROCESS_STEPS[4].title} ${PROCESS_STEPS[4].text}`,
      `${GUARANTEES[3].title} ${GUARANTEES[3].text}`,
    ].join(' ');
    expect(/\d+\s*(дн[еяию]|день)/i.test(text)).toBe(false);
  });
});
