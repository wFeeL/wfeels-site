import { describe, it, expect } from 'vitest';
import { isIndexable } from './sitemap';

describe('isIndexable', () => {
  it('обычные страницы попадают в карту', () => {
    expect(isIndexable('/')).toBe(true);
    expect(isIndexable('/en')).toBe(true);
    expect(isIndexable('/uslugi/telegram-bot')).toBe(true);
  });

  it('юридические черновики не попадают', () => {
    expect(isIndexable('/politika')).toBe(false);
    expect(isIndexable('/oferta')).toBe(false);
    expect(isIndexable('/soglasie')).toBe(false);
    expect(isIndexable('/spasibo')).toBe(false);
  });

  it('служебный раздел не попадает целиком', () => {
    expect(isIndexable('/dev')).toBe(false);
    expect(isIndexable('/dev/ui')).toBe(false);
  });

  it('страница с похожим началом пути попадает', () => {
    expect(isIndexable('/politika-arhiv')).toBe(true);
    expect(isIndexable('/oferta-2027')).toBe(true);
    expect(isIndexable('/development')).toBe(true);
  });
});
