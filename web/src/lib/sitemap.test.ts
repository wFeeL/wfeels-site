import { describe, it, expect } from 'vitest';
import { isIndexable } from './sitemap';

describe('isIndexable', () => {
  it('обычные страницы попадают в карту', () => {
    expect(isIndexable('/')).toBe(true);
    expect(isIndexable('/en')).toBe(true);
    expect(isIndexable('/services/telegram-bot')).toBe(true);
  });

  it('юридические черновики не попадают', () => {
    expect(isIndexable('/privacy')).toBe(false);
    expect(isIndexable('/terms')).toBe(false);
    expect(isIndexable('/consent')).toBe(false);
    expect(isIndexable('/thanks')).toBe(false);
  });

  it('английские двойники юридических и служебных страниц не попадают', () => {
    expect(isIndexable('/en/privacy')).toBe(false);
    expect(isIndexable('/en/terms')).toBe(false);
    expect(isIndexable('/en/consent')).toBe(false);
    expect(isIndexable('/en/thanks')).toBe(false);
    expect(isIndexable('/en/404')).toBe(false);
  });

  it('английская главная и её похожие по началу пути адреса не задеты', () => {
    expect(isIndexable('/en')).toBe(true);
    expect(isIndexable('/en/privacy-archive')).toBe(true);
  });

  it('служебный раздел не попадает целиком', () => {
    expect(isIndexable('/dev')).toBe(false);
    expect(isIndexable('/dev/ui')).toBe(false);
  });

  it('страница с похожим началом пути попадает', () => {
    expect(isIndexable('/privacy-archive')).toBe(true);
    expect(isIndexable('/terms-2027')).toBe(true);
    expect(isIndexable('/development')).toBe(true);
  });
});
