// Четыре карточки-группы секции 3 «Что я делаю» — единственный источник их
// содержимого. Разметка (`components/home/Services.astro`,
// `components/home/ServiceCard.astro`) читает отсюда, а не хранит текст сама:
// второй ручной перечень тех же карточек в другом месте расходится молча.
//
// Текст — дословно из `70-workshop/specs/site-v3/02-texts.md`, секция 3.
// Ни слова не менять при правке файла: формулировки утверждены владельцем
// 2026-08-11, и у большинства решений есть обоснование в блоке «Что здесь
// нельзя менять при правке» той же спеки.
//
// Адреса посадочных (`/services/...`) страниц — спека 03, которой ещё нет:
// адреса ниже предварительные, подобраны по смыслу названия услуги, а не
// выведены из документа. Спека 03 вправе их переименовать; до этого они
// объявлены ожидаемой 404 в `tests/e2e/links.spec.ts`.

import { assertParallel, type Locale } from '../i18n/locales';

export interface ServiceLink {
  /** Подпись ссылки — дословно из 02-texts.md. */
  text: string;
  /** Предварительный адрес посадочной — см. предупреждение выше. */
  href: string;
  /** Код услуги из `10-offer/SERVICES.md` (S1…S9) — единственный источник
   *  значения для выпадающего списка формы (`components/LeadForm.astro`,
   *  правка «Расскажите о задаче», задача 18). Бэкенд (`api/app/schemas.py`,
   *  `SERVICE_LABELS`) ждёт РОВНО эти коды и порядок групп — второй список
   *  кодов не заводится нигде, второй список текста услуг — тоже. */
  code: string;
}

export type ServiceIconKind = 'sites' | 'automation' | 'ai' | 'telegram';

export interface ServiceGroup {
  icon: ServiceIconKind;
  /** Заголовок группы — дословно из 02-texts.md. */
  title: string;
  /** Описание в две строки — дословно из 02-texts.md. */
  description: string;
  /** 3–4 пункта по 3–5 слов — дословно из 02-texts.md. */
  points: readonly string[];
  /** Ссылки на посадочные, в порядке 02-texts.md. */
  links: readonly ServiceLink[];
  /** Строка стека, моноширинная, латиницей (спека 02-home.md, раздел 6). */
  stack: string;
}

/** Порядок групп — Сайты · Автоматизация и интеграции · ИИ · Telegram.
 *  Telegram стоит четвёртым намеренно (02-texts.md, «Что здесь нельзя менять
 *  при правке»): сильнейшие кейсы и самый демпинговый рынок, продаётся как
 *  дополнительный канал к сайту, а не как основная услуга. */
export const SERVICE_GROUPS: readonly ServiceGroup[] = [
  {
    icon: 'sites',
    title: 'Сайты',
    description:
      'Лендинг, многостраничник или доработка того, что уже есть. От макета ' +
      'до запуска на вашем домене.',
    points: [
      'Дизайн под ваш бренд',
      'Адаптив под телефон',
      'Форма заявки с уведомлением',
      'SEO-обвязка и деплой с HTTPS',
    ],
    links: [
      { text: 'Сайт под ключ', href: '/services/website', code: 'S1' },
      { text: 'Доработка и поддержка', href: '/services/website-support', code: 'S2' },
      { text: 'Аудит сайта', href: '/services/website-audit', code: 'S3' },
    ],
    stack: 'Astro · React · FastAPI',
  },
  {
    icon: 'automation',
    title: 'Автоматизация и интеграции',
    description:
      'Заявки из формы, из бота, с лендинга — в одно место. Оттуда в CRM, ' +
      'почту, таблицы и Telegram.',
    points: [
      'Одна точка приема заявок',
      'Доставка туда, где вы работаете',
      'Повтор при сбое — ничего не теряется',
      'Прием оплат',
    ],
    links: [
      { text: 'Прием заявок и интеграции', href: '/services/integrations', code: 'S5' },
      { text: 'Панель обращений', href: '/services/admin-panel', code: 'S6' },
      { text: 'Backend и API', href: '/services/backend-api', code: 'S7' },
    ],
    stack: 'FastAPI · PostgreSQL · Docker',
  },
  {
    icon: 'ai',
    title: 'ИИ',
    description:
      'Консультант, который отвечает клиентам по вашим материалам. И ' +
      'честно говорит «не знаю», когда ответа в них нет.',
    points: [
      'Отвечает по вашим документам',
      'Показывает, откуда взял',
      'Честное «не знаю»',
      'Ставится на сайт одним тегом',
    ],
    links: [
      { text: 'ИИ-консультант по материалам', href: '/services/ai-consultant', code: 'S4' },
    ],
    stack: 'RAG · Chroma · Embed',
  },
  {
    icon: 'telegram',
    title: 'Telegram',
    description:
      'Бот или полноценный интерфейс внутри мессенджера — если ваши ' +
      'клиенты уже там.',
    points: [
      'Прием заявок и уведомления',
      'Запись, каталог, анкета',
      'Админка и роли',
      'Оплата внутри',
    ],
    links: [
      { text: 'Telegram-бот под задачу', href: '/services/telegram-bot', code: 'S8' },
      { text: 'Telegram Mini App', href: '/services/telegram-miniapp', code: 'S9' },
    ],
    stack: 'aiogram · Mini Apps',
  },
];

/* Строка ниш («Под вашу отрасль: …», тип `NicheLink`, константа `NICHES`)
 * снята правкой владельца 2026-08-21: ссылки вели на несуществующие
 * нишевые страницы, и в ближайшее время их не будет. */

/** Тонкий каталог всех девяти услуг (спека 03, ещё не построен). */
/* ─────────────────────────── Английская версия ────────────────────────────
 *
 * Английские карточки НЕ перечисляются вторым списком — они СОБИРАЮТСЯ из
 * русских, и это главное решение файла. Второй ручной перечень тех же
 * четырёх групп разошёлся бы молча: пропавшая ссылка, лишний пункт или
 * подменённый код услуги не уронили бы ни сборку, ни тесты, а на странице
 * английская версия перестала бы быть той же страницей.
 *
 * Собранная версия не может ошибиться в машинных полях вовсе: `icon`, `href`
 * и `code` берутся у русской группы как есть — переводится только то, что
 * читает человек. Число пунктов и число ссылок сверяется здесь же и роняет
 * сборку, а не прогон тестов.
 *
 * Коды `S1…S9` остаются едиными для обоих языков: их ждёт бэкенд
 * (`api/app/schemas.py`, `SERVICE_LABELS`), и заявка с английской страницы
 * приходит с тем же кодом, что с русской. */

interface ServiceGroupText {
  title: string;
  description: string;
  /** Пункты в том же порядке и в том же числе, что у русской группы. */
  points: readonly string[];
  /** Подписи ссылок в порядке ссылок русской группы; адреса и коды берутся
   *  оттуда и здесь не повторяются. */
  links: readonly string[];
}

const SERVICE_TEXT_EN: Record<ServiceIconKind, ServiceGroupText> = {
  sites: {
    title: 'Websites',
    description:
      'A landing page, a multi-page site, or work on the one you already ' +
      'have. From the layout to launch on your own domain.',
    points: [
      'Design that matches your brand',
      'Works properly on a phone',
      'Enquiry form with notifications',
      'SEO basics and deploy over HTTPS',
    ],
    links: ['Turnkey website', 'Changes and support', 'Website audit'],
  },
  automation: {
    title: 'Automation and integrations',
    description:
      'Enquiries from a form, from a bot, from a landing page — all in one ' +
      'place. And from there into your CRM, inbox, spreadsheets and Telegram.',
    points: [
      'One place where enquiries land',
      'Delivered where you actually work',
      'Retried on failure — nothing is lost',
      'Taking payments',
    ],
    links: ['Enquiry intake and integrations', 'Enquiry dashboard', 'Backend and API'],
  },
  ai: {
    title: 'AI',
    description:
      'A consultant that answers your clients’ questions from your own ' +
      'materials. And says “I don’t know” when the answer isn’t in them.',
    points: [
      'Answers from your documents',
      'Shows you where the answer came from',
      'An honest “I don’t know”',
      'Added to the site with one tag',
    ],
    links: ['AI consultant on your materials'],
  },
  telegram: {
    title: 'Telegram',
    description:
      'A bot, or a full interface inside the messenger — if your clients ' +
      'are already there.',
    points: [
      'Enquiries and notifications',
      'Booking, catalogue, forms',
      'Admin panel and roles',
      'Payments inside',
    ],
    links: ['A custom Telegram bot', 'Telegram Mini App'],
  },
};

const SERVICE_GROUPS_EN: readonly ServiceGroup[] = SERVICE_GROUPS.map((group) => {
  const text = SERVICE_TEXT_EN[group.icon];
  if (text.points.length !== group.points.length) {
    throw new Error(
      `data/services.ts: у английской группы «${group.icon}» ${text.points.length} ` +
      `пунктов против ${group.points.length} русских — карточки перестали быть одной.`,
    );
  }
  if (text.links.length !== group.links.length) {
    throw new Error(
      `data/services.ts: у английской группы «${group.icon}» ${text.links.length} ` +
      `ссылок против ${group.links.length} русских — карточки перестали быть одной.`,
    );
  }
  return {
    ...group,
    title: text.title,
    description: text.description,
    points: text.points,
    links: group.links.map((link, i) => ({ ...link, text: text.links[i] })),
  };
});

const GROUPS_BY_LOCALE: Record<Locale, readonly ServiceGroup[]> = {
  ru: SERVICE_GROUPS,
  en: SERVICE_GROUPS_EN,
};
assertParallel('data/services.ts', GROUPS_BY_LOCALE);

/** Карточки услуг на языке страницы. Русский список остаётся доступен под
 *  прежним именем `SERVICE_GROUPS` — на него смотрят те места, где русское
 *  название служит КЛЮЧОМ поиска (`data/pricingShowcase.ts`), а не текстом
 *  для читателя. */
export function serviceGroups(locale: Locale): readonly ServiceGroup[] {
  return GROUPS_BY_LOCALE[locale];
}

export const SERVICES_CATALOG_HREF = '/services';
