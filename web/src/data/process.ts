// РУЧНОЙ ФАЙЛ — по образцу data/terms.ts, не генерируется.
//
// Источник чисел — PRICING.md (условия оплаты) и SERVICES.md (гарантийный
// срок). Разметка секций 7 и 8 (`components/home/Process.astro`,
// `Guarantees.astro`) не хранит числа сама (план `02-home-plan.md`, задача
// 11): «50%» и «70 000 ₽» не вписаны в компонент буквально — они читаются
// отсюда, и правка PRICING.md остаётся правкой одного места.
//
// Текст обеих секций — дословно из `70-workshop/specs/site-v3/02-texts.md`,
// секции 7 и 8, вместе с блоками «что нельзя менять при правке»:
//   - шаг 5 секции 7 намеренно короткий — полная формулировка гарантии
//     живёт в секции 8, чтобы один факт не стоял дважды на расстоянии
//     экрана;
//   - формулировка оплаты обязана нести оговорку про 70 000 ₽ — «по вехам»
//     без неё шире условия PRICING.md и на сайте становится неправдой;
//   - гарантии срока деньгами нет и договор не упоминается — его не
//     существует (D-019).
//
// Пятой гарантией «Сколько это занимает» здесь до 2026-08-20 стоял перенос
// из снятой секции 6 «Что можно проверить» (D-030). Владелец снял её правкой
// 2026-08-20 — вместе с обоими абзацами, включая довод про студии. Вместе с
// ней ушло поле `note` интерфейса `Guarantee` и разметка под второй абзац
// (`Guarantees.astro`): других записей с двумя абзацами не было, и мёртвого
// поля «на случай возврата» здесь не остаётся — код лежит в истории
// репозитория.
//
// Что при этом ушло со страницы фактически: сроки «2–4 дня» и «2–3 недели»
// в ЭТОЙ форме. Срок работ страница по-прежнему называет — таблицей первого
// экрана из `data/terms.ts` («от 2–4 дней»); формулировки «2–3 недели» на
// сайте после снятия не остаётся нигде.

/** Доля первого платежа в процентах — единственное место, где она названа
 *  числом; разметка читает отсюда, а не хранит «50%» буквально. */
import { assertParallel, type Locale } from '../i18n/locales';

export const DOWN_PAYMENT_PERCENT = 50;

/** Порог, с которого оплата идёт по вехам, а не двумя половинами. Строка, а
 *  не число: разметка вставляет её как есть, с «₽» и разделителем тысяч —
 *  ровно как в PRICING.md. */
export const MILESTONE_THRESHOLD = '70 000 ₽';

/** Источник условий оплаты — для сверки и для теста внутренней целостности
 *  этого файла. */
export const PAYMENT_SOURCE =
  'PRICING.md:103 — раздел «Отдельные позиции», строка «Оплата: 50% старт / ' +
  '50% сдача; от 70 000 ₽ — по вехам.»';

/** Гарантийный срок в днях. Число уже записано в SERVICES.md — эта задача
 *  его не вводит, только читает (D-021, закрыто 2026-08-11).
 *
 *  Цифрой на странице срок больше не стоит: итоговую полосу «30 дней»
 *  секции 7 сняла правка владельца 2026-08-20. Срок звучит словом — в шаге
 *  5 секции 7 и в гарантии «Тридцать дней на недочеты» секции 8. Константа
 *  осталась единственной машинной привязкой срока к `SERVICES.md:151`, и
 *  работу несёт через сторож в `process.test.ts` («гарантийный срок:
 *  WARRANTY_DAYS и словесная форма в текстах»): смена числа здесь роняет
 *  тесты до тех пор, пока словесная форма в текстах не приведена к нему. */
export const WARRANTY_DAYS = 30;

/** Источник гарантийного срока — для сверки и для теста внутренней
 *  целостности этого файла. */
export const WARRANTY_SOURCE =
  'SERVICES.md:151 — «Недочёты после сдачи по согласованному ТЗ исправляю ' +
  'бесплатно 30 дней с даты сдачи…»';

/** Дата, когда эти числа в последний раз сверены с PRICING.md и SERVICES.md
 *  руками (тот же формат, что `terms.ts`). */
export const CHECKED_AT = '2026-08-12';

export interface ProcessStep {
  /** Заголовок шага — дословно из 02-texts.md, без порядкового номера внутри
   *  строки (правка `02-process-options.md`, раздел 3, пункт 2, вариант
   *  П2-Б: номер несёт узел на оси в `Process.astro`, а не текст заголовка —
   *  иначе нумерация задвоилась бы). Порядок несёт сам массив. */
  title: string;
  text: string;
}

/** Пять шагов секции 7, в порядке спеки. Шаг 5 намеренно короткий — полная
 *  формулировка гарантии живёт в `GUARANTEES` ниже. */
export const PROCESS_STEPS: readonly ProcessStep[] = [
  {
    title: 'Разбор задачи',
    // Сокращён 2026-08-19 по мере образца (~73 знака в строке): 211 знаков
    // давали три строки против двух у шагов 2–5 — из потолка выбивался
    // только первый. Ушёл ровно один факт: перечень самих вопросов
    // («что сейчас, что не работает, кто ещё этим занимается, какой
    // бюджет»), согласовано с владельцем. Фраза «делать ничего не надо.
    // Тогда я так и говорю» неприкосновенна (`02-texts.md`, секция 7,
    // «Что здесь нельзя менять») — сохранена дословно.
    text:
      'Пять вопросов и минут десять. Иногда выясняется, что задача ' +
      'закрывается тем, что у вас уже есть, и делать ничего не надо. Тогда ' +
      'я так и говорю.',
  },
  {
    title: 'Смета и план',
    text:
      'Называю вилку срока и цены. Потом — предложение с зафиксированным ' +
      'объемом: что делаю, чего не делаю, сколько раундов правок включено.',
  },
  {
    title: 'Работа с показом по ходу',
    text:
      'Показываю результат по ходу, а не в конце: чтобы «это не то» ' +
      'выяснилось на второй день, а не на сдаче.',
  },
  {
    title: 'Сдача и передача',
    text:
      'Показываю, как пользоваться, и передаю проект целиком. Что именно ' +
      'получаете — в гарантиях ниже.',
  },
  {
    title: 'Тридцать дней после сдачи',
    text:
      'Тридцать дней остаюсь на связи по недочетам — что покрыто, ' +
      'написано ниже.',
  },
];

export interface Guarantee {
  title: string;
  text: string;
}

/** Четыре гарантии секции 8, в порядке спеки: пятую («Сколько это
 *  занимает») снял владелец правкой 2026-08-20. Первая построена из чисел
 *  выше — литералов внутри строки нет. */
export const GUARANTEES: readonly Guarantee[] = [
  {
    title: 'Оплата половинами',
    text:
      `${DOWN_PAYMENT_PERCENT}% на старте, ${DOWN_PAYMENT_PERCENT}% при ` +
      `сдаче. На работах от ${MILESTONE_THRESHOLD} — по вехам: платите за ` +
      'сделанный кусок, а не вперед за все целиком.',
  },
  {
    title: 'Исходники и инструкция — ваши',
    text:
      'После сдачи вы получаете код, инструкцию по развертыванию и все ' +
      'доступы. Ничего не остается «на стороне разработчика».',
  },
  {
    title: 'Обычный стек, без привязки ко мне',
    text:
      'Никаких самописных редакторов и закрытых панелей, которые понимаю ' +
      'только я. Хотите проверить — отдайте код любому разработчику на ' +
      'оценку, он разберется.',
  },
  {
    title: 'Тридцать дней на недочеты',
    text:
      'Все, что расходится с согласованным ТЗ, исправляю бесплатно ' +
      'тридцать дней после сдачи. Новые пожелания сверх ТЗ считаются ' +
      'отдельно, по ставке, и обсуждаем мы их заранее.',
  },
];

/* ─────────────────────────── Английская версия ────────────────────────────
 *
 * Те же пять шагов и те же четыре гарантии — обещания, а не текст, поэтому
 * переведены так, чтобы их можно было держать слово в слово. Проценты и
 * порог вехи подставляются из тех же констант, что и в русской версии
 * (`DOWN_PAYMENT_PERCENT`, `MILESTONE_THRESHOLD`): второго числа в тексте
 * нет ни на одном языке, и правка PRICING.md меняет обе версии разом.
 *
 * Валюта остаётся рублём: `MILESTONE_THRESHOLD` — цитата из
 * `10-offer/PRICING.md`, и пересчёт её в другую валюту дал бы число, которого
 * в прайсе нет. Меняется только слово вокруг числа: «от» → «from». */
const PROCESS_STEPS_EN: readonly ProcessStep[] = [
  {
    title: 'Working out the task',
    text:
      'Five questions and about ten minutes. Sometimes it turns out that ' +
      'what you already have covers the task and nothing needs building. ' +
      'Then that’s what I tell you.',
  },
  {
    title: 'Estimate and plan',
    text:
      'I give you a range for the timeline and the price. Then a proposal ' +
      'with the scope fixed: what I do, what I don’t do, how many rounds ' +
      'of revisions are included.',
  },
  {
    title: 'Work you can see as it goes',
    text:
      'I show the result along the way, not at the end — so that “this ' +
      'isn’t it” comes up on day two rather than at handover.',
  },
  {
    title: 'Handover',
    text:
      'I show you how to use it and hand over the whole project. Exactly ' +
      'what you get is in the guarantees below.',
  },
  {
    title: 'Thirty days after handover',
    text:
      'For thirty days I stay available for any defects — what’s covered ' +
      'is written below.',
  },
];

const GUARANTEES_EN: readonly Guarantee[] = [
  {
    title: 'Paid in halves',
    text:
      `${DOWN_PAYMENT_PERCENT}% at the start, ${DOWN_PAYMENT_PERCENT}% on ` +
      `delivery. On work from ${MILESTONE_THRESHOLD} — by milestones: you ` +
      'pay for the part that’s done, not up front for the whole thing.',
  },
  {
    title: 'The source code and the setup guide are yours',
    text:
      'After handover you get the code, the deployment instructions and ' +
      'every credential. Nothing is left “on the developer’s side”.',
  },
  {
    title: 'An ordinary stack, no lock-in to me',
    text:
      'No home-made editors and no closed panels that only I understand. ' +
      'Want to check? Hand the code to any developer for review — they’ll ' +
      'find their way around it.',
  },
  {
    title: 'Thirty days to fix defects',
    text:
      'Anything that departs from the agreed specification I fix free of ' +
      'charge for thirty days after handover. Anything new beyond the ' +
      'specification is quoted separately, at my hourly rate, and we agree ' +
      'on it in advance.',
  },
];

const STEPS_BY_LOCALE: Record<Locale, readonly ProcessStep[]> = {
  ru: PROCESS_STEPS, en: PROCESS_STEPS_EN,
};
const GUARANTEES_BY_LOCALE: Record<Locale, readonly Guarantee[]> = {
  ru: GUARANTEES, en: GUARANTEES_EN,
};
assertParallel('data/process.ts (шаги)', STEPS_BY_LOCALE);
assertParallel('data/process.ts (гарантии)', GUARANTEES_BY_LOCALE);

export function processSteps(locale: Locale): readonly ProcessStep[] {
  return STEPS_BY_LOCALE[locale];
}

export function guarantees(locale: Locale): readonly Guarantee[] {
  return GUARANTEES_BY_LOCALE[locale];
}

/* Пять шагов и четыре гарантии — числа из спеки, а не «сколько получилось».
   Сторож проверяет ОБА языка: список, из которого перевод потерял шаг, —
   та же поломка, что список из четырёх шагов. */
for (const [locale, steps] of Object.entries(STEPS_BY_LOCALE)) {
  if (steps.length !== 5) {
    throw new Error(`data/process.ts: секция 7 несёт ровно пять шагов (${locale}: ${steps.length}).`);
  }
}
for (const [locale, items] of Object.entries(GUARANTEES_BY_LOCALE)) {
  if (items.length !== 4) {
    throw new Error(`data/process.ts: секция 8 несёт ровно четыре гарантии (${locale}: ${items.length}).`);
  }
}
