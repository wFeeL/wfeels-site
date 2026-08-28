import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { caseReviews, homeReviews } from '../data/reviews';
import { publishedCases } from '../data/cases';

/** Сторож подавления секции «Отзывы» — `70-workshop/specs/site-v3/
 *  14-reviews-brief.md`, раздел 4.12, пункты 2 и 3.
 *
 *  Пишется ОДНИМ выражением от `homeReviews().length`, а не двумя тестами
 *  под два состояния («пусто» / «есть записи»): второй вариант пришлось бы
 *  переписывать в день первой записи, а правка сторожа под новое состояние
 *  — способ, которым сторож молча умирает (раздел 4.12, пункт 2, дословно).
 *  Этот файл проходит без единой правки и до, и после первого отзыва.
 *
 *  Требует `npm run build` перед `npm run test:unit` (тот же порядок, что и
 *  у остальных `dist-*.test.ts` — без сборки нечего читать). */
const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
const RU_INDEX = `${DIST}index.html`;
const EN_INDEX = `${DIST}en/index.html`;

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('dist/index.html и dist/en/index.html — подавление секции «Отзывы»', () => {
  it('сборка существует (npm run build перед этим набором)', () => {
    if (!existsSync(RU_INDEX) || !existsSync(EN_INDEX)) {
      throw new Error(
        `\n${RU_INDEX} или ${EN_INDEX} не найден. Сначала выполни \`npm run build\` в web/, ` +
        'затем повтори `npm run test:unit`.',
      );
    }
    expect(true).toBe(true);
  });

  if (!existsSync(RU_INDEX) || !existsSync(EN_INDEX)) return;

  const ruHtml = readFileSync(RU_INDEX, 'utf8');
  const enHtml = readFileSync(EN_INDEX, 'utf8');
  const expectedCount = homeReviews().length > 0 ? 1 : 0;

  it(`id="reviews" встречается ровно ${expectedCount} раз (homeReviews().length > 0 ? 1 : 0) — русская версия`, () => {
    expect(countOccurrences(ruHtml, 'id="reviews"')).toBe(expectedCount);
  });

  it(`id="reviews" встречается ровно ${expectedCount} раз (homeReviews().length > 0 ? 1 : 0) — английская версия`, () => {
    expect(countOccurrences(enHtml, 'id="reviews"')).toBe(expectedCount);
  });

  it(`подпись рельса «ОТЗЫВЫ»/«REVIEWS» встречается ровно ${expectedCount} раз на каждой версии`, () => {
    // Рельс (`Rail.astro`) печатает подпись только у активной точки — точка
    // существует ровно тогда, когда существует сама секция, поэтому число
    // то же самое, что и у `id="reviews"` выше.
    expect(countOccurrences(ruHtml, '>ОТЗЫВЫ<')).toBe(expectedCount);
    expect(countOccurrences(enHtml, '>REVIEWS<')).toBe(expectedCount);
  });

  it('пустое состояние не оставляет ни рамки, ни плашки-заглушки', () => {
    // Раздел 4.11 брифа: «пусто» — это отсутствие, а не оформленное пустое
    // состояние. Проверка положительная (ищет конкретные фразы-заглушки),
    // а не полагается на общее «секции нет» само по себе.
    if (expectedCount === 0) {
      for (const phrase of ['скоро здесь появятся отзывы', 'Скоро здесь появятся отзывы', 'Отзывы скоро']) {
        expect(ruHtml, phrase).not.toContain(phrase);
      }
    }
  });
});

/** Пункт 3 раздела 4.12: «Отзыв доходит до страницы без правки разметки».
 *  Для каждого опубликованного кейса число узлов `[data-review]` в его
 *  собранной странице равно `caseReviews(slug).length`. Сегодня страницы
 *  кейсов эту секцию не рендерят (главная — единственная поверхность этого
 *  захода, `14-reviews-brief.md`, раздел 5, вопрос 1 не решён владельцем) —
 *  обе части равенства нули, и это ожидаемо: разметка не готова
 *  единственно потому, что данных для неё тоже нет, а не потому, что
 *  сторож ослаблен под текущее состояние. */
describe('dist/cases/<slug> — [data-review] соответствует caseReviews(slug)', () => {
  const cases = publishedCases();

  for (const item of cases) {
    it(`${item.slug}: число [data-review] совпадает с caseReviews('${item.slug}').length`, () => {
      const file = `${DIST}cases/${item.slug}/index.html`;
      const expected = caseReviews(item.slug).length;
      if (!existsSync(file)) {
        // Страница кейса без единого отзыва не обязана нести узел-заглушку
        // (то же правило «пусто — значит отсутствие», раздел 4.11).
        expect(expected, `${item.slug}: dist-файл не найден, а caseReviews() не пуст`).toBe(0);
        return;
      }
      const html = readFileSync(file, 'utf8');
      expect(countOccurrences(html, 'data-review')).toBe(expected);
    });
  }
});
