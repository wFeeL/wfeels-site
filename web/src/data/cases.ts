// Секция 5 «Кейсы» — единственный источник её содержимого. Разметка
// (`components/home/Cases.astro`, `components/home/CaseRow.astro`) читает
// отсюда, а не хранит текст сама.
//
// Текст — дословно из `70-workshop/specs/site-v3/02-texts.md`, секция 5. Ни
// слова не менять при правке: формулировки утверждены владельцем, решения
// объяснены в блоке «Что здесь нельзя менять при правке» того же документа.
//
// Пять кейсов существуют, но главная показывает ОДИН — «Этот сайт».
//
// Так с правки владельца 2026-08-20: на главной остаётся единственный кейс,
// остальные уходят на страницу каталога (спека 04, её ещё нет). До неё
// «ИИ-консультант» и «Заявка-Хаб» стояли на главной вторым и третьим
// блоками (D-048, `04-cases-brief.md`, раздел 2.1), а до 2026-08-19 там же
// была «Фабрика ботов» — её владелец снял из данных целиком.
//
// Разница между этими двумя снятиями важна и выражена в данных: «Фабрики
// ботов» здесь нет ВООБЩЕ, а «ИИ-консультант» и «Заявка-Хаб» остаются
// записями с `onHome: false` — вместе с описанием и стеком, потому что их
// текст утверждён владельцем построчно (`02-texts.md`, секция 5) и его же
// возьмёт страница каталога. Их рисунки (`CaseFlowIllustration.astro`,
// `CaseDialogueIllustration.astro`) по той же причине остаются в коде: они
// перестали выводиться, а не исчезли.
//
// Правило чередования сторон (`homeOrder % 2 === 0`) от снятия не меняется,
// но при одном блоке зеркалить нечего — единственный блок нечётный, то есть
// обычный.
//
// SlotBook и Storefront ждут ту же спеку 04, но у них нет и описания: их
// карточная копия владельцем построчно не утверждена, и по рыбе не пишется.
//
// Меток происхождения нет нигде (общая спека, раздел 7), и слова «клиент»,
// «заказчик», «для компании» в описаниях запрещены — все кейсы собственные
// продукты, а не работа по оплаченному заказу (40-portfolio/CLAUDE.md).

import { assertParallel, type Locale } from '../i18n/locales';

export interface CaseCard {
  /** Устойчивое имя кейса. Ссылкой на `/cases/<slug>` оно БОЛЬШЕ НЕ
   *  становится: правка владельца 2026-08-20 сняла переход из блока, пока
   *  страницы кейса не существует, и адрес ушёл из обоих списков ожидаемых
   *  404 (`tests/e2e/links.spec.ts`, `tests/dist-home-links.test.ts`).
   *
   *  Поле при этом живое, а не осиротевшее: по нему `Cases.astro` подбирает
   *  блоку иллюстрацию и обе высоты поля, а `data/cases.test.ts` проверяет
   *  единственность имён. Оно же станет адресом страницы, когда её построит
   *  спека 04. */
  slug: string;
  /** Заголовок карточки — дословно из 02-texts.md. */
  title: string;
  /** Описание — дословно из 02-texts.md. Есть у кейса главной и у двух,
   *  снятых с неё 2026-08-20 (их текст утверждён и ждёт страницу каталога).
   *  У SlotBook и Storefront описания нет: их текст владельцем построчно не
   *  утверждён и по рыбе не пишется (план 02-home-plan.md, задача 1). */
  description?: string;
  /** Строка стека, моноширинная, латиницей — дословно из 02-texts.md. */
  stack?: string;
  /** Карточка показывается на главной. */
  onHome: boolean;
  /** Порядок карточки на главной. Стороны чередуются формулой
   *  `homeOrder % 2 === 0` (`Cases.astro` → `CaseRow.astro`), и формула
   *  остаётся на месте при одном блоке: она свойство раскроя, а не числа
   *  кейсов. Отсутствует у кейсов вне главной. */
  homeOrder?: number;
}

export const CASES: readonly CaseCard[] = [
  {
    slug: 'site-v3',
    title: 'Этот сайт',
    description:
      'Сайт, который сам является доказательством услуги: статическая ' +
      'сборка, две темы, два языка, форма заявки с уведомлением в ' +
      'Telegram. Многое из того, что здесь работает, входит в обычный заказ.',
    stack: 'Astro · Tailwind · FastAPI · Caddy',
    onHome: true,
    homeOrder: 1,
  },
  /* Снят с главной правкой владельца 2026-08-20 — вместе с «Заявкой-Хабом».
     Описание и стек остаются: текст утверждён, его возьмёт спека 04. */
  {
    slug: 'ai-consultant',
    title: 'ИИ-консультант',
    description:
      'Отвечает на вопросы по загруженным материалам и показывает, откуда ' +
      'взял ответ. Если ответа в материалах нет — говорит об этом, а не ' +
      'придумывает.',
    stack: 'RAG · Chroma · FastAPI',
    onHome: false,
  },
  {
    slug: 'zayavka-hub',
    title: 'Заявка-Хаб',
    description:
      'Заявки приходят из формы, из бота, с лендинга — и расходятся туда, ' +
      'где вы работаете: почта, CRM, таблицы, Telegram. Четыре канала ' +
      'доставки, повтор при сбое, панель со статусами.',
    stack: 'FastAPI · SQLite · Docker',
    onHome: false,
  },
  // Вне главной — только заголовок и адрес, см. комментарий в шапке файла.
  { slug: 'slotbook', title: 'SlotBook', onHome: false },
  { slug: 'storefront', title: 'Storefront', onHome: false },
];

/** Кейсы главной, в порядке `homeOrder`. С правки владельца 2026-08-20 он
 *  один — «Этот сайт»; сортировка и фильтр остаются, потому что описывают
 *  правило, а не сегодняшнее число записей. */
/* ─────────────────────────── Английская версия ────────────────────────────
 *
 * Собирается из русской, как и карточки услуг: `slug`, `onHome`, `homeOrder`
 * и `stack` берутся у русской записи и здесь не повторяются — переводится
 * только то, что читает человек. Строка стека уже латиницей и одинакова на
 * обоих языках по устройству (спека 02-home.md, раздел 6).
 *
 * Английский текст обязателен для КАЖДОГО кейса, включая снятые с главной:
 * иначе перевод забудут ровно в тот день, когда кейс на главную вернут. */

interface CaseText {
  title: string;
  description?: string;
}

const CASE_TEXT_EN: Record<string, CaseText> = {
  'site-v3': {
    title: 'This website',
    description:
      'A site that is itself the proof of the service: a static build, two ' +
      'themes, two languages, an enquiry form that notifies me in Telegram. ' +
      'Most of what works here is part of an ordinary order.',
  },
  'ai-consultant': {
    title: 'AI consultant',
    description:
      'Answers questions from the material it was given and shows where it ' +
      'took the answer from. If the answer is not in the material, it says ' +
      'so instead of inventing one.',
  },
  'zayavka-hub': {
    title: 'Enquiry Hub',
    description:
      'Enquiries arrive from a form, from a bot, from a landing page — and ' +
      'go out to wherever you work: inbox, CRM, spreadsheets, Telegram. ' +
      'Four delivery channels, a retry on failure, a dashboard with statuses.',
  },
  slotbook: { title: 'SlotBook' },
  storefront: { title: 'Storefront' },
};

const CASES_EN: readonly CaseCard[] = CASES.map((item) => {
  const text = CASE_TEXT_EN[item.slug];
  if (!text) {
    throw new Error(
      `data/cases.ts: у кейса «${item.slug}» нет английского текста. Перевод ` +
      'обязателен для каждого кейса, а не только для тех, что стоят на ' +
      'главной сегодня, — иначе его забудут в день возврата кейса.',
    );
  }
  if (Boolean(text.description) !== Boolean(item.description)) {
    throw new Error(
      `data/cases.ts: у кейса «${item.slug}» описание есть только на одном ` +
      'языке — блок перестал быть одним и тем же на двух версиях страницы.',
    );
  }
  return { ...item, title: text.title, description: text.description };
});

const CASES_BY_LOCALE: Record<Locale, readonly CaseCard[]> = { ru: CASES, en: CASES_EN };
assertParallel('data/cases.ts', CASES_BY_LOCALE);

export function cases(locale: Locale): readonly CaseCard[] {
  return CASES_BY_LOCALE[locale];
}

export function homeCases(locale: Locale = 'ru'): CaseCard[] {
  return cases(locale)
    .filter((c) => c.onHome)
    .sort((a, b) => (a.homeOrder ?? 0) - (b.homeOrder ?? 0));
}

/* Константы `CASES_CATALOG_HREF` здесь БОЛЬШЕ НЕТ, и это решение, а не
 * недосмотр. Она держала адрес `/cases` для кнопки «Все кейсы» под секцией
 * кейсов. Кнопку сняла та же правка владельца 2026-08-20: страницы по этому
 * адресу не существует, то есть кнопка вела в 404 — и дефект жил
 * незамеченным ровно потому, что сторож проверял наличие АДРЕСА в разметке,
 * а не наличие страницы по нему.
 *
 * Экспорт без читателя воспроизвёл бы ту же ловушку: адрес выглядел бы
 * действующим фактом сайта, оставаясь планом. План живёт в спеке 04, строка
 * — в истории репозитория; когда страница появится, константу вернут вместе
 * с ней и с кнопкой. */
