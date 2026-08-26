import type { Locale } from '../i18n/locales';

export interface CaseGallerySlide {
  label: string;
  src: string;
  alt: string;
  project: string;
  subject: 'магазина' | 'сайта' | 'shop' | 'website';
}

/* Манифест кэшируется браузером отдельно от HTML. Версия в URL обязательна:
   иначе новая сборка могла получить старые пути слайдов ещё на пять минут. */
export const CASE_GALLERIES_URL = '/case-galleries.json?v=4';

export const STOREFRONT_SLIDES: readonly CaseGallerySlide[] = [
  {
    label: 'Главная',
    src: '/cases/storefront/yasmina-home.avif',
    alt: 'Главная Yasmina с категориями и сумочкой из бусин',
    project: 'Yasmina',
    subject: 'магазина',
  },
  {
    label: 'Товар',
    src: '/cases/storefront/yasmina-product.avif',
    alt: 'Карточка сумочки Fuchsia Marshmallow в приложении Yasmina',
    project: 'Yasmina',
    subject: 'магазина',
  },
  {
    label: 'Корзина',
    src: '/cases/storefront/yasmina-cart.avif',
    alt: 'Корзина Yasmina с выбранной сумочкой и формой заказа',
    project: 'Yasmina',
    subject: 'магазина',
  },
  {
    label: 'Главная',
    src: '/cases/storefront/mariosa-home.avif',
    alt: 'Главная Mariosa Jewelry с категориями украшений и карточкой серег',
    project: 'Mariosa',
    subject: 'магазина',
  },
  {
    label: 'Товар',
    src: '/cases/storefront/mariosa-product.avif',
    alt: 'Карточка аметистового сотуара Mariosa Jewelry с фотографией и описанием',
    project: 'Mariosa',
    subject: 'магазина',
  },
  {
    label: 'Корзина',
    src: '/cases/storefront/mariosa-cart.avif',
    alt: 'Корзина Mariosa Jewelry с составом заявки и формой контакта',
    project: 'Mariosa',
    subject: 'магазина',
  },
  {
    label: 'Главная',
    src: '/cases/storefront/zayac-home.avif',
    alt: 'Главная Zayac с авторской игрушкой и сценариями заказа',
    project: 'Zayac',
    subject: 'магазина',
  },
  {
    label: 'Каталог',
    src: '/cases/storefront/zayac-catalog.avif',
    alt: 'Каталог Zayac с базовыми и индивидуальными моделями игрушек',
    project: 'Zayac',
    subject: 'магазина',
  },
  {
    label: 'Товар',
    src: '/cases/storefront/zayac-product.avif',
    alt: 'Карточка белой базовой модели Zayac с параметрами и ценой',
    project: 'Zayac',
    subject: 'магазина',
  },
];

export const WEBSITE_SLIDES: readonly CaseGallerySlide[] = [
  {
    label: 'Главная',
    src: '/cases/websites/relayos/01-home.avif',
    alt: 'Главная страница RelayOS с описанием продукта и таблицей автоматизаций',
    project: 'RelayOS',
    subject: 'сайта',
  },
  {
    label: 'Конструктор',
    src: '/cases/websites/relayos/02-workflow-builder.avif',
    alt: 'Конструктор автоматизаций RelayOS со сценарием обработки заявки',
    project: 'RelayOS',
    subject: 'сайта',
  },
  {
    label: 'Подключения',
    src: '/cases/websites/relayos/03-connections.avif',
    alt: 'Раздел подключений RelayOS с настройкой синхронизации Salesforce',
    project: 'RelayOS',
    subject: 'сайта',
  },
  {
    label: 'Главная',
    src: '/cases/websites/still-house/01-home.avif',
    alt: 'Главная страница бутик-отеля Still House на северном побережье',
    project: 'Still House',
    subject: 'сайта',
  },
  {
    label: 'Номера',
    src: '/cases/websites/still-house/02-rooms.avif',
    alt: 'Каталог номеров Still House с фотографиями и ценами',
    project: 'Still House',
    subject: 'сайта',
  },
  {
    label: 'Бронирование',
    src: '/cases/websites/still-house/03-room-booking.avif',
    alt: 'Страница номера Still House с деталями проживания и бронированием',
    project: 'Still House',
    subject: 'сайта',
  },
  {
    label: 'Главная',
    src: '/cases/websites/forma-editions/01-home.avif',
    alt: 'Главная страница галереи коллекционной мебели Forma Editions',
    project: 'Forma Editions',
    subject: 'сайта',
  },
  {
    label: 'Коллекция',
    src: '/cases/websites/forma-editions/02-collection.avif',
    alt: 'Каталог предметов Forma Editions с креслом, светильником и столом',
    project: 'Forma Editions',
    subject: 'сайта',
  },
  {
    label: 'Предмет',
    src: '/cases/websites/forma-editions/03-product.avif',
    alt: 'Карточка кресла Arc Chair 02 в галерее Forma Editions',
    project: 'Forma Editions',
    subject: 'сайта',
  },
];

type GallerySlideText = Pick<CaseGallerySlide, 'label' | 'alt' | 'subject'>;

function localizeSlides(
  name: string,
  source: readonly CaseGallerySlide[],
  translations: readonly GallerySlideText[],
): readonly CaseGallerySlide[] {
  if (source.length !== translations.length) {
    throw new Error(
      `data/case-galleries.ts: в галерее ${name} ${source.length} русских ` +
      `кадров и ${translations.length} английских переводов.`,
    );
  }
  return source.map((slide, index) => ({ ...slide, ...translations[index] }));
}

export const STOREFRONT_SLIDES_EN = localizeSlides('storefront', STOREFRONT_SLIDES, [
  {
    label: 'Home',
    alt: 'Yasmina home screen with categories and a beaded handbag',
    subject: 'shop',
  },
  {
    label: 'Product',
    alt: 'Fuchsia Marshmallow handbag product page in Yasmina',
    subject: 'shop',
  },
  {
    label: 'Basket',
    alt: 'Yasmina basket with the selected handbag and order form',
    subject: 'shop',
  },
  {
    label: 'Home',
    alt: 'Mariosa Jewelry home screen with jewellery categories and earrings',
    subject: 'shop',
  },
  {
    label: 'Product',
    alt: 'Mariosa Jewelry amethyst sautoir product page with photo and description',
    subject: 'shop',
  },
  {
    label: 'Basket',
    alt: 'Mariosa Jewelry basket with enquiry details and contact form',
    subject: 'shop',
  },
  {
    label: 'Home',
    alt: 'Zayac home screen with a handmade toy and ordering options',
    subject: 'shop',
  },
  {
    label: 'Catalogue',
    alt: 'Zayac catalogue with standard and custom toy models',
    subject: 'shop',
  },
  {
    label: 'Product',
    alt: 'White standard Zayac model product page with options and price',
    subject: 'shop',
  },
]);

export const WEBSITE_SLIDES_EN = localizeSlides('websites', WEBSITE_SLIDES, [
  {
    label: 'Home',
    alt: 'RelayOS home page with product overview and automation table',
    subject: 'website',
  },
  {
    label: 'Builder',
    alt: 'RelayOS automation builder with an enquiry-processing workflow',
    subject: 'website',
  },
  {
    label: 'Connections',
    alt: 'RelayOS connections page with Salesforce synchronisation settings',
    subject: 'website',
  },
  {
    label: 'Home',
    alt: 'Still House boutique hotel home page on the northern coast',
    subject: 'website',
  },
  {
    label: 'Rooms',
    alt: 'Still House room catalogue with photos and prices',
    subject: 'website',
  },
  {
    label: 'Booking',
    alt: 'Still House room page with stay details and booking',
    subject: 'website',
  },
  {
    label: 'Home',
    alt: 'Forma Editions collectible furniture gallery home page',
    subject: 'website',
  },
  {
    label: 'Collection',
    alt: 'Forma Editions catalogue with an armchair, lamp and table',
    subject: 'website',
  },
  {
    label: 'Object',
    alt: 'Arc Chair 02 product page in the Forma Editions gallery',
    subject: 'website',
  },
]);

export function storefrontSlides(locale: Locale): readonly CaseGallerySlide[] {
  return locale === 'ru' ? STOREFRONT_SLIDES : STOREFRONT_SLIDES_EN;
}

export function websiteSlides(locale: Locale): readonly CaseGallerySlide[] {
  return locale === 'ru' ? WEBSITE_SLIDES : WEBSITE_SLIDES_EN;
}

export function galleryStatus(
  slide: CaseGallerySlide,
  index: number,
  total: number,
  locale: Locale,
): string {
  if (locale === 'en') {
    return `Showing ${slide.project} ${slide.subject} ${slide.label.toLowerCase()} screen, ${index + 1} of ${total}`;
  }
  return `Показан экран ${slide.label} ${slide.subject} ${slide.project}, ${index + 1} из ${total}`;
}

export const GALLERY_UI = {
  ru: {
    storefrontLabel: 'Экраны Telegram Mini App',
    websitesLabel: 'Экраны сайтов',
    previous: 'Предыдущий экран',
    next: 'Следующий экран',
    previousWebsite: 'Предыдущий экран сайта',
    nextWebsite: 'Следующий экран сайта',
  },
  en: {
    storefrontLabel: 'Telegram Mini App screens',
    websitesLabel: 'Website screens',
    previous: 'Previous screen',
    next: 'Next screen',
    previousWebsite: 'Previous website screen',
    nextWebsite: 'Next website screen',
  },
} as const satisfies Record<Locale, Record<string, string>>;
