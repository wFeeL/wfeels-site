import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { caseNarrative, caseServiceLinks } from '../data/casePages';
import { caseHref, publishedCases } from '../data/cases';
import { caseSpreads } from '../data/case-spreads';

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

  /* Сторож «хотя бы одна галерея ещё не переехала на развороты» снят: с этой
   * правкой у ОБЕИХ многокадровых галерей (`websites`, `storefront`) есть
   * развороты, путь `CaseGallery` на страницах кейсов больше не используется
   * нигде — держать проверку промежуточного состояния, у которого больше нет
   * ни одного случая, значит проверять пустое множество. Предметная проверка
   * не снята, а расщеплена на два именных теста ниже (по одному на кейс),
   * тем же приёмом, что уже применяет тест `websites`: список кадров
   * выводится из `caseSpreads()`, а не вписан руками (ловушка 15/21,
   * `50-code/CLAUDE.md`). */
  it('storefront: разворот выводит все девять кадров, первый — без JavaScript', () => {
    const html = read('cases/storefront/index.html');
    const slides = caseSpreads('storefront').flatMap((spread) => spread.images ?? []);
    expect(slides.length, 'storefront: суммарно девять кадров по трём разворотам').toBe(9);

    expect(html, 'storefront: первый кадр без src').toContain(`src="${slides[0].src}"`);
    for (const slide of slides.slice(1)) {
      expect(html, `storefront: ${slide.src} не должен быть в первой загрузке`)
        .not.toContain(`src="${slide.src}"`);
    }
    for (const slide of slides) {
      expect(html, `storefront: ${slide.alt}`).toContain(`alt="${slide.alt}"`);
      expect(html, `storefront: подпись ${slide.caption}`).toContain(`>${slide.caption}<`);
    }
    expect(html).toContain('width="780" height="1688"');
  });

  /* `websites` перешёл на развороты (раздел 4.2 брифа) — девять кадров
   * группами по три («крупный + два подкадра»), каждый со своим `alt`
   * (`data/case-spreads.ts`), а не сеткой `CaseGallery`. Первый кадр
   * страницы литеральный `src`, остальные восемь идут по манифесту
   * `/case-galleries.json` тем же ключом `websites-ru`, что раньше отдавал
   * их `CaseGallery` — раздел 10.2 брифа («все кадры, кроме первого на
   * странице, идут без атрибута `src`»). */
  it('websites: разворот выводит все девять кадров, первый — без JavaScript', () => {
    const html = read('cases/websites/index.html');
    const slides = caseSpreads('websites').flatMap((spread) => spread.images ?? []);
    expect(slides.length, 'websites: суммарно девять кадров по трём разворотам').toBe(9);

    expect(html, 'websites: первый кадр без src').toContain(`src="${slides[0].src}"`);
    for (const slide of slides.slice(1)) {
      expect(html, `websites: ${slide.src} не должен быть в первой загрузке`)
        .not.toContain(`src="${slide.src}"`);
    }
    for (const slide of slides) {
      expect(html, `websites: ${slide.alt}`).toContain(`alt="${slide.alt}"`);
    }
    expect(html).toContain('width="1586" height="992"');
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
