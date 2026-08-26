// Развороты страниц кейсов — `70-workshop/specs/site-v3/12-case-pages-brief.md`,
// раздел 2 (правило разворота) и раздел 4 (чем заполняется разворот у каждого
// кейса). Эта правка несёт `zayavka-hub` (раздел 4.3 брифа) и `websites`
// (раздел 4.2); перенос оставшихся трёх кейсов — отдельные задачи (раздел
// брифа 5 и границы задачи).
//
// Правило раздела 5: «пустого разворота не существует по устройству, а не по
// договорённости» — модуль падает на сборке, если у кейса объявлен разворот
// без содержимого, тем же приёмом, что уже применяет
// `data/case-illustrations.ts`.

export interface CaseSpreadImage {
  /** Путь под `web/public/cases/**` — тот же файл, что уже лежит в
   *  репозитории (раздел 4.3 брифа), ничего не придумывается. */
  src: string;
  /** Честное описание того, что видно на кадре — без имён клиентов и
   *  выдуманных метрик (`40-portfolio/CLAUDE.md`). */
  alt: string;
  /** Подпись кадра — «имя витрины + шаг» (раздел 4.1 брифа: «подпись
   *  кадра (`<figcaption>`: имя витрины + шаг) остаётся в статической
   *  разметке»). Используется только раскроем `photo-row-3`: у `photo` и
   *  `photo-trio` подпись всего одна на панель (`.caption` рядом), три
   *  равных кадра в ряд такой общей подписи не имеют — у каждого кадра
   *  своя. */
  caption?: string;
}

export type CaseSpreadKind = 'photo' | 'photo-trio' | 'photo-row-3' | 'schema';

export interface CaseSpread {
  /** Метка панели — моно, акцент, как «ЗАДАЧА/ПОДХОД/РЕЗУЛЬТАТ» выше по
   *  странице (раздел 3.1 брифа). */
  label: string;
  /** Заголовок `h3` разворота. */
  heading: string;
  /** Подпись под заголовком — 1–2 фразы, мера `36ch` (раздел 3.1). */
  body: string;
  kind: CaseSpreadKind;
  /** `photo` — ровно один кадр; `photo-trio` — ровно три (первый — крупный,
   *  раздел 4.2/4.3: «крупно X, подкадрами Y и Z»); `photo-row-3` — ровно
   *  три равных кадра в ряд, без крупного (раздел 4.1: раскрой `storefront`
   *  «три витрины в Telegram», портрет 780×1688); `schema` — кадров нет,
   *  панель занимает `CaseFlowIllustration.astro` (П-2, единственная
   *  законная схема кейса). */
  images?: readonly CaseSpreadImage[];
  /** Внутренний размер кадра для атрибутов `width`/`height` (резервирует
   *  раскладку, раздел 8 брифа: «поле кадра зарезервировано точной
   *  пропорцией»). По умолчанию — ландшафт 1586×992 (раздел 3.5), у
   *  `storefront` кадры портретные 780×1688. */
  frameWidth?: number;
  frameHeight?: number;
}

/** Раздел 4.3 брифа: четыре разворота, три на настоящих кадрах, один —
 *  законная схема («если канал не принял» — момент, невидимый на экране
 *  панели, П-2). Кадры лежат в `web/public/cases/zayavka-hub/*.avif`
 *  (ландшафт 1586×992, раздел 3.5) и до этой правки не выводились ни на
 *  одной странице сайта. */
const ZAYAVKA_HUB_SPREADS: readonly CaseSpread[] = [
  {
    label: 'ГДЕ ОНИ ЛЕЖАТ',
    heading: 'Все заявки в одном списке',
    body:
      'Заявки из формы, бота и лендинга приходят в одну панель — не в три ' +
      'места, за которыми пришлось бы следить отдельно.',
    kind: 'photo',
    images: [
      {
        src: '/cases/zayavka-hub/01-dashboard.avif',
        alt: 'Список заявок в панели Заявка-Хаб с фильтрами и статусами доставки',
      },
    ],
  },
  {
    label: 'ОДНА ЗАЯВКА',
    heading: 'Откуда пришла и куда ушла',
    body:
      'Карточка заявки показывает источник и попытки доставки по каналам — ' +
      'видно, что заявка не потерялась, а прошла путь до получателя.',
    kind: 'photo-trio',
    images: [
      {
        src: '/cases/zayavka-hub/02-lead.avif',
        alt: 'Карточка заявки с источником, статусом и историей доставки',
      },
      {
        src: '/cases/zayavka-hub/02b-lead-api.avif',
        alt: 'Детали попытки доставки заявки через API',
      },
      {
        src: '/cases/zayavka-hub/02c-lead-done.avif',
        alt: 'Заявка со статусом «доставлено»',
      },
    ],
  },
  {
    label: 'МАРШРУТЫ',
    heading: 'Куда доставлять — настраивается без программиста',
    body:
      'Каналы доставки — почта, CRM, таблицы, Telegram — включаются в ' +
      'настройках и не требуют правки кода.',
    kind: 'photo',
    images: [
      {
        src: '/cases/zayavka-hub/03-settings.avif',
        alt: 'Настройки маршрутов доставки заявок по каналам',
      },
    ],
  },
  {
    label: 'ЕСЛИ КАНАЛ НЕ ПРИНЯЛ',
    heading: 'Заявка не теряется',
    body:
      'Когда канал не принимает заявку, сервис не сообщает об этом молча — ' +
      'он повторяет попытку доставки.',
    kind: 'schema',
  },
];

/** Раздел 4.2 брифа: три разворота, девять настоящих кадров, ноль схем.
 *  Источник — `web/public/cases/websites/<project>/*.avif`, ландшафт
 *  1586×992 (раздел 3.5). Группировка — по проекту, а не по шагу пути: три
 *  полных экрана одного сайта показывают его целиком, три первых экрана
 *  подряд показывали бы только вход. Раскрой панели «крупный кадр + два
 *  подкадра» — тот же `kind: 'photo-trio'`, что уже несёт `zayavka-hub`
 *  (раздел 4.2: «крупный на всю ширину панели… под ним два кадра в ряд»). */
const WEBSITES_SPREADS: readonly CaseSpread[] = [
  {
    label: 'B2B-СЕРВИС',
    heading: 'Первый экран, который объясняет продукт',
    body:
      'Главная сразу объясняет, что делает сервис, а конструктор ' +
      'автоматизаций и раздел подключений показывают, как это устроено внутри.',
    kind: 'photo-trio',
    images: [
      {
        src: '/cases/websites/relayos/01-home.avif',
        alt: 'Главная страница RelayOS с описанием продукта и таблицей автоматизаций',
      },
      {
        src: '/cases/websites/relayos/02-workflow-builder.avif',
        alt: 'Конструктор автоматизаций RelayOS со сценарием обработки заявки',
      },
      {
        src: '/cases/websites/relayos/03-connections.avif',
        alt: 'Раздел подключений RelayOS с настройкой синхронизации Salesforce',
      },
    ],
  },
  {
    label: 'БУТИК-ОТЕЛЬ',
    heading: 'Другая задача — другая типографика и другой ритм',
    body:
      'Крупные фотографии и спокойный ритм ведут от истории отеля к ' +
      'номерам и бронированию без лишних шагов.',
    kind: 'photo-trio',
    images: [
      {
        src: '/cases/websites/still-house/01-home.avif',
        alt: 'Главная страница бутик-отеля Still House на северном побережье',
      },
      {
        src: '/cases/websites/still-house/02-rooms.avif',
        alt: 'Каталог номеров Still House с фотографиями и ценами',
      },
      {
        src: '/cases/websites/still-house/03-room-booking.avif',
        alt: 'Страница номера Still House с деталями проживания и бронированием',
      },
    ],
  },
  {
    label: 'ГАЛЕРЕЯ МЕБЕЛИ',
    heading: 'Предмет крупно, текста ровно столько, сколько нужно',
    body:
      'Каталог и карточка товара оставляют место самому предмету — текста ' +
      'на странице ровно столько, сколько нужно для решения о покупке.',
    kind: 'photo-trio',
    images: [
      {
        src: '/cases/websites/forma-editions/01-home.avif',
        alt: 'Главная страница галереи коллекционной мебели Forma Editions',
      },
      {
        src: '/cases/websites/forma-editions/02-collection.avif',
        alt: 'Каталог предметов Forma Editions с креслом, светильником и столом',
      },
      {
        src: '/cases/websites/forma-editions/03-product.avif',
        alt: 'Карточка кресла Arc Chair 02 в галерее Forma Editions',
      },
    ],
  },
];

/** Раздел 4.1 брифа: три разворота, девять настоящих кадров, ноль схем.
 *  Источник — `web/public/cases/storefront/*.avif`, портрет 780×1688
 *  (раздел 3.5). Группировка — по витрине, а не по шагу пути: кейс
 *  утверждает «одна продуктовая схема в трёх нишах», и три полных пути
 *  рядом это показывают, три главные подряд — нет. Раскрой — `photo-row-3`
 *  (три равных кадра в ряд, без крупного): у `photo-trio` первый кадр
 *  крупный на всю ширину панели, здесь все три кадра — одна витрина целиком,
 *  крупного среди них нет по смыслу. */
const STOREFRONT_SPREADS: readonly CaseSpread[] = [
  {
    label: 'ПУТЬ ПОКУПАТЕЛЯ',
    heading: 'Каталог, товар, заказ — не выходя из Telegram',
    body:
      'Каталог, карточка сумки и корзина с оформлением заказа — один ' +
      'сценарий внутри Telegram, без перехода на отдельный сайт.',
    kind: 'photo-row-3',
    frameWidth: 780,
    frameHeight: 1688,
    images: [
      {
        src: '/cases/storefront/yasmina-home.avif',
        alt: 'Главная Yasmina с категориями и сумочкой из бусин',
        caption: 'Yasmina — главная',
      },
      {
        src: '/cases/storefront/yasmina-product.avif',
        alt: 'Карточка сумочки Fuchsia Marshmallow в приложении Yasmina',
        caption: 'Yasmina — товар',
      },
      {
        src: '/cases/storefront/yasmina-cart.avif',
        alt: 'Корзина Yasmina с выбранной сумочкой и формой заказа',
        caption: 'Yasmina — корзина',
      },
    ],
  },
  {
    label: 'ТА ЖЕ СХЕМА, ДРУГАЯ НИША',
    heading: 'Украшения: тот же путь, своя витрина',
    body:
      'Каталог украшений, карточка сотуара и корзина с формой заявки — та ' +
      'же структура, другой ассортимент и оформление.',
    kind: 'photo-row-3',
    frameWidth: 780,
    frameHeight: 1688,
    images: [
      {
        src: '/cases/storefront/mariosa-home.avif',
        alt: 'Главная Mariosa Jewelry с категориями украшений и карточкой серег',
        caption: 'Mariosa — главная',
      },
      {
        src: '/cases/storefront/mariosa-product.avif',
        alt: 'Карточка аметистового сотуара Mariosa Jewelry с фотографией и описанием',
        caption: 'Mariosa — товар',
      },
      {
        src: '/cases/storefront/mariosa-cart.avif',
        alt: 'Корзина Mariosa Jewelry с составом заявки и формой контакта',
        caption: 'Mariosa — корзина',
      },
    ],
  },
  {
    label: 'ТА ЖЕ СХЕМА, ТРЕТЬЯ НИША',
    heading: 'Авторские игрушки: каталог с вариантами',
    body:
      'Каталог отличает базовые и индивидуальные модели, карточка товара ' +
      'показывает конкретный вариант и его цену.',
    kind: 'photo-row-3',
    frameWidth: 780,
    frameHeight: 1688,
    images: [
      {
        src: '/cases/storefront/zayac-home.avif',
        alt: 'Главная Zayac с авторской игрушкой и сценариями заказа',
        caption: 'Zayac — главная',
      },
      {
        src: '/cases/storefront/zayac-catalog.avif',
        alt: 'Каталог Zayac с базовыми и индивидуальными моделями игрушек',
        caption: 'Zayac — каталог',
      },
      {
        src: '/cases/storefront/zayac-product.avif',
        alt: 'Карточка белой базовой модели Zayac с параметрами и ценой',
        caption: 'Zayac — товар',
      },
    ],
  },
];

const SPREADS_BY_SLUG: Readonly<Record<string, readonly CaseSpread[]>> = {
  'zayavka-hub': ZAYAVKA_HUB_SPREADS,
  websites: WEBSITES_SPREADS,
  storefront: STOREFRONT_SPREADS,
};

/** Развороты кейса, или пустой массив у кейсов, которых эта правка не несёт
 *  (перенос — отдельная задача, граница брифа раздел 5/12). Страница обязана
 *  сама решить, что делать с пустым массивом (не строить секцию), а не эта
 *  функция — здесь нет умолчания «нарисовать заглушку». */
export function caseSpreads(slug: string): readonly CaseSpread[] {
  return SPREADS_BY_SLUG[slug] ?? [];
}

// ---------------------------------------------------------------------
// Сторожа инвариантов — падают на сборке, а не в проде (раздел 5 брифа:
// «Пустого разворота не существует по устройству, а не по договорённости»).
// ---------------------------------------------------------------------
for (const [slug, spreads] of Object.entries(SPREADS_BY_SLUG)) {
  if (spreads.length < 2 || spreads.length > 4) {
    throw new Error(
      `data/case-spreads.ts: у кейса «${slug}» ${spreads.length} разворотов — ` +
      'норма 2..4 (раздел 5 брифа: пятый разворот значит, что два соседних ' +
      'говорят об одном и их надо слить).',
    );
  }
  spreads.forEach((spread, i) => {
    const where = `data/case-spreads.ts: разворот ${i + 1} кейса «${slug}»`;
    if (!spread.label.trim() || !spread.heading.trim() || !spread.body.trim()) {
      throw new Error(`${where} несёт пустую метку, заголовок или подпись.`);
    }
    if (spread.kind === 'schema') {
      if (spread.images && spread.images.length > 0) {
        throw new Error(`${where} объявлен как «schema», но несёт кадры — выбери один способ.`);
      }
      return;
    }
    if (!spread.images || spread.images.length === 0) {
      throw new Error(
        `${where} объявлен без кадра — пустой разворот запрещён по устройству ` +
        '(раздел 5 брифа), а не по договорённости.',
      );
    }
    const expected = spread.kind === 'photo-trio' || spread.kind === 'photo-row-3' ? 3 : 1;
    if (spread.images.length !== expected) {
      throw new Error(
        `${where}: у панели «${spread.kind}» ${spread.images.length} кадров, ожидалось ${expected}.`,
      );
    }
    spread.images.forEach((img, j) => {
      if (!img.src.trim() || !img.alt.trim()) {
        throw new Error(`${where}, кадр ${j + 1}: пустой src или alt.`);
      }
    });
  });
}
