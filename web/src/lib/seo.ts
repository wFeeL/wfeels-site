import { altLocaleUrl, hasTranslation, localeFromPath } from '../i18n/locales';

export interface MetaInput {
  title: string;
  description: string;
  pathname: string;
  site: string;
  noindex?: boolean;
}

export interface Meta {
  canonical: string;
  robots: string;
  alternates: { hreflang: string; href: string }[];
}

const abs = (site: string, path: string) => `${site.replace(/\/$/, '')}${path}`;

export function buildMeta(input: MetaInput): Meta {
  const path = input.pathname === '/' ? '/' : input.pathname.replace(/\/$/, '');
  const canonical = abs(input.site, path);
  const robots = input.noindex ? 'noindex, nofollow' : 'index, follow';

  if (!hasTranslation(path)) return { canonical, robots, alternates: [] };

  const locale = localeFromPath(path);
  const ruPath = locale === 'ru' ? path : altLocaleUrl(path, 'ru');
  const enPath = locale === 'en' ? path : altLocaleUrl(path, 'en');

  return {
    canonical,
    robots,
    alternates: [
      { hreflang: 'ru', href: abs(input.site, ruPath) },
      { hreflang: 'en', href: abs(input.site, enPath) },
      { hreflang: 'x-default', href: abs(input.site, ruPath) },
    ],
  };
}
