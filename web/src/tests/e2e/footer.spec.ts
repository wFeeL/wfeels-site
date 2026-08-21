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

/* Правка владельца 2026-08-21: «убираем раздел с Юридическим документами.
 * заполним его позже» — из подвала снята только НАВИГАЦИЯ группы. Страницы
 * `/privacy`, `/terms`, `/consent` продолжают собираться (на `/consent`
 * ссылается обязательный чекбокс согласия в `LeadForm.astro`), но подвал
 * ссылку на них больше не рисует ни на одном языке. До этой правки здесь
 * стояла проверка ОБРАТНОГО — что группа есть и в ней три ссылки. */
test('группы «Юридические документы» в подвале больше нет', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer #footer-legal')).toHaveCount(0);
  await expect(page.locator('footer nav[aria-labelledby="footer-legal"]'))
    .toHaveCount(0);
  await expect(page.locator('footer a[href="/privacy"]')).toHaveCount(0);
  await expect(page.locator('footer a[href="/terms"]')).toHaveCount(0);
  await expect(page.locator('footer a[href="/consent"]')).toHaveCount(0);
});

test('там, где разделов нет, подвал не рисует пустую группу', async ({ page }) => {
  await page.goto('/en');
  // Английских разделов не существует (`lib/nav.ts`), и оба потребителя списка
  // обязаны отреагировать на это одинаково: не показать ни пункта и ни
  // заголовка над пустотой.
  await expect(page.locator('header nav.nav-wide a')).toHaveCount(0);
  await expect(page.locator(SECTIONS_IN_FOOTER)).toHaveCount(0);
  await expect(page.locator('footer #footer-sections')).toHaveCount(0);
  // Прямой выход остаётся: подвал не пустеет даже без единого раздела.
  await expect(page.locator('footer a.icon-link')).toHaveCount(2);
});

test('в подвале два значка — Telegram и почта, и оба остаются ссылками',
  async ({ page }) => {
    await page.goto('/');
    // Правка владельца 2026-08-18, пункт 17: кнопка «Написать в Telegram»
    // заменена двумя значками. Тест переписан вместе с разметкой — прежнее
    // ожидание (`footer a.btn`, заливка, высота 44) описывало снятый элемент.
    const links = page.locator('footer a.icon-link');
    await expect(links).toHaveCount(2);

    const tg = links.filter({ has: page.locator('svg') }).first();
    await expect(tg).toHaveAttribute('href', TELEGRAM);

    const look = await links.evaluateAll((els) => els.map((el) => ({
      name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
      w: el.getBoundingClientRect().width,
      h: el.getBoundingClientRect().height,
      target: el.getAttribute('target'),
      href: el.getAttribute('href') ?? '',
    })));

    for (const l of look) {
      // Значок без подписи обязан нести доступное имя: иначе скринридер
      // прочитает ссылку как «ссылка» и не скажет куда.
      expect(l.name.length, `значок без доступного имени: ${l.href}`)
        .toBeGreaterThan(0);
      // Цель нажатия пальцем — то же правило, что и у прежней кнопки.
      expect(Math.min(l.w, l.h), `цель нажатия значка ${l.href}`)
        .toBeGreaterThanOrEqual(44);
      // Новую вкладку не открываем — обоснование в `Footer.astro`.
      expect(l.target, `значок уводит в новую вкладку: ${l.href}`).toBeNull();
    }

    // Один из двух — почтовый, и адрес собран защищённой строкой.
    expect(look.some((l) => l.href.startsWith('mailto:')
      || l.href.includes('&#')), 'почтовый значок пропал').toBe(true);
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

test('три обязательства подвала стоят рядом со значками', async ({ page }) => {
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

    // Было три группы (бренд + разделы + юридические), правка владельца
    // 2026-08-21 сняла третью целиком — сегодня их две.
    expect(boxes.length, 'групп в подвале не две').toBe(2);
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
      // Правка дизайн-ревью 2026-08-19: ссылка подвала — пункт меню/списка,
      // не проза. Постоянного `text-decoration: underline` у неё больше нет
      // (черту рисует псевдоэлемент `.link-label::after`, см. тест ниже) —
      // до правки здесь стояло обратное ожидание, и это была часть дефекта.
      expect(link.deco, 'ссылка подвала несёт постоянное подчёркивание в покое')
        .not.toContain('underline');
      // Заголовок группы обязан отличаться и от текста под ним, и от ссылок:
      // иначе группы читаются как один общий список.
      expect(title.color, 'заголовок группы не отличить от текста')
        .not.toBe(text.color);
      expect(title.color, 'заголовок группы не отличить от ссылок')
        .not.toBe(link.color);
    });
}

/* Сторож на правило дизайн-ревью 2026-08-19: ссылка ВНУТРИ ПРОЗЫ обязана
 * остаться подчёркнутой постоянно (единственный небуквенный отличитель от
 * текста абзаца), а ссылка в СПИСКЕ/МЕНЮ — нести подчёркивание только на
 * `:hover`/`:focus-visible` (роль читается местом, постоянная черта — шум).
 * Ревью нашло двенадцать подчёркнутых ссылок на странице: восемь в подвале
 * (пять «РАЗДЕЛЫ» + три юридические), два прямых канала в контактной секции
 * («Расскажите о задаче» → «Не любите формы — напишите сразу») — им черта
 * положена только под курсором/фокусом; и две ссылки внутри прозы формы
 * (согласие на обработку персональных данных, запасной Telegram в сообщении
 * об ошибке) — им черта положена всегда, их этот сторож не трогает.
 *
 * Красный прогон, которым это доказано: до правки `Footer.astro`/
 * `Contact.astro` несли `.links a`/`.channels a` с постоянным
 * `text-decoration: underline` — тест «в покое подчёркивания нет» падал на
 * каждом из десяти пунктов меню, а `.link-label::after` не существовал
 * вовсе — `getComputedStyle(label, '::after').transform` не матчился на
 * `matrix(...)` и `scale` уходил в `null`, тест падал и на проверке
 * наведения. Восстановлено правкой того же коммита. */
test('подчёркивание живёт по месту ссылки: список молчит в покое, проза — нет',
  async ({ page }) => {
    await page.goto('/');

    const underlineState = (selector: string) =>
      page.locator(selector).first().evaluate((el) => {
        const label = el.querySelector('.link-label') as Element | null;
        const target = label ?? el;
        const after = getComputedStyle(target, '::after');
        const m = /matrix\(([^,]+),/.exec(after.transform);
        return {
          scale: m ? Number(m[1]) : null,
          deco: getComputedStyle(el).textDecorationLine,
        };
      });

    // Селектора `footer nav[aria-labelledby="footer-legal"] a` здесь БОЛЬШЕ
    // НЕТ: правка владельца 2026-08-21 сняла группу «Юридические документы»
    // из подвала целиком (сторож — тест выше, «группы… больше нет»).
    const menuLinks = [
      'footer nav[aria-labelledby="footer-sections"] a',
    ];

    /* Прямые каналы секции контакта — не пункты меню, а КНОПКИ со значками
       (правка владельца 2026-08-18, пункт 18: строчный список `.channels`
       снят). Черты у них нет и не должно быть ни в одном состоянии: они
       опознаются рамкой и значком, а наведение меняет их так же, как любую
       кнопку. Поэтому они проверяются отдельно, а не тем же требованием,
       что пункты меню, — натянуть на них «в покое scale 0, под курсором 1»
       значило бы требовать механизма, который им не нужен. */
    const actions = page.locator('#contact .contact-action');
    const actionCount = await actions.count();
    expect(actionCount, 'прямые каналы контакта пропали').toBeGreaterThan(0);
    for (let i = 0; i < actionCount; i += 1) {
      const deco = await actions.nth(i).evaluate(
        (el) => getComputedStyle(el).textDecorationLine,
      );
      expect(deco, `кнопка канала #${i} подчёркнута`).not.toContain('underline');
    }
    for (const selector of menuLinks) {
      const idle = await underlineState(selector);
      // Правило: вне прозы черты в покое нет. Носителей у неё два, и оба
      // законны — приём с псевдоэлементом (пункты меню, где черта приходит
      // при наведении) и полное её отсутствие (кнопки со значками, которым
      // черта не нужна ни в каком состоянии). Требовать `scale === 0` от
      // второго — требовать существования механизма, который там не нужен:
      // `null` означает «псевдоэлемента нет», а не «черта видна».
      expect(
        idle.scale === 0 || idle.scale === null,
        `${selector}: черта видна в покое (scale=${idle.scale})`,
      ).toBe(true);
      expect(idle.deco, `${selector}: подчёркнута текстом в покое`)
        .not.toContain('underline');

      const link = page.locator(selector).first();
      await link.hover();
      await page.waitForTimeout(200);
      const hovered = await underlineState(selector);
      expect(hovered.scale, `${selector}: под курсором черты нет`).toBe(1);
    }

    // Прямые ссылки в прозе — постоянно подчёркнуты нативным
    // `text-decoration`, второй механики (`.link-label`) у них нет.
    const proseLinks = ['#contact .consent a'];
    for (const selector of proseLinks) {
      const s = await underlineState(selector);
      expect(s.deco, `${selector}: ссылка внутри прозы без подчёркивания`)
        .toContain('underline');
    }
  });
