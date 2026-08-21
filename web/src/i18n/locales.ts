import ru from './ru';
import en from './en';

export const LOCALES = ['ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ru';

/** Пути, у которых РЕАЛЬНО существует английская страница. Не список планов:
 *  каждый элемент обязан иметь файл под `pages/en/`, это проверяет тест рядом.
 *
 *  Пуст с правки владельца 2026-08-21 («убираем переключатель на английский
 *  язык страницы. можем также полностью пока убрать путь /en»): маршрут
 *  `/en` и переключатель сняты, а список путей остаётся пустым, пока их не
 *  вернут. Пустой массив гасит `hasTranslation` и вместе с ней hreflang в
 *  `lib/seo.ts` без отдельной правки там — оба места читают именно этот
 *  список, а не второй флаг. Механика двуязычия (этот файл целиком, включая
 *  `en`-словарь) остаётся нетронутой ради дешёвого возврата. */
export const BILINGUAL_PATHS: string[] = [];

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
