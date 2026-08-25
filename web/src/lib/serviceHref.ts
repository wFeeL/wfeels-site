import { SERVICE_GROUPS, type ServiceIconKind } from '../data/services';

/** Ссылка на посадочную услуги — по значку группы `data/services.ts` и
 *  дословному РУССКОМУ тексту ссылки. Кидает явную ошибку, если ссылку
 *  переименовали: молчаливо увядшая ссылка на сайте хуже красной сборки.
 *
 *  Общий модуль (был частью `data/pricingShowcase.ts` до правки 2026-08-26,
 *  когда тот же приём понадобился и первому экрану, `home/Hero.astro`,
 *  «Достучаться до посадочных» — второй копии функции заводить не стали).
 *
 *  Ищется в русском списке независимо от языка страницы: адрес у ссылки один
 *  на обе версии (`data/services.ts` собирает английскую группу из русской и
 *  адреса не трогает), а искать по переведённой подписи значило бы завести
 *  вторую точку отказа там, где её не было. */
export function serviceHref(icon: ServiceIconKind, linkText: string): string {
  const serviceGroup = SERVICE_GROUPS.find((g) => g.icon === icon);
  const link = serviceGroup?.links.find((l) => l.text === linkText);
  if (!link) {
    throw new Error(
      `lib/serviceHref.ts: у группы услуг «${icon}» нет ссылки «${linkText}» — ` +
      'на неё кто-то ссылается.',
    );
  }
  return link.href;
}
