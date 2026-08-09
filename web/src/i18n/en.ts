export default {
  skip: 'Skip to content',
  write: 'Get in touch',
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
} as const;
