import { test, expect } from '@playwright/test';

/** Минимум для цели нажатия пальцем. */
const TAP = 44;

test('на 320 px страница не прокручивается вбок', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

// `header .btn` не входит в список: кнопка «Обсудить задачу» скрыта в
// мобильной шапке правкой владельца 2026-08-13, пункт 4 (`.cta-slot`,
// `Header.astro`) — на этой ширине органа нет вовсе, и цель для пальца ему
// подтверждать нечем. Первый экран несёт ту же кнопку отдельно — её цель
// нажатия проверяет другой тест.
test('на 375 px все органы управления в шапке пригодны для пальца',
  async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');

    const controls = page.locator(
      'header a.lang, header #theme-toggle, header a.telegram, header summary'
    );
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox();
      expect(box, `элемент ${i} не отрисован`).not.toBeNull();
      expect(box!.height, `высота элемента ${i}`).toBeGreaterThanOrEqual(TAP);
      expect(box!.width, `ширина элемента ${i}`).toBeGreaterThanOrEqual(TAP);
    }
  });

// Дизайн-ревью (мобильные дефекты, часть 2): четыре семейства ссылок были
// меньше цели нажатия — ссылки услуг стояли без `min-height` (30 px, высота
// строки текста), ссылки ниш были голым `inline`-элементом без коробки
// вовсе (22 px, `min-height` игнорируется не-блочными элементами), а
// почтовая ссылка контакта приходит через `set:html` и не попадает под
// скоупленный CSS-селектор Astro (тоже 22 px, без единого локального
// правила). Три семейства — на разных секциях и разных механизмах поломки,
// поэтому проверяются одним тестом, а не заново растащены по существующим
// спекам секций.
//
// Кейсы сюда не входят вовсе: с правки владельца 2026-08-20 в блоке кейса
// нет ни одной ссылки — ни заголовка-ссылки, ни метки «Разобрать кейс →».
// Мерить цель для пальца стало нечего, и вместо замера ниже стоит сторож
// отсутствия перехода.
test('на 390 px ссылки услуг, ниш и контакта пригодны для пальца',
  async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const groups: Record<string, string> = {
      'услуги': '#services .links a',
      'ниши': '#services .niches a',
      // Правка владельца 2026-08-18, пункт 18: строчный список каналов
      // («Не любите формы — напишите сразу: Telegram · Почта») снят, вместо
      // него две кнопки со значками. Требование теста не изменилось — прямой
      // канал связи на телефоне обязан быть целью для пальца, — изменился
      // только адрес элемента.
      'контакт (прямые каналы)': '#contact .contact-action',
    };

    for (const [label, selector] of Object.entries(groups)) {
      const links = page.locator(selector);
      const count = await links.count();
      expect(count, `${label}: ссылок не найдено`).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const box = await links.nth(i).boundingBox();
        expect(box, `${label} #${i} не отрисована`).not.toBeNull();
        expect(box!.height, `${label} #${i}: высота`).toBeGreaterThanOrEqual(TAP);
      }
    }
  });

/* Было: «каждая строка кейса — цель нажатия на весь блок» (вариант В,
   D-047). Правка владельца 2026-08-20 сняла переход целиком — страницы
   `/cases/<slug>` не существует, — и требование вывернуто: на телефоне
   палец не должен находить в блоке НИЧЕГО нажимаемого. Ложная цель на
   мобильном хуже, чем на десктопе: там нет наведения, чтобы заметить, что
   элемент не отзывается. */
test('на 390 px в блоке кейса нет цели нажатия — переходить некуда', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const rows = page.locator('#cases .rows > .row');
  const count = await rows.count();
  expect(count, 'строки кейсов не найдены').toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const links = rows.nth(i).locator('a, button');
    await expect(links, `строка ${i}: ссылок и кнопок в блоке быть не должно`)
      .toHaveCount(0);
  }
});

test('поля контейнера меняются на трёх ступенях', async ({ page }) => {
  const pad = () =>
    page.locator('main .container').first()
      .evaluate((el) => getComputedStyle(el).paddingLeft);

  await page.goto('/');

  await page.setViewportSize({ width: 375, height: 800 });
  expect(await pad()).toBe('16px');

  await page.setViewportSize({ width: 700, height: 900 });
  expect(await pad()).toBe('24px');

  await page.setViewportSize({ width: 1200, height: 900 });
  expect(await pad()).toBe('40px');
});

test('переключатель темы оформлен компонентом, а не сброшен Preflight',
  async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#theme-toggle');
    const s = await btn.evaluate((el) => {
      const c = getComputedStyle(el);
      return {
        borderWidth: c.borderTopWidth,
        radius: c.borderTopLeftRadius,
        bg: c.backgroundColor,
      };
    });
    // Единственный различитель здесь — ширина рамки. Tailwind Preflight ставит
    // `border: 0 solid`, поэтому прозрачный фон и «цвет не чёрный» прошли бы и
    // на голой кнопке без единого стиля компонента. Ненулевая рамка и скругление
    // доказывают, что применились именно наши правила.
    expect(s.borderWidth).toBe('1px');
    expect(s.radius).not.toBe('0px');
    expect(s.bg).toBe('rgba(0, 0, 0, 0)');
  });
