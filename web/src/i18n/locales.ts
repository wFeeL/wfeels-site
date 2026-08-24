import ru from './ru';
import en from './en';

export const LOCALES = ['ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ru';

/** Пути, у которых РЕАЛЬНО существует английская страница. Не список планов:
 *  каждый элемент обязан иметь файл под `pages/en/`, это проверяет тест рядом.
 *
 *  Список пуст не был только до правки владельца 2026-08-21 (D-078, снятие
 *  переключателя) и снова несёт `/` с возвратом английской главной
 *  2026-08-22: страница `pages/en/index.astro` существует и отдаёт ту же
 *  разметку, что русская, с английским текстом. Непустой список включает
 *  разом `hasTranslation`, hreflang-альтернативы в `lib/seo.ts` и честную
 *  цель переключателя — все три места читают именно его, а не второй флаг. */
export const BILINGUAL_PATHS: string[] = ['/'];

export function localeFromPath(pathname: string): Locale {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path === '/en' || path.startsWith('/en/') ? 'en' : 'ru';
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

/** Корень локали: с него начинается любой путь этого языка. Одно место на
 *  весь сайт — из него собираются и адрес знака в шапке, и якоря разделов
 *  (`lib/nav.ts`). Второй раз строку `/en` руками не писать. */
export function localeHome(locale: Locale): string {
  return locale === 'ru' ? '/' : '/en';
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

/** Один и тот же список на двух языках обязан иметь одинаковую ДЛИНУ.
 *
 *  Английская версия главной задумана как та же страница другими словами:
 *  «весь контент остаётся на местах, но переведён». Ровно это условие и
 *  проверяется здесь — не качество перевода, а то, что при переводе никто не
 *  потерял и не добавил пункт. Молча такое расхождение не ловится ничем:
 *  сборка зелёная, страница собирается, и только глазами видно, что в одном
 *  языке карточек шесть, а в другом пять.
 *
 *  Падение — на этапе загрузки модуля, как у остальных структурных сторожей
 *  этого репозитория (`data/faq.ts`, `data/process.ts`): дефект обязан
 *  ронять сборку, а не ждать прогона тестов. */
export function assertParallel(
  where: string,
  map: Record<Locale, readonly unknown[]>,
): void {
  const lengths = LOCALES.map((l) => `${l}=${map[l].length}`);
  const first = map[LOCALES[0]].length;
  for (const locale of LOCALES) {
    if (map[locale].length !== first) {
      throw new Error(
        `${where}: списки языков разошлись по длине (${lengths.join(', ')}). ` +
        'Английская версия — та же страница другими словами, а не другая ' +
        'страница: пункт, добавленный в один язык, обязан появиться и во втором.',
      );
    }
  }
}
