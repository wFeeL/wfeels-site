import { describe, expect, it } from 'vitest';
import {
  caseGallerySlides,
  caseNarrative,
  caseServiceLinks,
  casesForService,
  publishedCaseHref,
} from './casePages';
import { publishedCases } from './cases';

describe('casePages.ts — опубликованные кейсы и честные связи', () => {
  it('публикуются ровно пять записей с подтвержденными описанием и стеком', () => {
    const pages = publishedCases();
    expect(pages).toHaveLength(5);
    expect(pages.map(publishedCaseHref)).toEqual([
      '/cases/site-v3',
      '/cases/storefront',
      '/cases/websites',
      '/cases/ai-consultant',
      '/cases/zayavka-hub',
    ]);
  });

  it('у каждого опубликованного кейса есть содержательный и честно помеченный разбор', () => {
    for (const item of publishedCases()) {
      const narrative = caseNarrative(item.slug);
      expect(narrative.task.length, item.slug).toBeGreaterThan(80);
      expect(narrative.approach.length, item.slug).toBeGreaterThan(100);
      expect(narrative.result.length, item.slug).toBeGreaterThan(80);
      // `disclosure` необязательна (D-138, storefront её больше не несёт) —
      // проверка длины и запрещённых слов действует только там, где оговорка есть.
      if (narrative.disclosure) {
        expect(narrative.disclosure.length, item.slug).toBeGreaterThan(70);
        expect(narrative.disclosure, item.slug).not.toMatch(/оплаченный клиент|реальный клиент/i);
      }
    }
  });

  it('storefront: оговорка происхождения снята решением владельца (2026-08-28, D-138) — витрины настоящие', () => {
    const narrative = caseNarrative('storefront');
    expect(narrative.disclosure).toBeUndefined();
    // Снятие неверного утверждения не значит заявление оплаченного клиента:
    // слова «клиент»/«заказчик»/«для компании» не появляются нигде в разборе.
    const forbidden = /клиент(?!ск)|заказчик|для компании/i;
    expect(narrative.task).not.toMatch(forbidden);
    expect(narrative.approach).not.toMatch(forbidden);
    expect(narrative.result).not.toMatch(forbidden);
  });

  it('остальные опубликованные кейсы сохраняют оговорку происхождения', () => {
    for (const slug of ['site-v3', 'websites', 'ai-consultant', 'zayavka-hub']) {
      expect(caseNarrative(slug).disclosure, slug).toBeTruthy();
    }
  });

  it('detail-галереи есть только у двух кейсов и несут полный набор из девяти кадров', () => {
    // Подводка `/cases` обещает читателю все экраны каждой галереи
    // («каталог, карточку товара, корзину и оформление заказа»; «в каждом
    // показаны главная страница, ключевой раздел и целевое действие») —
    // detail-страница не имеет права показывать меньше. Это и есть сторож
    // числа кадров: жёсткий список из трёх/двух индексов красит именно эту
    // проверку (было `toHaveLength(3)` / `toHaveLength(2)`).
    expect(caseGallerySlides('storefront')).toHaveLength(9);
    expect(caseGallerySlides('websites')).toHaveLength(9);
    for (const slug of ['site-v3', 'ai-consultant', 'zayavka-hub']) {
      expect(caseGallerySlides(slug), slug).toEqual([]);
    }
  });

  it('связи с услугами симметричны и не заводят лишних соответствий', () => {
    const expected: Record<string, string[]> = {
      'site-v3': ['website'],
      storefront: ['telegram-miniapp'],
      websites: ['website'],
      'ai-consultant': ['ai-consultant'],
      'zayavka-hub': ['integrations'],
    };

    for (const item of publishedCases()) {
      const serviceSlugs = caseServiceLinks(item.slug).map((service) => service.slug);
      expect(serviceSlugs, item.slug).toEqual(expected[item.slug]);
      for (const serviceSlug of serviceSlugs) {
        expect(casesForService(serviceSlug).map((entry) => entry.slug), serviceSlug)
          .toContain(item.slug);
      }
    }

    expect(casesForService('telegram-bot')).toEqual([]);
    expect(caseServiceLinks('unknown-case')).toEqual([]);
  });
});
