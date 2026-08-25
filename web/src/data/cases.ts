// Секция 5 «Кейсы» — единственный источник её содержимого. Разметка
// (`components/home/Cases.astro`, `components/home/CaseRow.astro`) читает
// отсюда, а не хранит текст сама.
//
// Текст «Этого сайта» и двух снятых блоков — дословно из
// `70-workshop/specs/site-v3/02-texts.md`, секция 5. Telegram Mini App
// добавлен отдельной командой владельца 2026-08-24; его актуальная копия
// зарегистрирована здесь вместе с остальными данными секции.
//
// Шесть кейсов существуют, главная показывает три: «Этот сайт»,
// «Telegram Mini App» и «Сайты».
//
// Правка владельца 2026-08-20 оставила на главной один кейс, остальные
// ушли на страницу каталога. Каталог и страницы содержательных кейсов
// опубликованы вместе с возвратом честных ссылок; SlotBook остаётся только
// внутренней записью, пока для него нет утверждённых описания и стека. До неё
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
// Правило чередования сторон (`homeOrder % 2 === 0`) от состава не меняется:
// первый блок обычный, второй зеркальный.
//
// SlotBook ждёт ту же спеку 04. Storefront возвращён на главную отдельной
// правкой владельца 2026-08-24: это второй полноширинный блок с тремя
// подтверждёнными вариантами витрины — Mariosa, Zayac и Yasmina.
//
// Меток происхождения нет нигде (общая спека, раздел 7), и слова «клиент»,
// «заказчик», «для компании» в описаниях запрещены. Классификация источников
// остаётся внутренним фактом портфолио и не превращается в публичный тезис
// блока (40-portfolio/CLAUDE.md).

import { assertParallel, type Locale } from '../i18n/locales';

export interface CaseCard {
  /** Устойчивое имя кейса и хвост адреса `/cases/<slug>`. Detail-страница
   *  выпускается только у записи с утверждёнными `description` и `stack`:
   *  одного имени недостаточно для честной индексируемой страницы. */
  slug: string;
  /** Заголовок карточки. */
  title: string;
  /** Описание. У SlotBook его нет: текст владельцем построчно не утверждён,
   *  поэтому запись не выходит в публичный каталог и по рыбе не дописывается
   *  (план 02-home-plan.md, задача 1). */
  description?: string;
  /** Строка стека, моноширинная, латиницей. */
  stack?: string;
  /** Карточка показывается на главной. */
  onHome: boolean;
  /** Порядок карточки на главной. Стороны чередуются формулой
   *  `homeOrder % 2 === 0` (`Cases.astro` → `CaseRow.astro`), и формула
   *  остаётся свойством раскроя, а не текущего числа кейсов. Отсутствует у
   *  кейсов вне главной. */
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
  {
    slug: 'storefront',
    title: 'Telegram Mini App',
    description:
      'Три магазина на одном продуктовом шаблоне: украшения, сумки из ' +
      'бусин и авторские игрушки. Каталог, карточка товара, корзина и ' +
      'оформление заказа адаптированы под нишу и формат Telegram Mini App.',
    stack: 'React · TypeScript · FastAPI · PostgreSQL',
    onHome: true,
    homeOrder: 2,
  },
  {
    slug: 'websites',
    title: 'Сайты',
    description:
      'Три сайта для разных задач: B2B-сервис, бутик-отель и галерея ' +
      'коллекционной мебели. В каждом показаны главная страница, ключевой ' +
      'раздел и целевое действие.',
    stack: 'UX/UI · Design systems',
    onHome: true,
    homeOrder: 3,
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
];

/** Кейсы главной, в порядке `homeOrder`. С правки владельца 2026-08-20 он
 *  был один; 2026-08-24 добавлены Telegram Mini App и три направления
 *  сайтов. */
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
      /* «Much», а не «Most»: русское «Многое» — осознанно осторожная
         формулировка, а «Most» утверждает большинство, и проверить его нечем
         — состав «обычного заказа» нигде не замерен. Найдено ревью выноса
         наружу 2026-08-22. */
      'Much of what works here is part of an ordinary order.',
  },
  storefront: {
    title: 'Telegram Mini App',
    description:
      'Three shops built on one product template: jewellery, beaded bags ' +
      'and handmade toys. The catalogue, product page, basket and checkout ' +
      'are adapted to each niche and to the Telegram Mini App format.',
  },
  websites: {
    title: 'Websites',
    description:
      'Three websites for different jobs: a B2B service, a boutique hotel ' +
      'and a collectible furniture gallery. Each shows the home page, a key ' +
      'section and the target action.',
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

export interface PublishedCase extends CaseCard {
  description: string;
  stack: string;
}

/** Единственная граница публикации: индексируемая страница получает только
 *  запись, у которой уже подтверждены и описание, и стек. Так SlotBook не
 *  превращается в пустую SEO-заглушку и не обрастает текстом по догадке. */
export function publishedCases(locale: Locale = 'ru'): PublishedCase[] {
  return cases(locale).filter((item): item is PublishedCase => (
    Boolean(item.description) && Boolean(item.stack)
  ));
}

export const CASES_CATALOG_HREF = '/cases';

export function caseHref(slug: string): string {
  return `${CASES_CATALOG_HREF}/${slug}`;
}
