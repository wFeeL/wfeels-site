import { stripLocale } from '../i18n/locales';

/** Адрес, куда ведёт кнопка в шапке. Одно место на весь сайт: и сама кнопка,
 *  и правило «не показывать её там, где она никуда не ведёт» читают отсюда. */
export const HEADER_CTA_HREF = '/kontakt';

/** Страницы, на которых кнопка в шапке не рисуется.
 *
 *  `/kontakt` — кнопка звала бы туда, где человек уже стоит, и спорила по весу
 *  с «Отправить»: две одинаковые основные кнопки в одном экране.
 *  `/spasibo` — там она становилась самым громким элементом и звала отправить
 *  заявку заново, хотя осмысленное действие после отправки — уйти на главную. */
const CTA_HIDDEN_ON = [HEADER_CTA_HREF, '/spasibo'];

/** Путь без якоря, строки запроса и хвостового слэша. */
export function normalizePath(value: string): string {
  const path = value.split('#')[0].split('?')[0];
  return path.replace(/\/+$/, '') || '/';
}

/** Ссылка ведёт на страницу, которая уже открыта.
 *
 *  Ссылка с якорем не считается совпадением никогда: пункты английской
 *  навигации указывают на секции одной страницы (`/en/#services`), и по
 *  одному только пути все пять разом получили бы `aria-current`. */
export function samePath(href: string, pathname: string): boolean {
  if (href.includes('#')) return false;
  return normalizePath(href) === normalizePath(pathname);
}

/** Рисовать ли кнопку в шапке на этом пути.
 *
 *  Решение принимает шапка по адресу страницы, а не каждая страница свойством:
 *  иначе новая страница обязана была бы про кнопку помнить, а забытое свойство
 *  провалилось бы молча. Список выше — единственное место правки. */
export function showHeaderCta(pathname: string): boolean {
  return !CTA_HIDDEN_ON.includes(stripLocale(normalizePath(pathname)));
}
