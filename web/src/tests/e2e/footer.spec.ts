import { test, expect } from '@playwright/test';

const TELEGRAM = 'https://t.me/wfeels';
const SECTIONS_IN_FOOTER = 'footer nav[aria-labelledby="footer-sections"] a';

/** Главный тест этого файла.
 *
 *  Список разделов у шапки и у подвала ОДИН (`lib/nav.ts`), поэтому разойтись
 *  им нечем — но именно это утверждение и проверяется. Тест переживёт правку, в
 *  которой кто-то вернёт подвалу свой перечень: сегодня он зелёный по строению
 *  кода, завтра — единственное, что об этом строении помнит. */
test('список разделов подвала совпадает со списком навигации шапки',
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const read = (selector: string) =>
      page.locator(selector).evaluateAll((links) =>
        links.map((l) => `${l.getAttribute('href')} — ${l.textContent?.trim()}`));

    const header = await read('header nav.nav-wide a');
    const footer = await read(SECTIONS_IN_FOOTER);

    expect(header.length, 'в шапке не осталось разделов — тест ослеп')
      .toBeGreaterThan(0);
    expect(footer, 'подвал показывает не то, что шапка').toEqual(header);
  });

test('там, где разделов нет, подвал не рисует пустую группу', async ({ page }) => {
  await page.goto('/en');
  // Английских разделов не существует (`lib/nav.ts`), и оба потребителя списка
  // обязаны отреагировать на это одинаково: не показать ни пункта и ни
  // заголовка над пустотой.
  await expect(page.locator('header nav.nav-wide a')).toHaveCount(0);
  await expect(page.locator(SECTIONS_IN_FOOTER)).toHaveCount(0);
  await expect(page.locator('footer #footer-sections')).toHaveCount(0);
  // Юридическая группа и прямой выход остаются: подвал не пустеет.
  await expect(page.locator('footer nav[aria-labelledby="footer-legal"] a'))
    .toHaveCount(3);
  await expect(page.locator('footer a.btn')).toHaveCount(1);
});

test('в подвале есть кнопка в Telegram, и она ведёт на t.me/wfeels',
  async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('footer a.btn');

    await expect(cta).toHaveCount(1);
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', TELEGRAM);

    const look = await cta.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        bg: s.backgroundColor,
        height: el.getBoundingClientRect().height,
        target: el.getAttribute('target'),
        rel: el.getAttribute('rel'),
      };
    });

    // Владелец просил именно кнопку: заливка и цель нажатия, а не строчная
    // ссылка, набранная как соседние пункты.
    expect(look.bg, 'кнопка без заливки — это ссылка')
      .not.toBe('rgba(0, 0, 0, 0)');
    expect(look.height, 'высота кнопки').toBeGreaterThanOrEqual(44);

    // Новую вкладку кнопка не открывает намеренно: на телефоне ссылку
    // перехватывает приложение, и `_blank` оставил бы пустую вкладку, а на
    // десктопе возврат — одна кнопка «назад». Обоснование — в Footer.astro.
    expect(look.target, 'кнопка уводит в новую вкладку').toBeNull();
    expect(look.rel, 'у внешней ссылки на свой же профиль нет rel="me"')
      .toBe('me');
  });

test('прямой канал на странице один и тот же везде', async ({ page }) => {
  // На `/thanks` адрес Telegram стоит дважды: запасным путём в тексте и кнопкой
  // подвала. Пока это были две строки в двух файлах, расхождение ничем не
  // ловилось — ссылка на чужой домен не проверяется обходом ссылок.
  await page.goto('/thanks');
  const hrefs = await page.locator('a[href^="https://t.me/"]')
    .evaluateAll((links) => links.map((l) => l.getAttribute('href')));

  expect(hrefs.length, 'запасной канал пропал со страницы').toBeGreaterThan(1);
  expect(new Set(hrefs).size, `адреса разошлись: ${hrefs.join(', ')}`).toBe(1);
  expect(hrefs[0]).toBe(TELEGRAM);
});

test('три обязательства подвала стоят рядом с кнопкой', async ({ page }) => {
  await page.goto('/');
  const facts = page.locator('footer .facts li');
  await expect(facts).toHaveCount(3);
  // Слова проверяются по смыслу, а не по точному тексту: срок ответа, город и
  // окно доступности. Формулировка правится в словаре без правки теста, но
  // исчезнуть ни одна из трёх не может.
  await expect(facts.nth(0)).toContainText('в течение дня');
  await expect(facts.nth(1)).toContainText('Санкт-Петербург');
  await expect(facts.nth(2)).toContainText('24:00');
});

test('на телефоне группы подвала идут столбиком и не переполняют экран',
  async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const boxes = await page.locator('footer .groups > *').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right };
      }));

    expect(boxes.length, 'групп в подвале не три').toBe(3);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].top, `группа ${i + 1} стоит не под предыдущей`)
        .toBeGreaterThan(boxes[i - 1].top);
      expect(boxes[i].left, `группа ${i + 1} сдвинута по левому краю`)
        .toBeCloseTo(boxes[0].left, 0);
    }

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'страница уехала вбок').toBeLessThanOrEqual(0);
  });

test('в подвале каждая цель нажатия держит 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  for (const link of await page.locator('footer a').all()) {
    const text = (await link.innerText()).trim();
    const box = await link.boundingBox();
    expect(box, `ссылка «${text}» не отрисована`).not.toBeNull();
    expect(box!.height, `высота цели «${text}»`).toBeGreaterThanOrEqual(44);
  }
});

for (const scheme of ['light', 'dark'] as const) {
  test(`в ${scheme === 'light' ? 'светлой' : 'тёмной'} теме подвал читается`,
    async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');

      const read = (selector: string) =>
        page.locator(selector).first().evaluate((el) => {
          const s = getComputedStyle(el);
          return { color: s.color, deco: s.textDecorationLine };
        });

      const text = await read('footer .ai');
      const link = await read('footer nav a');
      const title = await read('footer .group-title');

      expect(link.color, 'ссылка того же цвета, что текст рядом')
        .not.toBe(text.color);
      expect(link.deco, 'ссылка подвала без подчёркивания').toContain('underline');
      // Заголовок группы обязан отличаться и от текста под ним, и от ссылок:
      // иначе группы читаются как один общий список.
      expect(title.color, 'заголовок группы не отличить от текста')
        .not.toBe(text.color);
      expect(title.color, 'заголовок группы не отличить от ссылок')
        .not.toBe(link.color);
    });
}
