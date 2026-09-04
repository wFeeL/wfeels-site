import { describe, expect, it } from 'vitest';
import { assertReviewsValid, caseReviews, homeReviews, REVIEWS, type Review } from './reviews';

/** Первая реальная запись — D-149, разрешение автора от 2026-09-02. */
describe('data/reviews.ts — опубликованный отзыв Yasmina', () => {
  it('REVIEWS несёт одну реальную обезличенную запись', () => {
    expect(REVIEWS).toHaveLength(1);
    expect(REVIEWS[0]).toMatchObject({
      id: 'yasmina-storefront-2026-09-02',
      name: 'Владелица бренда',
      publication: 'anonymous',
      onHome: true,
    });
  });

  it('отзыв попадает на главную, не дублируется на странице кейса и несёт три кадра работы', () => {
    expect(homeReviews()).toHaveLength(1);
    expect(caseReviews('site-v3')).toHaveLength(0);
    expect(caseReviews('storefront')).toHaveLength(0);
    expect(REVIEWS[0].screenshots).toHaveLength(3);
    expect(REVIEWS[0].screenshots?.map((shot) => shot.src)).toEqual([
      '/cases/storefront/yasmina-home.avif',
      '/cases/storefront/yasmina-product.avif',
      '/cases/storefront/yasmina-cart.avif',
    ]);
  });
});

/** Фабрика валидной записи — тесты ниже правят одно поле за раз, чтобы
 *  показать, что падает именно проверяемый инвариант, а не какой-то другой. */
function validReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 'r1',
    name: 'Имя Фамильев',
    role: 'мастер украшений',
    project: 'Витрина в Telegram',
    caseSlug: null,
    text: 'Отзыв дословно, как написан.',
    lang: 'ru',
    onHome: true,
    publication: 'identified',
    consent: '20-sales/legal/contracts/case-publication-consent.md',
    date: '2026-08-27',
    ...overrides,
  };
}

const PUBLISHED_CASES = [
  { slug: 'site-v3', disclosure: 'Это собственный рабочий сайт исполнителя.' },
  { slug: 'storefront', disclosure: 'Это демонстрационный проект. Названия магазинов и профили созданы для показа продукта и не выдаются за оплаченных клиентов.' },
];

describe('data/reviews.ts — assertReviewsValid, раздел 4.1 брифа', () => {
  it('валидная запись проходит без ошибки', () => {
    expect(() => assertReviewsValid([validReview()], PUBLISHED_CASES)).not.toThrow();
  });

  it.each(['name', 'role', 'text', 'consent', 'project', 'date'] as const)(
    'падает на пустом поле «%s»',
    (field) => {
      const review = validReview({ [field]: '' });
      expect(() => assertReviewsValid([review], PUBLISHED_CASES)).toThrow();
    },
  );

  it('падает на дате не в формате YYYY-MM-DD', () => {
    const review = validReview({ date: '27.08.2026' });
    expect(() => assertReviewsValid([review], PUBLISHED_CASES)).toThrow(/YYYY-MM-DD/);
  });

  it('падает, если caseSlug не входит в publishedCases()', () => {
    const review = validReview({ caseSlug: 'does-not-exist' });
    expect(() => assertReviewsValid([review], PUBLISHED_CASES)).toThrow(/does-not-exist/);
  });

  it.each(['клиент', 'заказчик', 'для компании', 'КЛИЕНТ'])(
    'падает на слове «%s» в role',
    (word) => {
      const review = validReview({ role: `нашего ${word} обслуживание` });
      expect(() => assertReviewsValid([review], PUBLISHED_CASES)).toThrow();
    },
  );

  it('слово «клиент» в самой цитате (text) НЕ роняет сборку — чужие слова не редактируются', () => {
    const review = validReview({ text: 'Написал как клиент, всё понравилось.' });
    expect(() => assertReviewsValid([review], PUBLISHED_CASES)).not.toThrow();
  });

  it('падает на caseSlug, чья оговорка отрицает реальных людей (раздел 1.2 брифа)', () => {
    const review = validReview({ caseSlug: 'storefront' });
    expect(() => assertReviewsValid([review], PUBLISHED_CASES)).toThrow(/оговорк/);
  });

  it('не падает на caseSlug, чья оговорка не отрицает реальных людей', () => {
    const review = validReview({ caseSlug: 'site-v3' });
    expect(() => assertReviewsValid([review], PUBLISHED_CASES)).not.toThrow();
  });

  it.each([
    'устно договорились',
    'на словах согласилась',
    'в переписке подтвердила',
    'в чате написала «да»',
    'скрин переписки в телеграме',
  ])('падает на consent «%s» — не документ, а устная договорённость', (consent) => {
    const review = validReview({ consent });
    expect(() => assertReviewsValid([review], PUBLISHED_CASES)).toThrow(/согласи/);
  });

  it('падает на consent вне `20-sales/legal/`', () => {
    const review = validReview({ consent: '30-clients/yasmina/consent.md' });
    expect(() => assertReviewsValid([review], PUBLISHED_CASES)).toThrow(/consent/);
  });

  it('сообщение о недостающем consent для identified-публикации называет оплату (D-138)', () => {
    const review = validReview({ consent: 'устно договорились' });
    expect(() => assertReviewsValid([review], PUBLISHED_CASES)).toThrow(/D-138/);
  });

  it('не падает на consent — пути внутри `20-sales/legal/` без запрещённых слов', () => {
    const review = validReview({ consent: '20-sales/legal/contracts/case-publication-consent.md' });
    expect(() => assertReviewsValid([review], PUBLISHED_CASES)).not.toThrow();
  });

  it('обезличенная публикация принимает внутреннюю запись прямого разрешения', () => {
    const review = validReview({
      publication: 'anonymous',
      name: 'Владелица бренда',
      role: 'сумки ручной работы',
      consent: '20-sales/legal/consents/2026-09-02-yasmina-wfeels-site.md',
    });
    expect(() => assertReviewsValid([review], PUBLISHED_CASES)).not.toThrow();
  });

  it('обезличенная подпись не пропускает имя автора', () => {
    const review = validReview({
      publication: 'anonymous',
      name: 'Ясмина',
      consent: '20-sales/legal/consents/2026-09-02-yasmina-wfeels-site.md',
    });
    expect(() => assertReviewsValid([review], PUBLISHED_CASES)).toThrow(/обезлич/);
  });

  it('падает на дублирующемся id', () => {
    const reviews = [validReview({ id: 'dup' }), validReview({ id: 'dup', name: 'Другое Имя' })];
    expect(() => assertReviewsValid(reviews, PUBLISHED_CASES)).toThrow(/dup/);
  });
});
