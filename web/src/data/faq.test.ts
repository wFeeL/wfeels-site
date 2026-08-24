import { describe, it, expect } from 'vitest';
import { FAQ_ITEMS } from './faq';
import { PRICING } from './pricing';

describe('faq.ts — внутренняя целостность', () => {
  it('ровно пять вопросов, в порядке спеки 02-texts.md', () => {
    expect(FAQ_ITEMS.map((q) => q.question)).toEqual([
      'Мне хватит конструктора вроде Tilda?',
      'Вы пишете код с ИИ — не пострадает ли качество?',
      'Что нужно от меня, чтобы начать?',
      'Сколько будет стоить содержание потом?',
      'Как подпишем договор, если работаем удаленно?',
    ]);
  });

  it('секция не повторяет секции 7 и 8 — «пропадёте», «подхватит», «сколько правок» здесь нет', () => {
    const all = FAQ_ITEMS.map((q) => q.answer).join(' ');
    expect(/пропадёте|пропадёшь/i.test(all)).toBe(false);
    expect(/подхватит/i.test(all)).toBe(false);
    expect(/раунд.*правок|правок включ/i.test(all)).toBe(false);
  });

  it('возврат денег не обещан', () => {
    const all = FAQ_ITEMS.map((q) => q.answer).join(' ');
    expect(/возврат|вернём деньги/i.test(all)).toBe(false);
  });

  /* Прежняя редакция проверяла стоимость хостинга выражением
     `/хостинг.*\d+\s*₽/` по СКЛЕЕННЫМ ответам — и падала на верном тексте:
     `.` находило слово «хостинг», а `\d+ ₽` подхватывало законную цену пакета
     поддержки, стоящую следующим предложением. Тест ловил не то, что называл.

     Проверка переписана по смыслу, а не ослаблена: в ответах не должно быть
     НИ ОДНОГО рублёвого числа, кроме тех, что пришли из `pricing.ts`. Это
     строже прежнего — ловит любую выдуманную цену в любом ответе, а не только
     рядом со словом «хостинг», — и при этом не считает ошибкой цену из
     источника. Стоимость хостинга в базе не записана, поэтому назвать её
     числом такой тест по-прежнему не даст. */
  it('в ответах нет ни одного рублёвого числа мимо pricing.ts', () => {
    const fromPricing = new Set(
      PRICING.flatMap((g) => g.entries).map((e) => e.price),
    );
    const found = FAQ_ITEMS.flatMap(
      (q) => q.answer.match(/[\d\s ]+₽(?:\/мес|\/ч)?/g) ?? [],
    ).map((s) => s.trim());

    expect(found.length, 'в ответах вообще нет цен — проверка обессмыслилась')
      .toBeGreaterThan(0);
    for (const price of found) {
      expect(
        [...fromPricing].some((p) => p.includes(price) || price.includes(p)),
        `цена «${price}» не найдена в pricing.ts — либо выдумана, либо разошлась с прайсом`,
      ).toBe(true);
    }
  });

  it('цена пакета поддержки читается из pricing.ts, а не переписана числом', () => {
    const supportPrice = PRICING
      .find((g) => g.name === 'Поддержка')
      ?.entries.find((e) => e.name === 'Пакет поддержки')?.price;
    expect(supportPrice).toBeDefined();
    const supportAnswer = FAQ_ITEMS.find((q) => q.question.startsWith('Сколько будет стоить'));
    expect(supportAnswer?.answer).toContain(supportPrice!);
  });

  it('первый ответ повторяет формулировку из PRICING.md — «не может нужного вообще»', () => {
    expect(FAQ_ITEMS[0].answer).toContain('**вообще**');
  });
});
