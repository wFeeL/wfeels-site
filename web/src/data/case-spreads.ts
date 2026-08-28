// Развороты страниц кейсов — `70-workshop/specs/site-v3/12-case-pages-brief.md`,
// раздел 2 (правило разворота) и раздел 4 (чем заполняется разворот у каждого
// кейса). Перенесены `zayavka-hub` (раздел 4.3), `websites` (раздел 4.2),
// `storefront` (раздел 4.1), `site-v3` (раздел 4.5) и `ai-consultant`
// (раздел 4.4: три кадра сняты со стенда `50-code/rag-consultant`).
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

export type CaseSpreadKind =
  | 'photo'
  | 'photo-trio'
  | 'photo-row-3'
  | 'schema'
  | 'weight'
  | 'checklist';

export interface CaseSpreadCheck {
  /** Текст перед ссылкой — прозаическое вступление к проверке. */
  lead: string;
  /** Текст самой ссылки — прозаическая, значит подчёркнута всегда (D-055). */
  linkText: string;
  /** Маршрут, который подтверждает проверку (раздел 4.5 брифа: «каждая со
   *  ссылкой на маршрут, который её подтверждает»). Для тёмной темы —
   *  переключатель в шапке этой же страницы (`#theme-toggle`), для
   *  остального — реальный маршрут сайта. */
  href: string;
}

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
   *  законная схема кейса `zayavka-hub`); `weight` — кадров нет, панель
   *  занимает `CaseWeightIllustration.astro` (П-2, единственная законная
   *  схема кейса `site-v3`, раздел 4.5); `checklist` — кадров и схемы нет,
   *  панель несёт три строки-проверки (`checks`, раздел 4.5: «не кадр и не
   *  схема, а список из трёх проверок»). */
  images?: readonly CaseSpreadImage[];
  /** Ровно три строки-проверки — только у `kind: 'checklist'` (раздел 4.5
   *  брифа: «Проверка на месте»). */
  checks?: readonly CaseSpreadCheck[];
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
        caption: 'Панель — список заявок',
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
        caption: 'Карточка заявки',
      },
      {
        src: '/cases/zayavka-hub/02b-lead-api.avif',
        alt: 'Детали попытки доставки заявки через API',
        caption: 'Попытка доставки — API',
      },
      {
        src: '/cases/zayavka-hub/02c-lead-done.avif',
        alt: 'Заявка со статусом «доставлено»',
        caption: 'Статус «доставлено»',
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
        caption: 'Настройки маршрутов',
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
        caption: 'RelayOS — главная',
      },
      {
        src: '/cases/websites/relayos/02-workflow-builder.avif',
        alt: 'Конструктор автоматизаций RelayOS со сценарием обработки заявки',
        caption: 'RelayOS — конструктор',
      },
      {
        src: '/cases/websites/relayos/03-connections.avif',
        alt: 'Раздел подключений RelayOS с настройкой синхронизации Salesforce',
        caption: 'RelayOS — подключения',
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
        caption: 'Still House — главная',
      },
      {
        src: '/cases/websites/still-house/02-rooms.avif',
        alt: 'Каталог номеров Still House с фотографиями и ценами',
        caption: 'Still House — номера',
      },
      {
        src: '/cases/websites/still-house/03-room-booking.avif',
        alt: 'Страница номера Still House с деталями проживания и бронированием',
        caption: 'Still House — бронирование',
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
        caption: 'Forma Editions — главная',
      },
      {
        src: '/cases/websites/forma-editions/02-collection.avif',
        alt: 'Каталог предметов Forma Editions с креслом, светильником и столом',
        caption: 'Forma Editions — коллекция',
      },
      {
        src: '/cases/websites/forma-editions/03-product.avif',
        alt: 'Карточка кресла Arc Chair 02 в галерее Forma Editions',
        caption: 'Forma Editions — предмет',
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

/** Раздел 4.4 брифа: три разворота, три настоящих кадра, ноль схем — снятых
 *  со стенда `50-code/rag-consultant` (`app/web/widget.html`,
 *  `app/web/admin.html`), временный токен админки, без секретов в кадре.
 *  Разворот 2 («ОТКАЗ») стоит вторым намеренно (раздел 4.4: «отказ отвечать —
 *  единственное, чем этот продукт отличается от „спросите у нейросети“» —
 *  самый сильный кадр кейса). Нарисованный чат `CaseDialogueIllustration.astro`
 *  на этой странице не выводится (раздел 2, П-2). */
const AI_CONSULTANT_SPREADS: readonly CaseSpread[] = [
  {
    label: 'ОТВЕТ',
    heading: 'Отвечает по вашим материалам и показывает источник',
    body:
      'На вопрос о цене консультант отвечает по загруженным материалам и ' +
      'подписывает ответ именем файла-источника — не общими словами.',
    kind: 'photo',
    frameWidth: 1000,
    frameHeight: 1250,
    images: [
      {
        src: '/cases/ai-consultant/widget-answer.avif',
        alt: 'Виджет консультанта отвечает на вопросы о цене педикюра и об отмене записи, под каждым ответом отдельным блоком выделен источник',
        caption: 'Виджет — ответ с источником',
      },
    ],
  },
  {
    label: 'ОТКАЗ',
    heading: 'Если ответа в материалах нет — так и говорит',
    body:
      'На вопрос не по теме консультант не выдумывает ответ, а прямо ' +
      'сообщает, что не нашел этого в материалах, и просит уточнить у администратора.',
    kind: 'photo',
    frameWidth: 1000,
    frameHeight: 1250,
    images: [
      {
        src: '/cases/ai-consultant/widget-refusal.avif',
        alt: 'Виджет консультанта отвечает, что не нашел вопросы о записи на конкретное время и о погоде в материалах салона, и вместо источника явно показывает, что источников нет',
        caption: 'Виджет — отказ отвечать',
      },
    ],
  },
  {
    label: 'БАЗА ЗНАНИЙ',
    heading: 'Материалы загружаются и заменяются без разработчика',
    body:
      'Список файлов и редактор материалов — в одной панели: текст ' +
      'меняется и переиндексируется без участия программиста.',
    kind: 'photo',
    images: [
      {
        src: '/cases/ai-consultant/admin-knowledge-base.avif',
        alt: 'Админ-панель базы знаний со списком файлов и открытым текстом материала об услугах и ценах',
        caption: 'Админка — база знаний',
      },
    ],
  },
];

/** Раздел 4.5 брифа: «этот сайт», два разворота, ни одного снимка —
 *  намеренно. Снимок страницы, на которой читатель прямо сейчас стоит,
 *  ничего не добавляет к тому, что он уже видит, поэтому кейс показывает то,
 *  чего на экране не видно (вес и время открытия — «Замер», единственная
 *  законная схема кейса, П-2), и то, что читатель может проверить сам, не
 *  уходя со страницы («Проверка на месте»). */
const SITE_V3_SPREADS: readonly CaseSpread[] = [
  {
    label: 'ЗАМЕР',
    heading: 'Столько весит эта страница, и вот во что это превращается',
    body:
      'Вес и время открытия не видны на экране никогда — здесь они посчитаны ' +
      'для страницы, на которой вы сейчас находитесь, а не для главной.',
    kind: 'weight',
  },
  {
    label: 'ПРОВЕРКА НА МЕСТЕ',
    heading: 'Это и есть тот самый сайт',
    body: 'Три вещи из кейса можно проверить прямо сейчас, не уходя с этой страницы.',
    kind: 'checklist',
    checks: [
      {
        lead: 'Темная тема — переключите ее',
        linkText: 'в шапке этой же страницы',
        href: '#theme-toggle',
      },
      {
        lead: 'Английская версия сайта работает —',
        linkText: 'откройте /en',
        href: '/en',
      },
      {
        lead: 'Форма заявки принимает сообщения по-настоящему —',
        linkText: 'попробуйте на /contact',
        href: '/contact',
      },
    ],
  },
];

const SPREADS_BY_SLUG: Readonly<Record<string, readonly CaseSpread[]>> = {
  'zayavka-hub': ZAYAVKA_HUB_SPREADS,
  'site-v3': SITE_V3_SPREADS,
  websites: WEBSITES_SPREADS,
  storefront: STOREFRONT_SPREADS,
  'ai-consultant': AI_CONSULTANT_SPREADS,
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
    if (spread.kind === 'schema' || spread.kind === 'weight') {
      if (spread.images && spread.images.length > 0) {
        throw new Error(`${where} объявлен как «${spread.kind}», но несёт кадры — выбери один способ.`);
      }
      return;
    }
    if (spread.kind === 'checklist') {
      if (spread.images && spread.images.length > 0) {
        throw new Error(`${where} объявлен как «checklist», но несёт кадры — выбери один способ.`);
      }
      if (!spread.checks || spread.checks.length !== 3) {
        throw new Error(
          `${where}: у панели «checklist» ${spread.checks?.length ?? 0} проверок, ожидалось ровно 3 ` +
          '(раздел 4.5 брифа: «список из трёх проверок»).',
        );
      }
      spread.checks.forEach((check, j) => {
        if (!check.lead.trim() || !check.linkText.trim() || !check.href.trim()) {
          throw new Error(`${where}, проверка ${j + 1}: пустой lead, linkText или href.`);
        }
      });
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
