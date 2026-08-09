/** Пути, которые не попадают в sitemap: служебные и юридические черновики. */
export const SITEMAP_EXCLUDED = [
  '/dev',
  '/privacy',
  '/terms',
  '/consent',
  '/thanks',
];

/**
 * Совпадение точное или по каталогу. Проверять простым `startsWith` нельзя:
 * тогда будущая `/privacy-archive` молча выпала бы из карты сайта заодно
 * с настоящей `/privacy`.
 */
export function isIndexable(pathname: string): boolean {
  return !SITEMAP_EXCLUDED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
