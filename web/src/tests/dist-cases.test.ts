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
   * ни одного случая, значит проверять пустое множество.
   *
   * Очередь `70-workshop/plans/site-v3/04-queue-2026-08-26.md`, пункт 5:
   * манифест `/case-galleries.json` для разворотов кейсов снят — КАЖДЫЙ
   * кадр несёт литеральный `src` в собранном HTML (раньше — только первый
   * кадр страницы, а восемь из девяти на `storefront` не имели атрибута
   * `src` вовсе). Список кейсов и кадров выводится из `publishedCases()` /
   * `caseSpreads()`, а не вписан руками (ловушка 15/21/24,
   * `50-code/CLAUDE.md`). */
  for (const item of pages) {
    const slides = caseSpreads(item.slug).flatMap((spread) => spread.images ?? []);
    if (slides.length === 0) continue; // `site-v3` — ни одного кадра, раздел 4.5 брифа

    it(`${item.slug}: каждый кадр разворота несёт src, alt и отложенность вне первого`, () => {
      const html = read(`cases/${item.slug}/index.html`);
      const imgTags = html.match(/<img\b[^>]*>/g) ?? [];
      expect(imgTags.length, `${item.slug}: число <img> в разметке`).toBe(slides.length);

      slides.forEach((slide, i) => {
        const tag = imgTags[i];
        expect(tag, `${item.slug}: кадр ${i + 1} несёт src`).toContain(`src="${slide.src}"`);
        expect(tag, `${item.slug}: кадр ${i + 1} несёт alt`).toContain(`alt="${slide.alt}"`);
        if (i === 0) {
          expect(tag, `${item.slug}: первый кадр страницы — без loading="lazy" (LCP)`)
            .not.toContain('loading="lazy"');
          expect(tag, `${item.slug}: первый кадр страницы не в отложенном весе`)
            .not.toContain('data-defer-weight');
        } else {
          expect(tag, `${item.slug}: кадр ${i + 1} — loading="lazy"`).toContain('loading="lazy"');
          expect(tag, `${item.slug}: кадр ${i + 1} исключён из веса первой загрузки`)
            .toContain('data-defer-weight="true"');
        }
      });
    });
  }

  it('storefront: подпись у каждого из девяти кадров', () => {
    const html = read('cases/storefront/index.html');
    const slides = caseSpreads('storefront').flatMap((spread) => spread.images ?? []);
    expect(slides.length, 'storefront: суммарно девять кадров по трём разворотам').toBe(9);
    for (const slide of slides) {
      expect(html, `storefront: подпись ${slide.caption}`).toContain(`>${slide.caption}<`);
    }
    expect(html).toContain('width="780" height="1688"');
  });

  it('websites: девять кадров группами по три, свой width/height', () => {
    const html = read('cases/websites/index.html');
    const slides = caseSpreads('websites').flatMap((spread) => spread.images ?? []);
    expect(slides.length, 'websites: суммарно девять кадров по трём разворотам').toBe(9);
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
