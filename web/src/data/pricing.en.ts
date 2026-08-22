/* Английские подписи прайса. РУЧНОЙ файл рядом со СГЕНЕРИРОВАННЫМ.
 *
 * `data/pricing.ts` собирается `70-workshop/tools/generate_pricing.py` из
 * `10-offer/PRICING.md` и правится только перезапуском генератора
 * (`50-code/CLAUDE.md`). Английские подписи в него не попадают и попасть не
 * могут: прайс базы — русский документ, и перевод внутри генератора сделал бы
 * инструмент базы носителем чужого языка. Поэтому перевод живёт здесь,
 * отдельным слоем поверх сгенерированного файла.
 *
 * ЧТО ЗДЕСЬ НЕ ПЕРЕВОДИТСЯ — цена. Цифры английской строки обязаны совпасть с
 * русскими знак в знак, и это сверяет сторож `pricingLocalized.ts` при
 * загрузке модуля. Переводятся только слова вокруг числа: «₽/ч» → «₽/hr»,
 * «считать индивидуально» → «quoted individually». Валюта остаётся рублём:
 * пересчёт в доллары был бы ЧИСЛОМ, которого нет в `PRICING.md` (ориентир
 * `~80 ₽/$` там есть, но без даты проверки — `USD_REFERENCE_RATE.checkedAt`
 * равен `null`), а выдуманных чисел на сайте не бывает.
 *
 * Ключи — РУССКИЕ названия групп и ступеней из `data/pricing.ts`. Они здесь
 * не текст, а идентификатор: по ним ищут ступень `Hero.astro`,
 * `Pricing.astro`, `pricingShowcase.ts` и `faq.ts`, и поиск обязан работать
 * одинаково на обеих версиях страницы. */

export interface PriceEntryText {
  name: string;
  /** Состав через запятую. Число кусков обязано совпасть с русским: из них
   *  собирается список пунктов карточки (`data/pricingShowcase.ts`), и
   *  потерянная запятая молча укоротила бы английскую карточку на пункт. */
  whatIncluded: string | null;
  /** Та же цена, те же цифры — переведены только слова вокруг них. */
  price: string;
  note: string | null;
}

export interface PriceGroupText {
  name: string;
  entries: Record<string, PriceEntryText>;
}

export const PRICING_EN: Record<string, PriceGroupText> = {
  'Сайты': {
    name: 'Websites',
    entries: {
      'Лендинг из шаблона': {
        name: 'Landing page from a template',
        whatIncluded: 'a ready template, your own content, no migration and no OCR',
        price: '15 000 ₽',
        note: null,
      },
      'Лендинг с индивидуальным дизайном': {
        name: 'Landing page with custom design',
        whatIncluded: 'design from scratch, animation, enquiry form, responsive layout',
        price: '30 000 ₽',
        note: null,
      },
      'Сайт до 5 страниц': {
        name: 'Website up to 5 pages',
        whatIncluded: 'design system, navigation, forms, SEO basics, deploy',
        price: '50 000 ₽',
        note: null,
      },
      'Сайт до 10 страниц': {
        name: 'Website up to 10 pages',
        whatIncluded: 'the same over a larger body of content',
        price: '70 000 ₽',
        note: null,
      },
      'Больше 10 страниц': {
        name: 'More than 10 pages',
        whatIncluded: '—',
        price: 'quoted individually',
        note: null,
      },
      'Аудит сайта + план правок': {
        name: 'Website audit + a plan of fixes',
        whatIncluded: 'a review, a list of problems, priorities — in writing',
        price: '4 000 ₽',
        note: null,
      },
      'Доработка чужого сайта или бота': {
        name: "Changes to someone else’s site or bot",
        whatIncluded: null,
        price: '2 100 ₽/hr, minimum 6 000 ₽',
        note: 'the 1.4 risk factor is already in the rate',
      },
    },
  },
  'Автоматизация и интеграции': {
    name: 'Automation and integrations',
    entries: {
      'Одна интеграция': {
        name: 'One integration',
        whatIncluded: 'form→CRM, payments, export to a spreadsheet, webhook',
        price: '7 500 ₽',
        note: null,
      },
      'Backend / REST API': {
        name: 'Backend / REST API',
        whatIncluded: 'database schema, layers, migrations, authentication, tests, Swagger',
        price: '35 000 ₽',
        note: null,
      },
      'Панель обращений / админка': {
        name: 'Enquiry dashboard / admin panel',
        whatIncluded: 'intake, statuses, filters, export, roles',
        price: '45 000 ₽',
        note: null,
      },
    },
  },
  'ИИ': {
    name: 'AI',
    entries: {
      'Консультант на готовых материалах': {
        name: 'Consultant on materials you already have',
        whatIncluded:
          'up to 30 pages from you, a widget for the site, quoted sources, ' +
          'a refusal when the facts are missing',
        price: '18 000 ₽',
        note: null,
      },
      'Консультант со сбором материалов': {
        name: 'Consultant with the materials gathered for you',
        whatIncluded:
          'collecting and structuring the sources, tuning the thresholds, ' +
          'testing on real questions',
        price: '40 000 ₽',
        note: null,
      },
    },
  },
  'Telegram': {
    name: 'Telegram',
    entries: {
      'Бот-приемщик заявок': {
        name: 'Enquiry intake bot',
        whatIncluded: 'one flow, notifications, no admin panel',
        price: '9 000 ₽',
        note: null,
      },
      'Бот под задачу': {
        name: 'Custom bot',
        whatIncluded: 'flows, database, roles, admin commands, deploy',
        price: '18 000 ₽',
        note: null,
      },
      'Mini App-витрина': {
        name: 'Mini App showcase',
        whatIncluded: 'a catalogue or a form, no stored state and no admin panel',
        price: '30 000 ₽',
        note: null,
      },
      'Mini App-инструмент': {
        name: 'Mini App tool',
        whatIncluded: 'database, `initData`→JWT auth, admin panel, roles, notifications',
        price: '85 000 ₽',
        note: null,
      },
    },
  },
  'Поддержка': {
    name: 'Support',
    entries: {
      'Пакет поддержки': {
        name: 'Support package',
        whatIncluded: null,
        price: '10 000 ₽/mo',
        note: '5 hours a month, priority, unused time partly carries over',
      },
      'Поддержка по запросу': {
        name: 'Support on request',
        whatIncluded: null,
        price: 'at my hourly rate, no retainer',
        note: 'small fixes, monitoring',
      },
    },
  },
};
