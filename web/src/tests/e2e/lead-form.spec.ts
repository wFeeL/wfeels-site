import { test, expect, type Page } from '@playwright/test';

const fill = async (page: Page) => {
  await page.fill('input[name="name"]', 'Мария');
  await page.fill('input[name="contact"]', '@maria');
  await page.fill('textarea[name="message"]', 'Нужен сайт для груминг-салона с записью');
  await page.check('input[name="consent"]');
};

test('форма отправляется при выключенном JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/contact');
  await fill(page);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/thanks$/);
  await ctx.close();
});

test('та же форма в секции 11 главной страницы (две колонки) отправляется без JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.fill('input[name="name"]', 'Мария');
  await page.fill('input[name="contact"]', '@maria');
  await page.fill('textarea[name="message"]', 'Нужен сайт для груминг-салона с записью');
  // На главной чекбоксу далеко до верха (секция 11 — последняя на очень
  // длинной странице), а `html { scroll-behavior: smooth }` (`base.css`, не
  // моя правка) не даёт стандартному `page.check()` дождаться остановки:
  // каждая повторная попытка клика заново запускает плавную прокрутку, и
  // элемент никогда не считается «стабильным». Прокрутка к чекбоксу здесь —
  // мгновенная (`behavior: 'instant'`), в обход CSS, поэтому `check` бьёт по
  // уже неподвижной цели.
  await page.evaluate(() => {
    document.querySelector<HTMLInputElement>('input[name="consent"]')
      ?.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.check('input[name="consent"]', { force: true });
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/thanks$/);
  await ctx.close();
});

test('с JavaScript результат показывается на месте, без перезагрузки', async ({ page }) => {
  await page.goto('/contact');
  await fill(page);
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-form-status="success"]')).toBeVisible();
  await expect(page).toHaveURL(/\/contact$/);
});

test('при недоступном бэкенде показывается ошибка и прямая ссылка на Telegram',
  async ({ page }) => {
    await page.route('**/api/lead', (route) => route.abort());
    await page.goto('/contact');
    await fill(page);
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-form-status="error"]')).toBeVisible();
    await expect(page.locator('[data-form-status="error"] a[href^="https://t.me/"]'))
      .toBeVisible();
  });

test('результат отправки виден в окне, объявлен и получает фокус', async ({ page }) => {
  // Размер окна задан намеренно: при нём кнопка «Отправить» и так на экране,
  // поэтому Playwright не подкручивает страницу за нас, и проверка ловит именно
  // отсутствие прокрутки к результату, а не побочный эффект клика.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/contact');
  await fill(page);
  await page.click('button[type="submit"]');

  const ok = page.locator('[data-form-status="success"]');
  await expect(ok).toBeVisible();
  // Замер до правки: верх блока на 915 px при высоте окна 900 — подтверждение
  // стояло за нижним краем, а форма при этом очищалась. Человек видел, как
  // введённый текст исчез, и не видел ни слова о том, что заявка ушла.
  await expect(ok).toBeInViewport();
  // Без роли живой области читалка молчит: блок просто перестал быть hidden.
  await expect(ok).toHaveAttribute('role', 'status');
  await expect(ok).toBeFocused();
});

test('сообщение об ошибке тоже видно в окне и объявлено', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/lead', (route) => route.abort());
  await page.goto('/contact');
  await fill(page);
  await page.click('button[type="submit"]');

  const err = page.locator('[data-form-status="error"]');
  await expect(err).toBeVisible();
  await expect(err).toBeInViewport();
  await expect(err).toHaveAttribute('role', 'alert');
  await expect(err).toBeFocused();
});

test('на время отправки кнопка выключена и говорит об этом', async ({ page }) => {
  // Задержка ответа — единственный способ увидеть промежуточное состояние:
  // на локальном бэкенде запрос отвечает быстрее, чем успевает моргнуть глаз.
  await page.route('**/api/lead', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await route.continue();
  });
  await page.goto('/contact');
  await fill(page);

  const btn = page.locator('button[type="submit"]');
  await expect(btn).toHaveText('Отправить');
  await btn.click();

  await expect(btn).toBeDisabled();
  await expect(btn).not.toHaveText('Отправить');

  await expect(page.locator('[data-form-status="success"]')).toBeVisible();
  await expect(btn).toBeEnabled();
  await expect(btn).toHaveText('Отправить');
});

test('подсказка под полем набрана цветом, пригодным для чтения', async ({ page }) => {
  await page.goto('/contact');
  const color = await page.locator('form small').first()
    .evaluate((el) => getComputedStyle(el).color);
  // --text-muted светлой темы #5B6675 — 5,6:1 на --bg. Стоявший здесь
  // --text-faint давал 2,73:1, то есть ниже AA для текста.
  expect(color).toBe('rgb(91, 102, 117)');
});

test('на странице формы и после отправки в шапке нет второй основной кнопки',
  async ({ page }) => {
    for (const path of ['/contact', '/thanks']) {
      await page.goto(path);
      // Нажать не на что: ссылки-кнопки в шапке здесь нет.
      await expect(page.locator('header a.btn'), path).toHaveCount(0);

      // Но её место занято — иначе переключатели уезжали бы вправо при каждом
      // переходе на эту страницу (проверка положения — в shell.spec.ts).
      // Заполнитель — не ссылка и не кнопка: ни фокуса, ни объявления читалкой.
      const slot = page.locator('header .btn');
      await expect(slot, path).toHaveCount(1);
      await expect(slot, path).not.toBeVisible();
      await expect(slot, path).toHaveAttribute('aria-hidden', 'true');
      expect(await slot.evaluate((el) => el.tagName), path).toBe('SPAN');
    }

    await page.goto('/');
    await expect(page.locator('header a.btn')).toHaveCount(1);
    await expect(page.locator('header a.btn')).toBeVisible();
  });

test('подтверждение отправки не тише отказа', async ({ page }) => {
  await page.goto('/contact');
  const weight = (selector: string) =>
    page.locator(selector).evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        border: s.borderTopWidth,
        bar: s.boxShadow !== 'none',
        tinted: s.backgroundColor,
      };
    });

  const ok = await weight('[data-form-status="success"]');
  const fail = await weight('[data-form-status="error"]');

  // Второй акцентный цвет спека запрещает, поэтому отказ различается весом:
  // плотной рамкой и засечкой слева. Но до правки эта засечка была только у
  // отказа, и он получался заметнее подтверждения — на форме, где успех
  // случается чаще. Строение панелей одинаковое, различает их цвет и подложка.
  expect(ok.border, 'рамки панелей разной толщины').toBe(fail.border);
  expect(ok.bar, 'у подтверждения нет засечки, а у отказа есть').toBe(true);
  expect(fail.bar).toBe(true);
  expect(ok.tinted, 'подтверждение без подложки').not.toBe(fail.tinted);
});

test('на /thanks подвал прижат к низу окна', async ({ page }) => {
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.goto('/thanks');
    const gap = await page.evaluate(() => {
      const footer = document.querySelector('footer')!;
      return window.innerHeight - footer.getBoundingClientRect().bottom;
    });
    expect(gap, `пустая полоса под подвалом на ${size.width}px`).toBeLessThanOrEqual(1);
  }
});

test('на /thanks есть запасной канал и переключатель языка', async ({ page }) => {
  await page.goto('/thanks');
  // Запасной путь был дан тому, у кого отправка не получилась, и не дан тому,
  // у кого получилась. Ссылка та же, что в сообщении об ошибке.
  await expect(page.locator('main a[href^="https://t.me/"]')).toBeVisible();
  await expect(page.locator('header a.lang')).toHaveCount(1);
});

test('поле-приманка убрано с глаз и от скринридеров', async ({ page }) => {
  await page.goto('/contact');
  const hp = page.locator('input[name="website"]');

  // Ловушка обязана остаться в разметке: наивный бот заполняет всё подряд и на
  // этом попадается. Поэтому её не прячут `display: none`, а уводят за край
  // экрана. Playwright считает такой элемент ВИДИМЫМ — у него ненулевой
  // прямоугольник, а `opacity: 0` видимости не отменяет, — поэтому `toBeHidden()`
  // дал бы здесь ложный красный при полностью верной вёрстке.
  await expect(hp).not.toBeInViewport();

  // Одного `not.toBeInViewport()` мало: он проходит и тогда, когда приманка
  // просто оказалась ниже сгиба длинной страницы. Замер это показал — с
  // выброшенным правилом `.hp` тест остался зелёным. Поэтому рядом стоит
  // утверждение о том, ЧЕМ она убрана: уводом за левый край окна.
  const box = await hp.boundingBox();
  expect(box, 'приманка не отрисована вовсе').not.toBeNull();
  expect(box!.x + box!.width, 'приманка не уведена за край экрана').toBeLessThan(0);

  await expect(hp).toHaveAttribute('tabindex', '-1');
  await expect(hp).toHaveAttribute('aria-hidden', 'true');
  await expect(hp).toHaveAttribute('autocomplete', 'off');
});
