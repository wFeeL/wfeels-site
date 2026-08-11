export default {
  skip: 'Skip to content',
  write: 'Discuss a project',
  ctaLangNote: 'The contact page is in Russian',
  menu: 'Menu',
  langSwitch: 'Переключить на русский',
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
  footerSections: 'Sections',
  footerTagline: 'Websites, lead capture and automation for small businesses.',
  footerTelegram: 'Message me on Telegram',
  /* Те же три обязательства, что и в русском словаре, и ни одним больше. Часы
     названы с поясом: без него окно ничего не говорит читателю из другой
     страны — а английская версия существует именно для него. */
  footerReply: 'I reply within a day',
  footerCity: 'Saint Petersburg, working remotely',
  footerHours: 'Available 9:00–24:00 Moscow time',
  footerAi: 'I write the code and part of the design together with AI. Architecture, security, design decisions and the palette are mine, and I review everything that comes out.',
} as const;
