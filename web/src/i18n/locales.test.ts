import { describe, it, expect } from 'vitest';
import {
  localeFromPath, stripLocale, altLocaleUrl, hasTranslation,
} from './locales';

describe('localeFromPath', () => {
  it('корень — русский', () => expect(localeFromPath('/')).toBe('ru'));
  it('русский путь без префикса', () =>
    expect(localeFromPath('/uslugi/telegram-bot')).toBe('ru'));
  it('английский путь по префиксу', () =>
    expect(localeFromPath('/en/o-mne')).toBe('en'));
  it('слово, начинающееся на en, не считается префиксом', () =>
    expect(localeFromPath('/energetika')).toBe('ru'));
});

describe('stripLocale', () => {
  it('снимает префикс', () => expect(stripLocale('/en/o-mne')).toBe('/o-mne'));
  it('корень английского становится корнем', () =>
    expect(stripLocale('/en')).toBe('/'));
  it('русский путь не меняется', () =>
    expect(stripLocale('/o-mne')).toBe('/o-mne'));
});

describe('hasTranslation', () => {
  it('двуязычные страницы', () => {
    expect(hasTranslation('/')).toBe(true);
    expect(hasTranslation('/o-mne')).toBe(true);
    expect(hasTranslation('/en/o-mne')).toBe(true);
  });
  it('посадочная только на русском', () =>
    expect(hasTranslation('/uslugi/telegram-bot')).toBe(false));
  it('юридические только на русском', () =>
    expect(hasTranslation('/politika')).toBe(false));
});

describe('altLocaleUrl', () => {
  it('двуязычная страница ведёт на свою пару', () =>
    expect(altLocaleUrl('/o-mne', 'en')).toBe('/en/o-mne'));
  it('и обратно', () =>
    expect(altLocaleUrl('/en/o-mne', 'ru')).toBe('/o-mne'));
  it('корень', () => {
    expect(altLocaleUrl('/', 'en')).toBe('/en');
    expect(altLocaleUrl('/en', 'ru')).toBe('/');
  });
  it('одноязычная страница ведёт на английскую главную, а не в 404', () =>
    expect(altLocaleUrl('/uslugi/telegram-bot', 'en')).toBe('/en'));
});
