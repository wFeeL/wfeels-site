import { altLocaleUrl, hasTranslation, localeFromPath } from '../i18n/locales';

/** Единственный публичный origin сайта. Канонические адреса, sitemap и social
 * preview не должны зависеть от адреса локального preview-сервера. */
export const PRODUCTION_SITE = 'https://wfeels.site';
export const DEFAULT_SOCIAL_IMAGE_PATH = '/og-default.png';

/** Проверяет origin раньше, чем Astro начнёт писать HTML в `dist`.
 *
 * В прошлом отсутствие `SITE_URL` молча давало `http://localhost:4321` во всех
 * canonical/hreflang и в sitemap. Безопасное умолчание теперь боевое, а любое
 * явное значение обязано совпадать с ним целиком. Так опечатка в deploy-команде
 * не выпускает сборку с другим доменом или протоколом. */
export function productionSite(configured = PRODUCTION_SITE): string {
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error(`SITE_URL must be ${PRODUCTION_SITE}, received ${JSON.stringify(configured)}`);
  }

  if (url.href !== `${PRODUCTION_SITE}/`) {
    throw new Error(`SITE_URL must be ${PRODUCTION_SITE}, received ${JSON.stringify(configured)}`);
  }

  return PRODUCTION_SITE;
}

export interface MetaInput {
  title: string;
  description: string;
  pathname: string;
  site: string;
  noindex?: boolean;
  nofollow?: boolean;
}

export interface Meta {
  canonical: string;
  socialImage: string;
  robots: string;
  alternates: { hreflang: string; href: string }[];
}

const abs = (site: string, path: string) => `${site.replace(/\/$/, '')}${path}`;

export function buildMeta(input: MetaInput): Meta {
  const site = productionSite(input.site);
  const path = input.pathname === '/' ? '/' : input.pathname.replace(/\/$/, '');
  const canonical = abs(site, path);
  const socialImage = abs(site, DEFAULT_SOCIAL_IMAGE_PATH);
  const robots = `${input.noindex ? 'noindex' : 'index'}, ${input.nofollow ? 'nofollow' : 'follow'}`;

  if (!hasTranslation(path)) return { canonical, socialImage, robots, alternates: [] };

  const locale = localeFromPath(path);
  const ruPath = locale === 'ru' ? path : altLocaleUrl(path, 'ru');
  const enPath = locale === 'en' ? path : altLocaleUrl(path, 'en');

  return {
    canonical,
    socialImage,
    robots,
    alternates: [
      { hreflang: 'ru', href: abs(site, ruPath) },
      { hreflang: 'en', href: abs(site, enPath) },
      { hreflang: 'x-default', href: abs(site, ruPath) },
    ],
  };
}
