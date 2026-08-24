/** Английский словарь каркаса и главной. Набор ключей задаёт `ru.ts`; тип
 *  `Dict` (`i18n/locales.ts`) роняет сборку, если здесь чего-то не хватает.
 *
 *  Перевод сделан как ТЕКСТ, а не как подстрочник: английская главная должна
 *  читаться человеком, для которого английский родной, — то есть без
 *  калькированного порядка слов и без русских кавычек-ёлочек. Смысл при этом
 *  не сдвигается ни в одном обещании: сроки, проценты, гарантии и отказы
 *  говорят ровно то же, что русская версия, потому что за ними стоят одни и
 *  те же документы базы (`10-offer/SERVICES.md`, `10-offer/PRICING.md`).
 *
 *  Цены НЕ переводятся в другую валюту и не пересчитываются: число приходит из
 *  `10-offer/PRICING.md` через генератор, а перевод валюты был бы выдуманным
 *  числом. Английские подписи ступеней — `data/pricing.en.ts`, там же сторож
 *  «цифры совпадают с русскими». */
export default {
  /* ── Каркас ───────────────────────────────────────────────────────────── */
  skip: 'Skip to content',
  write: 'Discuss a project',
  ctaLangNote: 'The contact page is in Russian',
  menu: 'Menu',
  /* Оба состояния подсказки — по-английски: её читает тот, кто сейчас на
     английской странице. Разбор правила — в `ru.ts` у той же пары ключей. */
  langSwitch: 'Switch to Russian',
  langSwitchNoPage: 'This page has no Russian version — the home page will open',
  legal: 'Legal',
  /* Заголовки переведены, а сами документы остаются русскими — это юридические
     тексты, и перевод в них был бы не переводом, а вторым документом. Ссылки
     на английской странице несут `hreflang="ru"`, поэтому язык цели объявлен,
     а не умолчан. */
  legalPolicy: 'Privacy policy',
  legalTerms: 'Terms of service',
  legalConsent: 'Consent to data processing',
  nav: 'Main navigation',
  railNav: 'Page sections',
  theme: 'Colour theme',
  themeLight: 'light',
  themeDark: 'dark',

  /* ── Подвал ───────────────────────────────────────────────────────────── */
  footerSections: 'Sections',
  footerTagline: 'Websites, enquiry intake and automation for small businesses.',
  footerTelegram: 'Message me on Telegram',
  footerEmail: 'Send an email',
  /* Те же три обязательства, что и в русском словаре, и ни одним больше. Часы
     названы с поясом: без него окно ничего не говорит читателю из другой
     страны — а английская версия существует именно для него. */
  footerReply: 'I reply within a day',
  footerCity: 'Saint Petersburg, working remotely',
  footerHours: 'Available 9:00–24:00 Moscow time',
  footerContract: 'I work under a contract as a self-employed taxpayer and issue a receipt through the My Tax app.',
  footerLegalName: 'Сабуров Даниил Денисович · Tax ID 183700967882',
  footerLegalStatus: 'Professional income tax payer, not registered as an individual entrepreneur',
  footerLegalContact: 'Contracts and personal data',
  footerAi: 'I write the code and part of the design together with AI. Architecture, security, design decisions and the palette are mine, and I review everything that comes out.',

  /* ── Заголовок страницы ───────────────────────────────────────────────── */
  metaTitle: 'wfeels — websites and automation',
  metaDescription: 'Websites, integrations and AI for small businesses.',

  /* ── Секция 1, первый экран ───────────────────────────────────────────── */
  /* «Конструктор» — это Tilda и Wix, по-английски website builder. Дословное
     constructor означало бы деталь конструктора, а не сервис. */
  heroLabel: 'WHEN A WEBSITE BUILDER STOPS BEING ENOUGH',
  heroHeading: 'Websites and automation in days, not weeks',
  heroLead: 'One developer instead of a chain of contractors. I design it and check it myself; AI only makes writing the code faster.',
  heroSecondary: 'See pricing',

  priceFrom: 'from',

  /* ── Секция 2, как обычно бывает ──────────────────────────────────────── */
  /* Русская метка называет чувство читателя («знакомая боль»). По-английски
     «pain» в этом месте звучит маркетинговым жаргоном, поэтому метка задаёт
     тот же вопрос прямо — читатель узнаёт себя так же. */
  painLabel: 'SOUND FAMILIAR?',
  painHeading: 'How it usually goes',
  painAnswerLabel: 'THE ANSWER',
  painAnswerHeading: 'With me it goes differently',
  painAnswerText: 'Before work starts, we sign a contract and specification that set out the deliverable, price, timeline and acceptance process. Any new scope, price or timeline is agreed in writing before the extra work begins.',
  painAnswerLink: 'Guarantees',

  /* ── Секция 3, что я делаю ────────────────────────────────────────────── */
  servicesLabel: 'SERVICES',
  servicesHeading: 'What I do',
  servicesAll: 'All services',

  /* ── Секция 4, цены ───────────────────────────────────────────────────── */
  pricingLabel: 'WHAT IT COSTS',
  pricingHeading: 'Development pricing',
  pricingIntro: 'Prices are starting points. After a short discussion, I’ll send you an estimate with a timeline and put it into the contract. Payment is usually 50% once the estimate is agreed and 50% before launch.',
  pricingFootnote: 'I work under a contract as a self-employed taxpayer and issue a receipt through the My Tax app. The prices shown are indicative and do not constitute a public offer under Article 437 of the Civil Code of the Russian Federation.',

  /* ── Секция 5, кейс ───────────────────────────────────────────────────── */
  casesLabel: 'ALREADY BUILT',
  casesHeading: 'Case studies',

  /* ── Секция 6, как я работаю ──────────────────────────────────────────── */
  processLabel: 'HOW IT WILL GO',
  processHeading: 'How I work',

  /* ── Секция 7, гарантии ───────────────────────────────────────────────── */
  guaranteesLabel: 'GUARANTEES',
  guaranteesHeading: 'What I guarantee',

  /* ── Секция 8, обо мне ────────────────────────────────────────────────── */
  aboutLabel: 'WHO BUILDS IT',
  aboutHeading: 'About me',

  /* ── Секция 9, частые вопросы ─────────────────────────────────────────── */
  faqLabel: 'FREQUENT QUESTIONS',
  faqHeading: 'What people usually ask',

  /* ── Секция 10, контакт ───────────────────────────────────────────────── */
  contactLabel: 'LAST STEP',
  contactHeading: 'Tell me about your project',
  contactLead: 'Write a couple of lines: what you need — or what isn’t working right now.',
  contactReply: 'I’ll reply within a day.',

  /* ── Форма заявки ─────────────────────────────────────────────────────── */
  formName: 'Your name',
  formNamePlaceholder: 'Maria, for example',
  formContact: 'Telegram or email',
  formContactPlaceholder: '@wfeels or an email address',
  formService: 'What needs doing',
  formServicePlaceholder: 'Choose a service',
  formMessage: 'About the project (optional)',
  formMessageHint: 'The more specific the task, the more accurate the estimate.',
  formMessagePlaceholder: 'For example: I need a landing page, deadline in a month',
  formConsentBefore: 'I give ',
  formConsentLink: 'consent to the processing of my data',
  formConsentAfter: ' (name, contact details, selected service and enquiry text) so you can reply to my enquiry, including delivery of a copy through Telegram.',
  formPrivacyBefore: 'For details, see the ',
  formPrivacyLink: 'privacy policy',
  formSubmit: 'Send',
  formSending: 'Sending…',
  formOkTitle: 'Sent',
  formOkText: 'Your message is on its way. I’ll reply within a day.',
  formFailTitle: 'Not sent',
  formFailText: 'That didn’t go through. Write to me directly: ',
} as const;
