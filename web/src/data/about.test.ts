import { describe, it, expect } from 'vitest';
import {
  ABOUT_PHOTO, ABOUT_LEAD, ABOUT_BLOCKS, ABOUT_CLOSING, ABOUT_CLIENT_LABEL,
} from './about';

describe('about.ts — внутренняя целостность', () => {
  it('фото задано с шириной, высотой и alt', () => {
    expect(ABOUT_PHOTO.src).toBe('/wfeels-photo.jpg');
    expect(ABOUT_PHOTO.width).toBeGreaterThan(0);
    expect(ABOUT_PHOTO.height).toBeGreaterThan(0);
    expect(ABOUT_PHOTO.alt.length).toBeGreaterThan(0);
  });

  // Формулировка подписи — правка ВЛАДЕЛЬЦА (пункт 15 списка правок
  // 2026-08-14, ответ 2026-08-18, вопрос 1 брифа `04-sections-brief.md`):
  // числительное цифрой, без глагола «делаю». Сторож обновлён вместе с
  // самой правкой, не задним числом.
  it('лид — правка владельца от 2026-08-18 (пункт 15): «3 года», без «делаю»', () => {
    expect(ABOUT_LEAD).toBe(
      'Даниил. 3 года на Python, сайты и автоматизацию для малого бизнеса.',
    );
    expect(ABOUT_CLOSING).toContain('Каждое число на этом сайте');
  });

  // `ABOUT_BLOCKS` — брифом раздел 4.3: подзаголовки сняты, блок стал
  // плоским списком текстов, порядок сменился на «сначала ИИ».
  it('ровно два блока, в новом порядке — сначала ИИ, потом полтора года (пункт 15)', () => {
    expect(ABOUT_BLOCKS).toHaveLength(2);
    expect(ABOUT_BLOCKS[0]).toContain('Код и часть дизайна пишу вместе с ИИ');
    expect(ABOUT_BLOCKS[1]).toContain('Полтора года вёл');
  });

  it('формулировка происхождения бизнеса — без имени, ровно «зоосервис в Москве» (D-011)', () => {
    expect(ABOUT_CLIENT_LABEL).toBe('зоосервис в Москве');
    expect(ABOUT_BLOCKS[1]).toContain(ABOUT_CLIENT_LABEL);
  });

  it('прошедшее время — «вёл», а не настоящее «сопровождаю»', () => {
    expect(ABOUT_BLOCKS[1]).toMatch(/вёл/);
    expect(/сопровождаю/i.test(ABOUT_BLOCKS[1])).toBe(false);
  });

  it('суммы 112 000 ₽ нет намеренно — только «34 оплаченные задачи»', () => {
    const all = ABOUT_LEAD + ABOUT_BLOCKS.join(' ') + ABOUT_CLOSING;
    expect(all).not.toContain('112 000');
    expect(all).toContain('34 оплаченные задачи');
  });
});
