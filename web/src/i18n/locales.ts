export const LOCALES = ['ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ru';

/** Пути, у которых существует английская версия. Пополняется в спеке 04 (кейсы). */
export const BILINGUAL_PATHS = ['/', '/o-mne', '/kontakt'];

export function localeFromPath(pathname: string): Locale {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'ru';
}

export function stripLocale(pathname: string): string {
  if (pathname === '/en') return '/';
  if (pathname.startsWith('/en/')) return pathname.slice(3) || '/';
  return pathname;
}

export function hasTranslation(pathname: string): boolean {
  return BILINGUAL_PATHS.includes(stripLocale(pathname));
}

export function altLocaleUrl(pathname: string, target: Locale): string {
  const base = stripLocale(pathname);
  if (target === 'ru') return hasTranslation(pathname) ? base : '/';
  if (!hasTranslation(pathname)) return '/en';
  return base === '/' ? '/en' : `/en${base}`;
}

import ru from './ru';
import en from './en';

export type Dict = typeof ru;

export function dict(locale: Locale): Dict {
  return locale === 'en' ? (en as unknown as Dict) : ru;
}
