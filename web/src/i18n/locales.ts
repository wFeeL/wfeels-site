import ru from './ru';
import en from './en';

export const LOCALES = ['ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ru';

/** Пути, у которых РЕАЛЬНО существует английская страница. Не список планов:
 *  каждый элемент обязан иметь файл под `pages/en/`, это проверяет тест рядом.
 *  Английское ядро (обо мне, контакт, кейсы) добавляется в спеках 02 и 04
 *  вместе с двуязычной формой. */
export const BILINGUAL_PATHS = ['/'];

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

/** Ключи задаёт русский словарь. Значения — обычные строки, а не литералы,
 *  иначе английский словарь не пройдёт по типу из-за других текстов. */
export type Dict = Record<keyof typeof ru, string>;

/** Аннотация типа здесь не украшение: если в `en` не хватит ключа, который
 *  есть в `ru`, сборка упадёт с TS2741. Без неё пропущенный ключ молча
 *  доехал бы до продакшена и отрисовался как `undefined` — например,
 *  в `aria-label`, где этого никто не заметит. */
const DICTS: Record<Locale, Dict> = { ru, en };

export function dict(locale: Locale): Dict {
  return DICTS[locale];
}
