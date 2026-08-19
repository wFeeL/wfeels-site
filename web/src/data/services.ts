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
// Адреса посадочных (`/services/...`) и нишевых (`/niches/...`) страниц —
// спека 03, которой ещё нет: адреса ниже предварительные, подобраны по
// смыслу названия услуги/ниши, а не выведены из документа. Спека 03 вправе
// их переименовать; до этого они объявлены ожидаемой 404 в
// `tests/e2e/links.spec.ts`.

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

export interface NicheLink {
  /** Название ниши — дословно из 02-texts.md. */
  text: string;
  href: string;
}

/** Строка ниш под сеткой карточек. Порядок — дословно из 02-texts.md:
 *  зооуслуги · салоны и барбершопы · мастера-ремесленники · клиники.
 *  Про отраслевой опыт не заявляется — это текст-заголовок строки, не поле
 *  данных: «Под вашу отрасль», без обещания знания отрасли. */
export const NICHES: readonly NicheLink[] = [
  { text: 'зооуслуги', href: '/niches/pet-care' },
  { text: 'салоны и барбершопы', href: '/niches/beauty-salons' },
  { text: 'мастера-ремесленники', href: '/niches/craftsmen' },
  { text: 'клиники', href: '/niches/clinics' },
];

/** Тонкий каталог всех девяти услуг (спека 03, ещё не построен). */
export const SERVICES_CATALOG_HREF = '/services';
