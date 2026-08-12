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

  it('лид и закрытие заданы', () => {
    expect(ABOUT_LEAD).toContain('Даниил');
    expect(ABOUT_CLOSING).toContain('Каждое число на этом сайте');
  });

  it('ровно два блока, в порядке спеки', () => {
    expect(ABOUT_BLOCKS.map((b) => b.title)).toEqual([
      'Полтора года с одним бизнесом',
      'Как я использую ИИ',
    ]);
  });

  it('формулировка происхождения бизнеса — без имени, ровно «зоосервис в Москве» (D-011)', () => {
    expect(ABOUT_CLIENT_LABEL).toBe('зоосервис в Москве');
    expect(ABOUT_BLOCKS[0].text).toContain(ABOUT_CLIENT_LABEL);
  });

  it('прошедшее время — «вёл», а не настоящее «сопровождаю»', () => {
    expect(ABOUT_BLOCKS[0].text).toMatch(/вёл/);
    expect(/сопровождаю/i.test(ABOUT_BLOCKS[0].text)).toBe(false);
  });

  it('суммы 112 000 ₽ нет намеренно — только «34 оплаченные задачи»', () => {
    const all = ABOUT_LEAD + ABOUT_BLOCKS.map((b) => b.text).join(' ') + ABOUT_CLOSING;
    expect(all).not.toContain('112 000');
    expect(all).toContain('34 оплаченные задачи');
  });
});
