// РУЧНОЙ ФАЙЛ — по образцу data/terms.ts, не генерируется.
//
// Источник чисел — PRICING.md (условия оплаты) и SERVICES.md (гарантийный
// срок). Договорная последовательность сверена с публичными условиями и
// шаблонами сделки. Комплект переехал 2026-08-26 из этого репозитория в
// базу знаний: `20-sales/legal/` (решения D-110, D-113). В публичном
// репозитории сайта остались только `docs/legal/public/` — те документы,
// что и так напечатаны на страницах.
//
// Основа секций пришла из `70-workshop/specs/site-v3/02-texts.md`,
// а договорные формулировки обновлены по юридическому комплекту 2026-08-25
// (ныне `20-sales/legal/` в базе):
//   - шаг 5 секции 7 намеренно короткий — полная формулировка гарантии
//     живёт в секции 8, чтобы один факт не стоял дважды на расстоянии
//     экрана;
//   - гарантии срока деньгами нет: договор фиксирует срок и условия его
//     изменения, но не обещает автоматическую неустойку или возврат;
//   - состав передачи и момент перехода прав задают договор и ТЗ, поэтому
//     обещание «всё целиком сразу» без этой границы было бы шире документов.
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

/** Доля первого платежа в процентах — машинная привязка к каноническому прайсу. */
import { assertParallel, type Locale } from '../i18n/locales';

export const DOWN_PAYMENT_PERCENT = 50;

/** Порог, с которого оплата идёт по вехам, а не двумя половинами. Строка, а
 *  не число: разметка вставляет её как есть, с «₽» и разделителем тысяч —
 *  ровно как в PRICING.md. */
export const MILESTONE_THRESHOLD = '70 000 ₽';

/** Источник условий оплаты — для сверки и для теста внутренней целостности
 *  этого файла. */
export const PAYMENT_SOURCE =
  'PRICING.md:123–124 — раздел «Отдельные позиции», строка «Оплата: 50% после согласования сметы ' +
  'и подписания договора / 50% перед запуском; от 70 000 ₽ — по вехам.»';

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
export const CHECKED_AT = '2026-08-25';

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
    title: 'Смета, договор и ТЗ',
    text:
      'После короткого обсуждения готовлю смету и ТЗ: фиксируем результат, ' +
      'этапы, сроки, цену и критерии приемки. Работу начинаю после подписания ' +
      'договора, первого платежа и передачи нужных материалов.',
  },
  {
    title: 'Работа с показом по ходу',
    text:
      'Показываю результат по ходу, а не в конце: чтобы «это не то» ' +
      'выяснилось на второй день, а не на сдаче.',
  },
  {
    title: 'Сдача и приемка',
    text:
      'Передаю результат в согласованном формате, показываю, как им ' +
      'пользоваться, и оформляем приемку так, как записано в договоре. ' +
      'Состав передачи заранее указан в ТЗ.',
  },
  {
    title: 'Тридцать дней после приемки',
    text:
      'Тридцать дней исправляю расхождения с согласованным ТЗ бесплатно. ' +
      'Границы гарантии — ниже.',
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
    title: 'Цена, сроки и объем — в договоре',
    text:
      'До начала работы фиксируем в договоре и ТЗ результат, этапы, сроки, ' +
      'цену и критерии приемки. Дополнительная работа начинается только ' +
      'после письменного согласования новой цены и срока.',
  },
  {
    title: 'Состав передачи — в ТЗ',
    text:
      'В ТЗ заранее перечисляем, что вы получите: результат, исходники, ' +
      'инструкции и доступы. Права на оплаченный результат переходят в ' +
      'объеме и в момент, указанных в договоре.',
  },
  {
    title: 'Обычный стек, без привязки ко мне',
    text:
      'Никаких самописных редакторов и закрытых панелей, которые понимаю ' +
      'только я. Хотите проверить — отдайте код любому разработчику на ' +
      'оценку, он разберется.',
  },
  {
    title: 'Тридцать дней на исправления',
    text:
      'В течение тридцати дней с даты приемки бесплатно исправляю ' +
      'воспроизводимые расхождения с согласованным ТЗ. Новые функции и ' +
      'изменения требований оцениваются отдельно.',
  },
];

/* ─────────────────────────── Английская версия ────────────────────────────
 *
 * Те же пять шагов и те же четыре гарантии — обещания, а не текст, поэтому
 * переведены так, чтобы их можно было держать слово в слово. Текст оплаты живет в секции цен;
 * здесь фиксируются договорный порядок, приемка и гарантия. */
const PROCESS_STEPS_EN: readonly ProcessStep[] = [
  {
    title: 'Working out the task',
    text:
      'Five questions and about ten minutes. Sometimes it turns out that ' +
      'what you already have covers the task and nothing needs building. ' +
      'Then that’s what I tell you.',
  },
  {
    title: 'Estimate, contract and specification',
    text:
      'After a short discussion, I prepare the estimate and specification, ' +
      'setting out the deliverable, stages, timeline, price and acceptance ' +
      'criteria. Work starts once the contract is signed, the first payment ' +
      'arrives and I have the required materials.',
  },
  {
    title: 'Work you can see as it goes',
    text:
      'I show the result along the way, not at the end — so that “this ' +
      'isn’t it” comes up on day two rather than at handover.',
  },
  {
    title: 'Handover and acceptance',
    text:
      'I deliver the result in the agreed format, show you how to use it ' +
      'and record acceptance as set out in the contract. The handover ' +
      'package is listed in the specification in advance.',
  },
  {
    title: 'Thirty days after acceptance',
    text:
      'For thirty days, I fix reproducible discrepancies from the agreed ' +
      'specification at no charge. The limits of the warranty are set out below.',
  },
];

const GUARANTEES_EN: readonly Guarantee[] = [
  {
    title: 'Price, timeline and scope are in the contract',
    text:
      'Before work starts, the contract and specification set out the ' +
      'deliverable, stages, timeline, price and acceptance criteria. Extra ' +
      'work starts only after its new price and timeline are agreed in writing.',
  },
  {
    title: 'The handover package is set out in the specification',
    text:
      'The specification lists in advance what you receive: the deliverable, ' +
      'source files, instructions and credentials. Rights to the paid-for ' +
      'result transfer to the extent and at the time stated in the contract.',
  },
  {
    title: 'An ordinary stack, no lock-in to me',
    text:
      'No home-made editors and no closed panels that only I understand. ' +
      'Want to check? Hand the code to any developer for review — they’ll ' +
      'find their way around it.',
  },
  {
    title: 'Thirty days for defect fixes',
    text:
      'For thirty days from acceptance, I fix reproducible discrepancies ' +
      'from the agreed specification at no charge. New features and changes ' +
      'to the requirements are quoted separately.',
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
