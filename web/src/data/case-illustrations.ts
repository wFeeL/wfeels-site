// Числа и данные трёх иллюстраций секции 5 — единственный источник
// (`70-workshop/specs/site-v3/02-case-illustrations.md`, раздел 2.5: «ни
// одна координата, ни один литерал не написаны в разметке руками»).
// Компоненты
// `CaseWeightIllustration.astro`, `CaseFlowIllustration.astro`,
// `CaseDialogueIllustration.astro` читают отсюда.
//
// Модуль падает на сборке, если инварианты нарушены — это и есть ответ на
// «пустое состояние» (бриф, раздел 2.5): пустого рисунка не существует,
// сборка не проходит.

import {
  PAGE_WEIGHT_KB,
  TYPICAL_PAGE_MB_TEXT,
  WEIGHT_MULTIPLIER,
  WEIGHT_MULTIPLIER_PHRASE,
  OUR_LOAD_SECONDS_TEXT,
  TYPICAL_LOAD_SECONDS_TEXT,
  TYPICAL_PAGE_MB_TEXT_EN,
  OUR_LOAD_SECONDS_TEXT_EN,
  TYPICAL_LOAD_SECONDS_TEXT_EN,
  PAGE_WEIGHT_KB_EN,
  CASE_PAGE_WEIGHT_KB,
  CASE_OUR_LOAD_SECONDS_TEXT,
  weightMultiplier,
  weightMultiplierPhrase,
  pageWeightKb,
} from './pageWeight';
import { assertParallel, type Locale } from '../i18n/locales';

// ---------------------------------------------------------------------
// Иллюстрация 1 — «Замер» (кейс «Этот сайт», бриф раздел 3). Композиция
// владельца от 2026-08-19 (эскиз, диспетч «Пересобрать иллюстрацию кейса
// «Этот сайт»»): четыре числа попарно — время и вес, наши и чужие, — стрелка
// по центру и вывод внизу. Она заменила две сравнительные полосы и строку
// мелких метрик под ними (композиция 2026-08-13): полосы показывали только
// вес, а вес сам по себе владельцу сайта ничего не говорит — говорит время,
// в которое он превращается.
//
// Числа и их сторожа — `data/pageWeight.ts`; этот модуль только собирает их
// в форму, удобную рисунку, вторых литералов не заводит. Своё время замерено,
// чужое выведено из веса и канала, кратность выведена из двух весов,
// словесная форма кратности выведена из кратности — на рисунке НЕТ ни одного
// числа и ни одного слова о числе, написанного рукой.
// ---------------------------------------------------------------------

/** Одна клетка сравнения: число со своей единицей одной строкой (единица не
 *  отделена от числа разметкой — `check-budget.mjs` читает «400 КБ» и
 *  «2,4 МБ» цельной строкой, а счётчик на прокрутке переписывает только
 *  цифры, оставляя хвост как есть) и подпись под ним. */
export interface WeightCell {
  /** Машинный якорь клетки — по нему её находит гейт и тесты; класс
   *  оформления для этого не годится, он принадлежит вёрстке. */
  key: 'time-ours' | 'time-typical' | 'weight-ours' | 'weight-typical';
  /** Наша сторона сравнения или чужая — от этого зависит сторона клетки в
   *  раскладке и акцент. */
  side: 'ours' | 'typical';
  /** Значение вместе с единицей: «0,4 с», «2,4 МБ». */
  value: string;
  /** Подпись под числом — обычной фразой, а не термином. */
  caption: string;
}

/** Четыре клетки в порядке чтения: строка времени, затем строка веса.
 *  Порядок именно такой (сначала время, потом вес), потому что время —
 *  то, что читатель переживает, а вес — то, чем оно объясняется. */
export const WEIGHT_CELLS: readonly WeightCell[] = [
  { key: 'time-ours', side: 'ours', value: `${OUR_LOAD_SECONDS_TEXT} с`, caption: 'Время загрузки нашей страницы' },
  { key: 'time-typical', side: 'typical', value: `${TYPICAL_LOAD_SECONDS_TEXT} с`, caption: 'Время загрузки обычной страницы' },
  { key: 'weight-ours', side: 'ours', value: `${PAGE_WEIGHT_KB} КБ`, caption: 'Вес нашей страницы' },
  { key: 'weight-typical', side: 'typical', value: `${TYPICAL_PAGE_MB_TEXT} МБ`, caption: 'Вес обычной страницы' },
];

/* ─────────────────────────── Английская версия ────────────────────────────
 *
 * Клетки собираются из русских: `key` и `side` берутся у оригинала, поэтому
 * порядок «наша / чужая» и раскладка в две колонки на английской странице
 * не могут разъехаться. Переводятся подпись и ЕДИНИЦА, а величина остаётся
 * той же — 409 КБ и 409 KB это одни и те же байты.
 *
 * Разделитель дробной части приходит из `pageWeight.ts` уже английским
 * («0.4», не «0,4»): на английской странице запятая читается как разделитель
 * разрядов и меняет число в тысячу раз. */
const WEIGHT_CELLS_EN: readonly WeightCell[] = [
  { key: 'time-ours', side: 'ours', value: `${OUR_LOAD_SECONDS_TEXT_EN} s`, caption: 'Our page load time' },
  { key: 'time-typical', side: 'typical', value: `${TYPICAL_LOAD_SECONDS_TEXT_EN} s`, caption: 'A typical page load time' },
  { key: 'weight-ours', side: 'ours', value: `${PAGE_WEIGHT_KB_EN} KB`, caption: 'Our page weight' },
  { key: 'weight-typical', side: 'typical', value: `${TYPICAL_PAGE_MB_TEXT_EN} MB`, caption: 'A typical page weight' },
];

const WEIGHT_CELLS_BY_LOCALE: Record<Locale, readonly WeightCell[]> = {
  ru: WEIGHT_CELLS, en: WEIGHT_CELLS_EN,
};
assertParallel('data/case-illustrations.ts (клетки веса)', WEIGHT_CELLS_BY_LOCALE);

for (const [locale, cells] of Object.entries(WEIGHT_CELLS_BY_LOCALE)) {
  const keys = cells.map((c) => c.key).join(' ');
  if (keys !== WEIGHT_CELLS.map((c) => c.key).join(' ')) {
    throw new Error(
      `data/case-illustrations.ts: клетки языка «${locale}» идут в другом порядке ` +
      'или несут другие ключи — рисунок перестал быть одним и тем же.',
    );
  }
}

/* ─────────────────────── Страница кейса `site-v3` ──────────────────────
 *
 * Решение D-122 (раздел 4.6 брифа страниц кейсов, правка 2): рисунок
 * «Замер» ставится не только в секцию кейсов главной, но и на саму страницу
 * `/cases/site-v3` — и обязан показывать вес и время ЭТОЙ страницы, а не
 * главной. `weightIllustration()` поэтому принимает вторым аргументом
 * страницу-хозяина; без него функция продолжала бы читать `PAGE_WEIGHT_KB`
 * независимо от того, где стоит рисунок, — то есть дефект D-122 в чистом
 * виде.
 *
 * Клетки `weight-typical`/`time-typical` (медиана и типовое время) от
 * хозяина не зависят — они про ЧУЖИЕ страницы — и здесь не пересобираются:
 * `WEIGHT_CELLS` и `CASE_SITE_V3_WEIGHT_CELLS` делят один и тот же текст этих
 * двух клеток буквально (без общей фабрики — риск разойтись у неизменной
 * пары ниже, чем у фабрики, которую ещё не написали). */
export type WeightIllustrationHost = 'home' | 'case-site-v3';

/** Те же четыре клетки, что у главной (`WEIGHT_CELLS`), но `time-ours` и
 *  `weight-ours` — числа страницы кейса `site-v3`
 *  (`CASE_OUR_LOAD_SECONDS_TEXT`, `CASE_PAGE_WEIGHT_KB`), а не главной.
 *  Подписи и чужая сторона — те же слова, что у главной: сравнение с
 *  медианой одно и то же независимо от того, чья страница слева. */
const CASE_SITE_V3_WEIGHT_CELLS: readonly WeightCell[] = [
  { key: 'time-ours', side: 'ours', value: `${CASE_OUR_LOAD_SECONDS_TEXT} с`, caption: 'Время загрузки нашей страницы' },
  { key: 'time-typical', side: 'typical', value: `${TYPICAL_LOAD_SECONDS_TEXT} с`, caption: 'Время загрузки обычной страницы' },
  { key: 'weight-ours', side: 'ours', value: `${CASE_PAGE_WEIGHT_KB} КБ`, caption: 'Вес нашей страницы' },
  { key: 'weight-typical', side: 'typical', value: `${TYPICAL_PAGE_MB_TEXT} МБ`, caption: 'Вес обычной страницы' },
];

/* Тот же порядок и тот же состав ключей, что у главной — иначе раскладка
   «наша/чужая» (`.cmp` в `CaseWeightIllustration.astro`) для кейса и для
   главной разъехались бы по-разному, незаметно для сборки. */
if (CASE_SITE_V3_WEIGHT_CELLS.map((c) => c.key).join(' ') !== WEIGHT_CELLS.map((c) => c.key).join(' ')) {
  throw new Error(
    'data/case-illustrations.ts: клетки страницы кейса «site-v3» идут в другом порядке ' +
    'или несут другие ключи, чем клетки главной — рисунок перестал быть одним и тем же.',
  );
}

/** Веса страниц-хозяев не «home», по ключу хозяина. Английской версии у
 *  кейса нет (см. `pageWeight.ts`, комментарий рядом с `CASE_PAGE_WEIGHT_KB_EN`
 *  об её отсутствии) — поэтому таблица ведёт по одному числу на хозяина, а
 *  не по языку: вызывать её с `locale === 'en'` для страницы кейса не должно
 *  быть возможности, и `weightIllustration()` ниже проверяет это явно, а не
 *  молча читает `undefined`. */
const CASE_HOST_WEIGHT_KB: Readonly<Record<Exclude<WeightIllustrationHost, 'home'>, number>> = {
  'case-site-v3': CASE_PAGE_WEIGHT_KB,
};

const CASE_HOST_CELLS: Readonly<Record<Exclude<WeightIllustrationHost, 'home'>, readonly WeightCell[]>> = {
  'case-site-v3': CASE_SITE_V3_WEIGHT_CELLS,
};

export function weightIllustration(locale: Locale, host: WeightIllustrationHost = 'home') {
  if (host === 'home') {
    return {
      cells: WEIGHT_CELLS_BY_LOCALE[locale],
      /* Кратность считается от веса СВОЕЙ страницы: английская версия легче
         русской на 18 КБ (разбор — у `PAGE_WEIGHT_KB_EN`), и брать чужое
         число значило бы печатать на рисунке вывод из чужого замера.
         Сегодня обе версии дают «×5»; разойдись они — рисунки скажут разное,
         и это будет правдой. */
      multiplier: weightMultiplier(pageWeightKb(locale)),
      multiplierPhrase: weightMultiplierPhrase(pageWeightKb(locale), locale),
    };
  }

  if (locale !== 'ru') {
    throw new Error(
      `data/case-illustrations.ts: weightIllustration('${locale}', '${host}') — у страницы ` +
      'кейса нет английской версии (`i18n/locales.ts`, BILINGUAL_PATHS не несёт `/cases/…`), ' +
      'считать вес и время не из чего.',
    );
  }

  const weightKb = CASE_HOST_WEIGHT_KB[host];
  return {
    cells: CASE_HOST_CELLS[host],
    /* Кратность и слово выводятся из веса ХОЗЯИНА тем же расчётом, что и у
       главной (правка 3 раздела 4.6) — не отдельной копией формулы. */
    multiplier: weightMultiplier(weightKb),
    multiplierPhrase: weightMultiplierPhrase(weightKb, locale),
  };
}

export const WEIGHT_ILLUSTRATION = {
  cells: WEIGHT_CELLS,
  /** Кратность цифрой — «6×» в выводе внизу. */
  multiplier: WEIGHT_MULTIPLIER,
  /** Она же словами — «в шесть раз легче». Выведена, не написана. */
  multiplierPhrase: WEIGHT_MULTIPLIER_PHRASE,
  // Поле `linkLabel` (оговорка «ПОЛНАЯ ЗАГРУЗКА ПРИ 10 МБИТ/С») здесь БОЛЬШЕ
  // НЕТ. Правка владельца 2026-08-21 сняла подпись условия замера с
  // рисунка целиком — решение осознанное, времена остаются без названного
  // канала.
} as const;

// ---------------------------------------------------------------------
// Иллюстрация 2 — «Одна труба, четыре отвода» (кейс «Заявка-Хаб», бриф
// раздел 4). Источник — `50-code/zayavka-hub/README.md`: три источника
// заявки, четыре канала доставки, возврат при сбое.
// ---------------------------------------------------------------------
export interface FlowSource {
  /** Подпись источника — дословно из README (форма/бот/лендинг). */
  label: string;
}

/** Три источника заявки, в порядке README (строки 11–12, 17, 30). */
export const FLOW_SOURCES: readonly FlowSource[] = [
  { label: 'ФОРМА' },
  { label: 'БОТ' },
  { label: 'ЛЕНДИНГ' },
];

export interface DeliveryChannel {
  /** Подпись канала — дословно из `data/cases.ts` (описание Заявки-Хаба) и
   *  `02-texts.md`, секция 5: «почта, CRM, таблицы, Telegram». Никаких
   *  названий чужих сервисов (README.md:105) — это вебхук и CSV-файл, не
   *  интеграция с конкретным продуктом. */
  label: string;
}

/** Ровно четыре канала доставки, в порядке текста кейса. */
export const DELIVERY_CHANNELS: readonly DeliveryChannel[] = [
  { label: 'ПОЧТА' },
  { label: 'CRM' },
  { label: 'ТАБЛИЦЫ' },
  { label: 'TELEGRAM' },
];

/** Подпись возврата при сбое — без цифры: число попыток настраивается
 *  `MAX_DELIVERY_ATTEMPTS` (README.md:94), фиксированного числа не
 *  существует (бриф, раздел 4.2). */
export const FLOW_RETRY_LABEL = 'НЕ ДОШЛО — ПОВТОР';

// ---------------------------------------------------------------------
// Иллюстрация 3 — «Пример диалога» (кейс «ИИ-консультант»). Сценарий
// клиента: бот отвечает покупателю груминг-салона (решение владельца
// 2026-08-13). Салон безымянный — выдуманные названия организаций запрещены
// (00-overview, раздел 7).
//
// Состав переписки переработан 2026-08-19 по эскизу и решениям владельца:
// вместо четырёх реплик — РОВНО ОДНА пара «вопрос — отказ со ссылкой на
// источник», дословно продиктованная владельцем. Прежние четыре реплики были
// написаны здесь и владельцем построчно не утверждались; эти — утверждены,
// и правятся только с его слов.
//
// Метки поля («ПРИМЕР ДИАЛОГА · МАТЕРИАЛЫ ГРУМИНГ-САЛОНА») больше нет:
// владелец снял её как «абсолютно лишнюю информацию, которая и так лежит на
// поверхности» — рядом с рисунком стоит заголовок кейса. Вместе с константой
// снято и объяснение, зачем она была нужна: мёртвых объяснений в файле не
// остаётся.
// ---------------------------------------------------------------------
export type DialogueRole = 'visitor' | 'bot';

export interface DialogueLine {
  role: DialogueRole;
  text: string;
  /** Чип источника — только у ответа: он и есть доказательство тезиса кейса
   *  (ассистент отказывает, опираясь на материалы, а не сочиняет). */
  source?: string;
  /** Подпись под пузырём — часть правдоподобия окна переписки, а не факт о
   *  кейсе: время суток ничего не утверждает и ничем не проверяется. Цифры
   *  живут ТОЛЬКО здесь, в тексте реплик они запрещены сторожем ниже. */
  meta: string;
}

/** Шапка окна: слева состояние, справа имя собеседника. Никакой организации
 *  по имени в чате не появляется — только роль. */
export const DIALOGUE_STATUS_LABEL = 'Онлайн';
export const DIALOGUE_WINDOW_TITLE = 'ИИ-консультант';

/** Подсказка строки ввода — дословно, три точки, как написал владелец.
 *  Живёт константой здесь, а не строкой в разметке
 *  `CaseDialogueIllustration.astro`. */
export const DIALOGUE_INPUT_PLACEHOLDER = 'Напишите сообщение...';

/** Ровно две реплики: вопрос посетителя и честный отказ ассистента с чипом
 *  источника. Текст продиктован владельцем 2026-08-19 дословно — правки сюда
 *  и только с его слов, не в разметку компонента. */
export const DIALOGUE_LINES: readonly DialogueLine[] = [
  {
    role: 'visitor',
    text: 'Можно записать овчарку к вам на стрижку?',
    meta: 'Отправлено, 12:20',
  },
  {
    role: 'bot',
    text: 'Нет, мы не стрижем овчарок.',
    source: 'СПИСОК СОБАК',
    meta: '12:20',
  },
];

// ---------------------------------------------------------------------
// Сторожа инвариантов — падают на сборке, а не в проде (бриф, раздел 2.5).
// ---------------------------------------------------------------------
if (FLOW_SOURCES.length !== 3) {
  throw new Error('data/case-illustrations.ts: иллюстрация 2 несёт ровно три источника.');
}
if (DELIVERY_CHANNELS.length !== 4) {
  throw new Error('data/case-illustrations.ts: иллюстрация 2 несёт ровно четыре канала доставки.');
}
if (/google|sheets|bitrix|amocrm|битрикс|амоцрм/i.test(DELIVERY_CHANNELS.map((c) => c.label).join(' '))) {
  throw new Error(
    'data/case-illustrations.ts: канал доставки назван чужим сервисом — запрещено ' +
    '(README.md:105 — это вебхук и CSV-файл, а не интеграция с конкретным продуктом).',
  );
}
if (DIALOGUE_LINES.length !== 2) {
  throw new Error(
    'data/case-illustrations.ts: иллюстрация 3 несёт ровно две реплики — вопрос и ответ ' +
    '(решение владельца 2026-08-19; четыре реплики сняты целиком).',
  );
}
DIALOGUE_LINES.forEach((line, i) => {
  const expectedRole: DialogueRole = i % 2 === 0 ? 'visitor' : 'bot';
  if (line.role !== expectedRole) {
    throw new Error(
      `data/case-illustrations.ts: реплика ${i} — «${line.role}», ожидалась ` +
      `«${expectedRole}» (реплики обязаны чередоваться посетитель/бот).`,
    );
  }
  if (!line.meta.trim()) {
    throw new Error(`data/case-illustrations.ts: у реплики ${i} нет подписи времени.`);
  }
});
if (DIALOGUE_LINES.some((line) => /[0-9₽]/.test(line.text))) {
  throw new Error(
    'data/case-illustrations.ts: в выдуманном диалоге не может быть числа — его нечем ' +
    'проверить. Время суток живёт в поле `meta`, оно ничего не утверждает.',
  );
}
if (DIALOGUE_LINES.some((line) => /₽/.test(line.meta))) {
  throw new Error('data/case-illustrations.ts: подпись времени не место для цены.');
}
if (!/^Нет[,.]/.test(DIALOGUE_LINES[1].text)) {
  throw new Error(
    'data/case-illustrations.ts: ответ обязан оставаться честным отказом — иначе ' +
    'консультант ничем не отличается от выдумывающего, и рисунок перестаёт ' +
    'доказывать тезис кейса.',
  );
}
if (!DIALOGUE_LINES[1].source?.trim()) {
  throw new Error(
    'data/case-illustrations.ts: у ответа снят чип источника — единственный элемент ' +
    'рисунка, который показывает опору на материалы.',
  );
}


/* Четыре клетки, по две на сторону, в порядке «время, потом вес» — состав
   композиции владельца. Рисунок с тремя клетками или с перепутанными
   сторонами собираться не должен: раскладка держится на этом порядке
   (левая колонка — наша, правая — чужая), а не на ручной расстановке. */
/* Проверяются все три набора клеток иллюстрации 1: главная (ru/en) и
   страница кейса `site-v3` — тот же инвариант, три хозяина, один рисунок. */
const ALL_WEIGHT_CELL_SETS: ReadonlyArray<readonly WeightCell[]> = [
  WEIGHT_CELLS, WEIGHT_CELLS_EN, CASE_SITE_V3_WEIGHT_CELLS,
];
for (const cells of ALL_WEIGHT_CELL_SETS) {
  if (cells.length !== 4) {
    throw new Error('data/case-illustrations.ts: иллюстрация 1 несёт ровно четыре числа.');
  }
  if (cells.map((c) => c.side).join(' ') !== 'ours typical ours typical') {
    throw new Error(
      'data/case-illustrations.ts: клетки иллюстрации 1 обязаны чередоваться ' +
      '«наша / чужая» — на этом держится раскладка в две колонки.',
    );
  }
}
/* Точка в шаблоне ниже — английский разделитель дробной части («0.4 s»), а
   не «любой символ»: класс `[\d.,]` перечисляет цифры, точку и запятую. Все
   версии рисунка обязаны укладываться в один шаблон, потому что читает его
   один и тот же счётчик на прокрутке (`CaseWeightIllustration.astro`). */
if (ALL_WEIGHT_CELL_SETS.flat().some((c) => !/^[\d.,]+\s\S/.test(c.value))) {
  throw new Error(
    'data/case-illustrations.ts: значение клетки обязано начинаться с числа и нести ' +
    'единицу в той же строке — счётчик на прокрутке переписывает только цифры, ' +
    'а гейт читает «400 КБ» цельной строкой.',
  );
}
