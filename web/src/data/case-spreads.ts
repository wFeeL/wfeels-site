// Развороты страниц кейсов — `70-workshop/specs/site-v3/12-case-pages-brief.md`,
// раздел 2 (правило разворота) и раздел 4 (чем заполняется разворот у каждого
// кейса). Эта первая правка несёт только `zayavka-hub` (раздел 4.3 брифа);
// перенос остальных четырёх кейсов — отдельная задача (раздел брифа 5 и
// границы задачи).
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
}

export type CaseSpreadKind = 'photo' | 'photo-trio' | 'schema';

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
   *  раздел 4.2/4.3: «крупно X, подкадрами Y и Z»); `schema` — кадров нет,
   *  панель занимает `CaseFlowIllustration.astro` (П-2, единственная
   *  законная схема кейса). */
  images?: readonly CaseSpreadImage[];
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

const SPREADS_BY_SLUG: Readonly<Record<string, readonly CaseSpread[]>> = {
  'zayavka-hub': ZAYAVKA_HUB_SPREADS,
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
    const expected = spread.kind === 'photo-trio' ? 3 : 1;
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
