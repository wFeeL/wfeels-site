export interface CaseGallerySlide {
  label: string;
  src: string;
  alt: string;
  project: string;
  subject: 'магазина' | 'сайта';
}

/* Манифест кэшируется браузером отдельно от HTML. Версия в URL обязательна:
   иначе новая сборка могла получить старые пути слайдов ещё на пять минут. */
export const CASE_GALLERIES_URL = '/case-galleries.json?v=2';

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
    src: '/cases/websites/still-house/02-rooms.webp',
    alt: 'Каталог номеров Still House с фотографиями и ценами',
    project: 'Still House',
    subject: 'сайта',
  },
  {
    label: 'Бронирование',
    src: '/cases/websites/still-house/03-room-booking.webp',
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
