/** Пути, которые не попадают в sitemap: служебные и юридические черновики. */
export const SITEMAP_EXCLUDED = [
  '/dev',
  '/politika',
  '/oferta',
  '/soglasie',
  '/spasibo',
];

/**
 * Совпадение точное или по каталогу. Проверять простым `startsWith` нельзя:
 * тогда будущая `/politika-arhiv` молча выпала бы из карты сайта заодно
 * с настоящей `/politika`.
 */
export function isIndexable(pathname: string): boolean {
  return !SITEMAP_EXCLUDED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
