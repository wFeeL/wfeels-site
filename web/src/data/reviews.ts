// Отзывы — `70-workshop/specs/site-v3/14-reviews-brief.md`, раздел 4.1.
//
// Единственное место, куда владелец подставляет текст отзыва. Разметка
// (`components/home/Reviews.astro`) не правится никогда: она только читает
// `homeReviews()`.
//
// `REVIEWS` СДАЁТСЯ ПУСТЫМ. Это не заглушка, а состояние (раздел 4.1 брифа):
// ни одной выдуманной строки, ни имени, ни рыбы. `00-overview.md`, раздел 6,
// называет выдуманные отзывы обманом покупателя и запрещает их к возврату.
//
// Подавление секции на главной устроено ОДНИМ выражением в `lib/sections.ts`
// (`...(homeReviews().length > 0 ? [REVIEWS_SECTION] : [])`) — из него
// следует отсутствие секции, точки рельса, участка линии и якоря разом, пока
// этот массив пуст.
import { publishedCases } from './cases';
import { caseNarrative } from './casePages';

export interface Review {
  /** Устойчивый идентификатор записи. На экран не попадает. */
  id: string;
  /** Как подписан человек — ровно та форма, которую он разрешил показать. */
  name: string;
  /** Род занятий или ниша. Слова «клиент», «заказчик», «для компании»
   *  здесь запрещены (`00-overview.md`, раздел 7). Нейтральная форма —
   *  «мастер украшений», «зоосервис в Москве». */
  role: string;
  /** Проект, о котором отзыв. Свободная строка для подписи. */
  project: string;
  /** Slug кейса, на странице которого отзыв показывается, или `null`.
   *  Значение обязано быть slug'ом из `publishedCases()`. */
  caseSlug: string | null;
  /** Текст дословно. Не редактируется, не сокращается, эмодзи остаются. */
  text: string;
  /** Язык оригинала. Цитата НЕ переводится (раздел 4.10 брифа). */
  lang: 'ru' | 'en';
  /** Показывать ли на главной. */
  onHome: boolean;
  /** Письменное согласие: путь к подписанной форме в базе. Пустая строка
   *  роняет сборку. */
  consent: string;
  /** Дата получения отзыва, `YYYY-MM-DD`. */
  date: string;
}

/** Пусто — и это не заглушка, а состояние. Ни одной выдуманной записи. */
export const REVIEWS: readonly Review[] = [];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FORBIDDEN_ROLE_WORDS = /клиент|заказчик|для компании/i;
/* Раздел 1.2 брифа: строка отзыва с именем прямо противоречит оговорке
 * страницы кейса, которая отрицает существование реальных людей за
 * витриной. Проверка ищет тот же текст, которым сегодня набраны все
 * оговорки демонстрационных кейсов (`data/casePages.ts`, `disclosure`). */
const DISCLOSURE_DENIES_REAL_PEOPLE = /не выдаются за оплаченных клиентов|демонстрационн/i;

/** Проверяет инварианты `REVIEWS` (раздел 4.1 брифа) — вынесена в отдельную
 *  функцию, а не оставлена инлайновым циклом, чтобы тест мог предъявить ей
 *  синтетическую запись напрямую, не подменяя боевой пустой массив. Тот же
 *  приём разделения, что и у остальных данных сайта (`data/case-spreads.ts`
 *  держит цикл инлайн, потому что там нет отдельного файла теста; здесь он
 *  есть — `reviews.test.ts`). */
export function assertReviewsValid(
  reviews: readonly Review[],
  cases: readonly { slug: string; disclosure?: string }[],
): void {
  const bySlug = new Map(cases.map((c) => [c.slug, c]));
  const seenIds = new Set<string>();

  reviews.forEach((r, i) => {
    const where = `data/reviews.ts: запись ${i + 1} (id «${r.id || '?'}»)`;

    if (!r.name.trim() || !r.role.trim() || !r.text.trim() || !r.consent.trim() || !r.project.trim() || !r.date.trim()) {
      throw new Error(`${where}: пусты name, role, text, consent, project или date.`);
    }
    if (!DATE_RE.test(r.date)) {
      throw new Error(`${where}: date «${r.date}» не в формате YYYY-MM-DD.`);
    }
    if (FORBIDDEN_ROLE_WORDS.test(r.role)) {
      throw new Error(
        `${where}: role «${r.role}» несёт слово «клиент»/«заказчик»/«для компании» — ` +
        'запрещено там, где не было оплаченного заказа (00-overview.md, раздел 7). ' +
        'В самой цитате (text) запрет не действует — чужие слова не редактируются.',
      );
    }
    if (r.caseSlug !== null) {
      const publishedCase = bySlug.get(r.caseSlug);
      if (!publishedCase) {
        throw new Error(`${where}: caseSlug «${r.caseSlug}» — нет такого slug в publishedCases().`);
      }
      if (publishedCase.disclosure && DISCLOSURE_DENIES_REAL_PEOPLE.test(publishedCase.disclosure)) {
        throw new Error(
          `${where}: caseSlug «${r.caseSlug}» указывает на кейс, чья оговорка отрицает ` +
          `реальных людей («${publishedCase.disclosure}»). Отзыв за именем человека прямо ` +
          'противоречит собственной оговорке страницы (раздел 1.2 брифа `14-reviews-brief.md`). ' +
          'Противоречие снимается ПЕРЕПИСЫВАНИЕМ оговорки владельцем, а не снятием этой проверки.',
        );
      }
    }
    if (seenIds.has(r.id)) {
      throw new Error(`${where}: id «${r.id}» уже встречался — идентификаторы обязаны быть уникальны.`);
    }
    seenIds.add(r.id);
  });
}

assertReviewsValid(
  REVIEWS,
  publishedCases().map((c) => ({ slug: c.slug, disclosure: caseNarrative(c.slug).disclosure })),
);

/** Отзывы для главной, в порядке записи в `REVIEWS`. */
export function homeReviews(): readonly Review[] {
  return REVIEWS.filter((r) => r.onHome);
}

/** Отзывы, привязанные к конкретному кейсу (страницы кейсов эту функцию
 *  сегодня не читают — только главная, вопрос об оплате работ ещё не решён
 *  владельцем, раздел 5 брифа `14-reviews-brief.md`, вопрос 1). Функция
 *  существует уже сейчас, потому что источник данных один на обе
 *  поверхности (раздел 0 брифа), а не потому, что страница кейса её
 *  сегодня вызывает. */
export function caseReviews(slug: string): readonly Review[] {
  return REVIEWS.filter((r) => r.caseSlug === slug);
}
