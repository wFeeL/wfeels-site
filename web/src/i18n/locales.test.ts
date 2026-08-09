import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import {
  BILINGUAL_PATHS, localeFromPath, stripLocale, altLocaleUrl, hasTranslation,
} from './locales';

describe('BILINGUAL_PATHS', () => {
  // Массив — ручное утверждение о существовании страниц, и ничто его с файлами
  // не связывает. Расхождение проваливается молча: переключатель языка ведёт в
  // 404, а в <head> уезжает hreflang на несуществующую страницу. Этот тест —
  // единственное, что превращает молчаливую ложь в красный.
  it('каждый путь имеет настоящую английскую страницу', () => {
    for (const path of BILINGUAL_PATHS) {
      const slug = path === '/' ? 'index' : path.replace(/^\//, '');
      const candidates = [
        new URL(`../pages/en/${slug}.astro`, import.meta.url),
        new URL(`../pages/en/${slug}/index.astro`, import.meta.url),
      ];
      expect(
        candidates.some((url) => existsSync(url)),
        `нет английской страницы для ${path}`,
      ).toBe(true);
    }
  });
});

describe('localeFromPath', () => {
  it('корень — русский', () => expect(localeFromPath('/')).toBe('ru'));
  it('русский путь без префикса', () =>
    expect(localeFromPath('/services/telegram-bot')).toBe('ru'));
  it('английский путь по префиксу', () =>
    expect(localeFromPath('/en/about')).toBe('en'));
  it('слово, начинающееся на en, не считается префиксом', () =>
    expect(localeFromPath('/energetika')).toBe('ru'));
});

describe('stripLocale', () => {
  it('снимает префикс', () => expect(stripLocale('/en/about')).toBe('/about'));
  it('корень английского становится корнем', () =>
    expect(stripLocale('/en')).toBe('/'));
  it('русский путь не меняется', () =>
    expect(stripLocale('/about')).toBe('/about'));
});

describe('hasTranslation', () => {
  it('двуязычные страницы', () => {
    expect(hasTranslation('/')).toBe(true);
    expect(hasTranslation('/en')).toBe(true);
  });
  it('страница, английской версии которой ещё нет', () => {
    expect(hasTranslation('/about')).toBe(false);
    expect(hasTranslation('/contact')).toBe(false);
  });
  it('посадочная только на русском', () =>
    expect(hasTranslation('/services/telegram-bot')).toBe(false));
  it('юридические только на русском', () =>
    expect(hasTranslation('/privacy')).toBe(false));
});

describe('altLocaleUrl', () => {
  it('двуязычная страница ведёт на свою пару', () => {
    expect(altLocaleUrl('/', 'en')).toBe('/en');
    expect(altLocaleUrl('/en', 'ru')).toBe('/');
  });
  it('одноязычная страница ведёт на английскую главную, а не в 404', () =>
    expect(altLocaleUrl('/services/telegram-bot', 'en')).toBe('/en'));
  it('путь, английской версии которого нет, ведёт на главную в обе стороны', () => {
    expect(altLocaleUrl('/contact', 'en')).toBe('/en');
    expect(altLocaleUrl('/en/contact', 'ru')).toBe('/');
  });
});
