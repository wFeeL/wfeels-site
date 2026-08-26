import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { caseGallerySlides, caseNarrative, caseServiceLinks } from '../data/casePages';
import { caseHref, publishedCases } from '../data/cases';

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
const read = (path: string) => readFileSync(`${DIST}${path}`, 'utf8');

describe('dist/cases — индексируемый каталог и detail-страницы', () => {
  const pages = publishedCases();

  it('каталог содержит только кейсы с опубликованными detail-страницами', () => {
    expect(existsSync(`${DIST}cases/index.html`)).toBe(true);
    const html = read('cases/index.html');
    for (const item of pages) {
      expect(html, item.slug).toContain(`href="${caseHref(item.slug)}"`);
      expect(html, item.slug).toContain(item.title);
      expect(html, item.slug).toContain(item.description);
      expect(html, item.slug).toContain(item.stack);
    }
  });

  for (const item of pages) {
    it(`${caseHref(item.slug)}: canonical, индексирование и подтвержденный текст`, () => {
      const file = `cases/${item.slug}/index.html`;
      expect(existsSync(`${DIST}${file}`)).toBe(true);
      const html = read(file);
      expect(html).toContain('<meta name="robots" content="index, follow">');
      expect(html).toMatch(new RegExp(`<link rel="canonical" href="[^"]+${caseHref(item.slug)}">`));
      expect(html).toMatch(new RegExp(`<h1 class="t-h1"[^>]*>${item.title}</h1>`));
      expect(html).toContain(item.description);
      expect(html).toContain(item.stack);
      const narrative = caseNarrative(item.slug);
      expect(html).toContain(narrative.task);
      expect(html).toContain(narrative.approach);
      expect(html).toContain(narrative.result);
      expect(html).toContain(narrative.disclosure);
      expect(html).toContain('href="/cases"');
      for (const service of caseServiceLinks(item.slug)) {
        expect(html, service.slug).toContain(`href="${service.href}"`);
      }
    });
  }

  /* Сторож числа кадров (2026-08-26): подводка `/cases` обещает читателю
   * «каталог, карточку товара, корзину и оформление заказа» и «в каждом
   * показаны главная страница, ключевой раздел и целевое действие» — то есть
   * все девять кадров каждой галереи, а не выборку. До этой правки здесь жил
   * жёсткий список из трёх/двух индексов (см. `git log casePages.ts`), и
   * «Still House» пропадал из «Сайтов» целиком. Проверено, что сторож красный
   * на старом списке: временный откат `caseGallerySlides` к
   * `[STOREFRONT_SLIDES[0], STOREFRONT_SLIDES[3], STOREFRONT_SLIDES[6]]` /
   * `[WEBSITE_SLIDES[0], WEBSITE_SLIDES[6]]` валит именно эту проверку
   * (`toBe(9)`) на обеих галереях. */
  it('две detail-галереи выводят все девять кадров, первый — без JavaScript', () => {
    for (const slug of ['storefront', 'websites']) {
      const html = read(`cases/${slug}/index.html`);
      const slides = caseGallerySlides(slug);
      expect(slides.length, slug).toBe(9);

      // Первый кадр обязан быть виден без JavaScript — литеральный `src`.
      expect(html, `${slug}: первый кадр без src`).toContain(`src="${slides[0].src}"`);

      // Остальные восемь не входят в первую загрузку: литерального `src`
      // с их адресом в разметке быть не должно — их подставляет скрипт.
      for (const slide of slides.slice(1)) {
        expect(html, `${slug}: ${slide.src} не должен быть в первой загрузке`)
          .not.toContain(`src="${slide.src}"`);
      }

      // Подписи и alt каждого из девяти кадров — в статической разметке,
      // независимо от того, подставлен ли уже `src` скриптом.
      for (const slide of slides) {
        expect(html, `${slug}: ${slide.alt}`).toContain(`alt="${slide.alt}"`);
        expect(html, `${slug}: ${slide.project}/${slide.label}`)
          .toMatch(new RegExp(`<strong[^>]*>${slide.project}</strong>`));
      }

      // Ровно девять помеченных кадров, ни одного лишнего или потерянного.
      // Тег `<img>`, а не голое слово: у скрипта ниже в разметке есть тот
      // же селектор `[data-gallery-screen]` строкой в JS-модуле.
      const markers = html.match(/<img\b[^>]*\bdata-gallery-screen\b/g) ?? [];
      expect(markers.length, `${slug}: число помеченных кадров`).toBe(9);
    }
    expect(read('cases/storefront/index.html')).toContain('width="780" height="1688"');
    expect(read('cases/websites/index.html')).toContain('width="1586" height="992"');
  });

  it('связанные услуги ссылаются обратно на те же кейсы', () => {
    for (const item of pages) {
      for (const service of caseServiceLinks(item.slug)) {
        const html = read(`services/${service.slug}/index.html`);
        expect(html, `${service.slug} → ${item.slug}`)
          .toContain(`href="${caseHref(item.slug)}"`);
      }
    }
  });
});
