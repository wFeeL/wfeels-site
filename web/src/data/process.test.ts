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

  it('ровно пять шагов, в порядке спеки 02-texts.md', () => {
    expect(PROCESS_STEPS.map((s) => s.title)).toEqual([
      '1. Разбор задачи',
      '2. Смета и план',
      '3. Работа с показом по ходу',
      '4. Сдача и передача',
      '5. Тридцать дней после сдачи',
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

  it('ровно четыре гарантии, в порядке спеки', () => {
    expect(GUARANTEES.map((g) => g.title)).toEqual([
      'Оплата половинами',
      'Исходники и инструкция — ваши',
      'Обычный стек, без привязки ко мне',
      'Тридцать дней на недочёты',
    ]);
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
