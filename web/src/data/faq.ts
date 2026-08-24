// Секция 10 «Частые вопросы» — единственный источник её содержимого.
// Разметка (`components/home/Faq.astro`) читает отсюда, а не хранит текст
// сама. Тот же файл строит разметку `FAQPage` в `ld+json`
// (`lib/schema.ts` → `faqPageSchema`) — второго перечня вопросов для
// структурированных данных не заводится.
//
// Основа — из `70-workshop/specs/site-v3/02-texts.md`, секция 10;
// вопрос о договоре обновлен по юридическим документам 2026-08-25.
// `**вообще**` внутри первого ответа — разметка полужирного из спеки;
// компонент разбирает её сам (`Faq.astro`), а не хранит здесь HTML.
//
// Секция намеренно НЕ повторяет секции 7 и 8: кандидаты «а если пропадёте»,
// «кто подхватит после вас», «сколько правок входит» отброшены — на них
// отвечают две секции двумя экранами выше (02-texts.md, «Что здесь нельзя
// менять при правке»).
import { PRICING } from './pricing';
import { priceEntry } from './pricingLocalized';
import { assertParallel, type Locale } from '../i18n/locales';

/** Цена пакета поддержки, ответ на вопрос «сколько будет стоить содержание
 *  потом» — читается из `pricing.ts`, а не переписана вторым числом здесь:
 *  правка PRICING.md обязана менять этот ответ сама, а не расходиться с ним
 *  молча. */
const supportEntry = PRICING
  .find((g) => g.name === 'Поддержка')
  ?.entries.find((e) => e.name === 'Пакет поддержки');
if (!supportEntry) {
  throw new Error(
    'data/faq.ts: в data/pricing.ts нет ступени «Пакет поддержки» в группе ' +
    '«Поддержка» — ответ про стоимость содержания ждёт её.',
  );
}
const SUPPORT_PACKAGE_PRICE = supportEntry.price;
const SUPPORT_PACKAGE_PRICE_EN = priceEntry('en', 'Поддержка', 'Пакет поддержки').price;

export interface FaqItem {
  question: string;
  /** `**слово**` внутри ответа значит полужирное,
   *  разбирает `Faq.astro`. */
  answer: string;
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: 'Мне хватит конструктора вроде Tilda?',
    answer:
      'Возможно — и тогда я так и скажу. Конструктор отлично закрывает ' +
      'визитку и лендинг: дешево и работает. Идти в разработку стоит, ' +
      'когда конструктор не может нужного **вообще**: связать сервисы ' +
      'между собой, посчитать по вашей логике, поставить ИИ поверх ваших ' +
      'материалов. Не «сделаем красивее», а «сделаем то, чего там нет».',
  },
  {
    question: 'Вы пишете код с ИИ — не пострадает ли качество?',
    answer:
      'ИИ ускоряет набор кода. Он не решает, как устроен проект, не ' +
      'выбирает архитектуру и не проверяет результат — это делаю я и за ' +
      'это отвечаю. Проверяется просто: вы получаете исходники, и их ' +
      'может прочитать любой другой разработчик.',
  },
  {
    question: 'Что нужно от меня, чтобы начать?',
    answer:
      'Ответы на несколько вопросов и ваши материалы: тексты, ' +
      'фотографии, логотип, если он есть. Тексты могу написать по вашему ' +
      'брифу, фотографии — нет. Домен и хостинг оформляются на вас: ' +
      'настрою я, платите вы напрямую поставщику, доступы остаются у вас.',
  },
  {
    question: 'Сколько будет стоить содержание потом?',
    answer:
      'Хостинг и домен вы оплачиваете напрямую — я в этом не участвую и ' +
      'наценки не беру. Моя поддержка не обязательна, сайт работает сам. ' +
      `Если нужна — пакет ${SUPPORT_PACKAGE_PRICE} на пять часов или ` +
      'работа по запросу по ставке.',
  },
  {
    question: 'Как подпишем договор, если работаем удаленно?',
    answer:
      'Обменяемся подписанными PDF с согласованных адресов или используем ' +
      'другой способ электронной подписи, который укажем в договоре. Личная ' +
      'встреча не нужна: я работаю удаленно из Санкт-Петербурга.',
  },
];

/* ─────────────────────────── Английская версия ────────────────────────────
 *
 * Те же пять вопросов, в том же порядке и о том же. Цена пакета поддержки в
 * четвёртом ответе так же читается из прайса — только английской подписью
 * (`data/pricing.en.ts`): второго числа в тексте нет ни на одном языке.
 *
 * Полужирное `**…**` живёт и в английском ответе: разбирает его тот же
 * `Faq.astro`, и выделено в переводе то же самое слово — «вообще» → «cannot».
 * Ударение фразы держится на нём, и потерять его значило бы перевести
 * предложение, но не мысль. */
const FAQ_ITEMS_EN: readonly FaqItem[] = [
  {
    question: 'Would a builder like Tilda be enough for me?',
    answer:
      'It might be — and then I’ll say so. A builder covers a business ' +
      'card site or a landing page perfectly well: cheap, and it works. ' +
      'Custom development is worth it when the builder **cannot** do what ' +
      'you need at all: tie services together, calculate by your own rules, ' +
      'put AI on top of your materials. Not “let’s make it prettier”, but ' +
      '“let’s build what isn’t there”.',
  },
  {
    question: 'You write code with AI — will the quality suffer?',
    answer:
      'AI speeds up writing the code. It doesn’t decide how the project is ' +
      'built, doesn’t choose the architecture and doesn’t check the ' +
      'result — I do that, and I answer for it. It’s easy to verify: you ' +
      'get the source, and any other developer can read it.',
  },
  {
    question: 'What do you need from me to start?',
    answer:
      'Answers to a few questions and your materials: text, photos, a logo ' +
      'if you have one. I can write the text from your brief; photos I ' +
      'can’t. The domain and hosting are registered in your name: I set ' +
      'them up, you pay the provider directly, and the credentials stay ' +
      'with you.',
  },
  {
    question: 'What will it cost to keep running afterwards?',
    answer:
      'You pay for hosting and the domain directly — I’m not involved and ' +
      'I take no markup. My support is optional, the site runs on its own. ' +
      `If you want it — a ${SUPPORT_PACKAGE_PRICE_EN} package for five hours, ` +
      'or work on request at my hourly rate.',
  },
  {
    question: 'How do we sign the contract if we work remotely?',
    answer:
      'We exchange signed PDFs from the email addresses named in the ' +
      'contract, or use another electronic signing method stated there. ' +
      'No in-person meeting is needed; I work remotely from Saint Petersburg.',
  },
];

const FAQ_BY_LOCALE: Record<Locale, readonly FaqItem[]> = { ru: FAQ_ITEMS, en: FAQ_ITEMS_EN };
assertParallel('data/faq.ts', FAQ_BY_LOCALE);

export function faqItems(locale: Locale): readonly FaqItem[] {
  return FAQ_BY_LOCALE[locale];
}

/* Пять — не «сколько получилось», а решение (02-texts.md): шестой вопрос
   повторял бы секции 7 и 8. Сторож стоит на ОБОИХ языках: список, у которого
   в переводе потерялся вопрос, — та же поломка, что список из шести. */
for (const [locale, items] of Object.entries(FAQ_BY_LOCALE)) {
  if (items.length !== 5) {
    throw new Error(`data/faq.ts: секция 10 несёт ровно пять вопросов (${locale}: ${items.length}).`);
  }
}
