// Отзывы — `70-workshop/specs/site-v3/14-reviews-brief.md`, раздел 4.1.
//
// Единственное место, куда владелец подставляет текст отзыва. Разметка
// (`components/home/Reviews.astro`) не правится никогда: она только читает
// `homeReviews()`.
//
// Первая реальная запись добавлена 2026-09-02 по прямому разрешению автора
// опубликовать отзыв на wfeels.site. Публичная подпись обезличена: имя, аватар
// и снимки переписки на сайт не попадают. В блоке используются только уже
// опубликованные снимки выполненной работы (D-149).
//
// Подавление секции на главной устроено ОДНИМ выражением в `lib/sections.ts`
// (`...(homeReviews().length > 0 ? [REVIEWS_SECTION] : [])`) — из него
// следует отсутствие секции, точки рельса, участка линии и якоря разом, пока
// этот массив пуст.
import { publishedCases } from './cases';
import { caseNarrative } from './casePages';
import { STOREFRONT_SLIDES, STOREFRONT_SLIDES_EN } from './case-galleries';

export interface ReviewScreenshot {
  label: { ru: string; en: string };
  src: string;
  alt: { ru: string; en: string };
  width: number;
  height: number;
}

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
  /** Форма публичной подписи. `anonymous` запрещает имя, аватар и профиль
   *  автора; на экран попадает только нейтральное описание деятельности. */
  publication: 'anonymous' | 'identified';
  /** Внутренний путь к документированному разрешению. Для публикации с
   *  идентифицируемым автором требуется отдельная подписанная форма; для
   *  обезличенной записи допустима запись прямого письменного разрешения. */
  consent: string;
  /** Дата получения отзыва, `YYYY-MM-DD`. */
  date: string;
  /** Снимки выполненной работы. Переписка, аватар и профиль сюда не входят. */
  screenshots?: readonly ReviewScreenshot[];
}

const yasminaSlidesRu = STOREFRONT_SLIDES.filter((slide) => slide.project === 'Yasmina');
const yasminaSlidesEn = STOREFRONT_SLIDES_EN.filter((slide) => slide.project === 'Yasmina');
const YASMINA_SCREENSHOTS: readonly ReviewScreenshot[] = yasminaSlidesRu.map((slide, index) => ({
  label: { ru: slide.label, en: yasminaSlidesEn[index]?.label ?? slide.label },
  src: slide.src,
  alt: { ru: slide.alt, en: yasminaSlidesEn[index]?.alt ?? slide.alt },
  width: slide.width,
  height: slide.height,
}));

/** Только реальные записи с документированным разрешением автора. */
export const REVIEWS: readonly Review[] = [
  {
    id: 'yasmina-storefront-2026-09-02',
    name: 'Владелица бренда',
    role: 'сумки ручной работы',
    project: 'Telegram Mini App',
    caseSlug: null,
    text: 'Сайт получился очень красивым 🥹 Всё выглядит аккуратно и понятно, особенно понравилось, что сразу чувствуется стиль самих сумочек. Заходишь и реально хочется всё посмотреть и выбрать себе что-нибудь. Очень классно получилось, мне нравится ❤️',
    lang: 'ru',
    onHome: true,
    publication: 'anonymous',
    consent: '20-sales/legal/consents/2026-09-02-yasmina-wfeels-site.md',
    date: '2026-09-02',
    screenshots: YASMINA_SCREENSHOTS,
  },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FORBIDDEN_ROLE_WORDS = /клиент|заказчик|для компании/i;
/* Раздел 1.2 брифа (обновлён 2026-08-28 по D-138): строка отзыва с именем
 * прямо противоречит оговорке страницы кейса, которая отрицает
 * существование реальных людей за витриной. У `storefront` такой оговорки
 * больше нет — витрины настоящие (D-138), и на этот кейс проверка больше
 * не срабатывает; единственный, который она сегодня закрывает, —
 * `websites`, где оговорка «демонстрационные дизайн-концепции» описывает
 * кадры, а не происхождение заказа. Альтернатива «не выдаются за
 * оплаченных клиентов» снята: ни одна действующая оговорка её больше не
 * несёт, ветка была недостижима — это чистка мёртвого кода, а не
 * ослабление проверки, работающая ветка (`демонстрационн`) осталась. */
const DISCLOSURE_DENIES_REAL_PEOPLE = /демонстрационн/i;
/* Раздел 1.2/4.1 брифа, D-138 и D-149. `consent` всегда указывает на
 * внутреннюю запись в `20-sales/legal/`. Идентифицируемая публикация
 * допускает только отдельную подписанную форму; обезличенная запись D-149
 * использует документированное прямое разрешение на точный сайт. */
const CONSENT_LEGAL_PATH_RE = /^20-sales\/legal\//;
const SIGNED_CONSENT_PATH_RE = /^20-sales\/legal\/contracts\//;
const FORBIDDEN_CONSENT_WORDS = /устн|на словах|в переписке|в чате|скрин/i;

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
    if (!CONSENT_LEGAL_PATH_RE.test(r.consent)) {
      throw new Error(
        `${where}: consent «${r.consent}» не подтверждает согласие на публикацию. ` +
        'Оплата работы подтверждена (D-138), но поле должно ссылаться на внутреннюю ' +
        'запись внутри 20-sales/legal/.',
      );
    }
    if (r.publication === 'identified' &&
        (!SIGNED_CONSENT_PATH_RE.test(r.consent) || FORBIDDEN_CONSENT_WORDS.test(r.consent))) {
      throw new Error(
        `${where}: идентифицируемая публикация требует отдельной подписанной формы. ` +
        'Оплата работы подтверждена (D-138), но оплату нельзя подменять согласием на ' +
        'публикацию имени, изображения или профиля автора.',
      );
    }
    if (r.publication === 'anonymous' && /(?:^|\s)(?:ясмина|yasmina)(?:\s|$)/i.test(`${r.name} ${r.role} ${r.project}`)) {
      throw new Error(`${where}: обезличенная подпись не должна содержать имя автора.`);
    }
    r.screenshots?.forEach((shot, shotIndex) => {
      if (!shot.label.ru.trim() || !shot.label.en.trim() || !shot.src.trim() ||
          !shot.alt.ru.trim() || !shot.alt.en.trim() || shot.width <= 0 || shot.height <= 0) {
        throw new Error(`${where}: screenshots[${shotIndex}] заполнен не полностью.`);
      }
      if (!shot.src.startsWith('/cases/')) {
        throw new Error(`${where}: screenshots[${shotIndex}].src должен ссылаться на опубликованный кадр /cases/.`);
      }
    });
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
