import { test, expect } from '@playwright/test';

const TELEGRAM = 'https://t.me/wfeels';

/* Колонка «Разделы» снята вариантом Ф-Б (спека `09-footer-brief.md`, раздел 2):
   те же пять якорей несёт липкая шапка, видимая в любой момент прокрутки —
   нулевой прирост достижимости за 254 px и свой CSS-вес на каждой странице.
   Вместе с колонкой сняты и оба теста, сверявшие список подвала со списком
   шапки («список разделов подвала совпадает со списком навигации шапки» и
   «на любой странице шапка и подвал показывают один и тот же непустой список
   разделов»): предмет проверки (`nav[aria-labelledby="footer-sections"]`)
   в разметке больше не существует, сверять нечего. */

/* Юридический ряд остаётся единственной навигацией подвала (раздел 6, пункт 5
   брифа): доступное имя несёт `aria-label` на самом `<nav>`, видимого узла с
   `id` для него больше нет — прежний `#footer-legal`/`aria-labelledby`
   снимается вместе со сняты́м `.group-title`. */
test('в подвале доступны три действующих юридических документа', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('footer nav[aria-label]');
  await expect(nav).toHaveCount(1);
  await expect(nav).toHaveAttribute('aria-label', /.+/);
  await expect(page.locator('footer a[href="/privacy"]')).toBeVisible();
  await expect(page.locator('footer a[href="/terms"]')).toBeVisible();
  await expect(page.locator('footer a[href="/consent"]')).toBeVisible();
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

/* Рычаг С-2 (спека `09-footer-brief.md`, раздел 7.3): прежний список `.facts`
 * с четырьмя пунктами (срок ответа, город, часы, оформление сделки) снят.
 * Срок ответа и часы слиты в одну строку режима ответа (`footerReplyMode`) —
 * она стоит в подвале РОВНО ОДИН раз (в `.cta-sub`, если есть полоса, иначе
 * в `.reply`); город и оформление сделки — тоже одной строкой внутри
 * `.requisites`, четвёртым абзацем после почты по договорам. */
test('режим ответа стоит в подвале один раз, город и оформление — в реквизитах',
  async ({ page }) => {
    await page.goto('/'); // на «/» полосы нет — режим ответа несёт `.reply`
    const reply = page.locator('footer .reply');
    await expect(reply).toHaveCount(1);
    await expect(reply).toContainText('в течение дня');
    await expect(reply).toContainText('24:00');
    // Полосы (`.cta-sub`) на этой странице нет — иначе строка повторилась бы.
    await expect(page.locator('footer .cta-sub')).toHaveCount(0);

    const requisites = page.locator('footer .requisites p');
    await expect(requisites.filter({ hasText: 'Санкт-Петербург' }))
      .toContainText('по договору');
    await expect(requisites.filter({ hasText: 'Санкт-Петербург' }))
      .toContainText('«Мой налог»');
  });

/* Та же строка режима ответа на странице с полосой действия — теперь она
 * несётся `.cta-sub`, а не `.reply` (раздел 4 брифа: «строка выводится ровно
 * один раз — в полосе, если полоса есть, и первой строкой служебной полосы,
 * если полосы нет»). */
test('на странице с полосой действия режим ответа несёт .cta-sub, а не .reply',
  async ({ page }) => {
    await page.goto('/cases'); // каталог кейсов — полоса включена (раздел 3.2)
    const sub = page.locator('footer .cta-sub');
    await expect(sub).toHaveCount(1);
    await expect(sub).toContainText('в течение дня');
    await expect(sub).toContainText('24:00');
    await expect(page.locator('footer .reply')).toHaveCount(0);
  });

test('в подвале указаны реквизиты самозанятого и юридический email', async ({ page }) => {
  await page.goto('/');
  const requisites = page.locator('footer .requisites');
  await expect(requisites).toContainText('Сабуров Даниил Денисович');
  await expect(requisites).toContainText('ИНН 183700967882');
  await expect(requisites).toContainText('Плательщик налога на профессиональный доход');
  await expect(requisites.locator('a[href="mailto:i@dsaburov.ru"]')).toBeVisible();
});

/* Вариант Ф-Б снял сетку `.groups` (бренд + две навигации) целиком — подвал
 * теперь несёт полосу действия/`.footer-meta` без колоночной раскладки, и
 * сравнивать боксы столбцов друг с другом больше не с чем: предмет проверки
 * (`footer .groups > *`, ровно три группы) в разметке не существует. */

/* Сторож «пустое поле справа от последней колонки» проверял, что три группы
 * колоночной сетки (`.groups`/`.bottom`) занимают всю ширину подвала —
 * вариант Ф-Б этой сетки не несёт (см. комментарий выше), сравнивать нечего.
 * Его место со следующей частью работы займёт сторож высоты подвала из
 * раздела 11 брифа — не здесь. */

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

      // `.ai` снят вместе со строкой «вместе с ИИ» (рычаг С-1) — абзац рядом
      // со ссылками теперь несёт `.reply` (на `/` полосы действия нет,
      // строка режима ответа стоит здесь; см. тест «режим ответа стоит в
      // подвале один раз» выше).
      const text = await read('footer .reply');
      const link = await read('footer nav a');

      // Правка дизайн-ревью 2026-08-22 (находка 3, «ссылки подвала и шапки
      // говорят на двух разных языках»): подвал больше не несёт свой
      // отдельный акцентный язык — ссылка в покое НАМЕРЕННО того же цвета,
      // что текст рядом, тем же токеном, что и пункт меню в шапке
      // (`--text-muted`, `NavLinks.astro`, `.nav-link`). Роль ссылки в покое
      // читается местом (список внутри `<nav>`, не абзац прозы), а не
      // собственным цветом — эта строка фиксирует новое намеренное
      // совпадение и заменяет прежнее ожидание обратного (до правки здесь
      // стоял акцент, и цвет отличался от текста рядом специально).
      expect(link.color, 'ссылка подвала разошлась с языком шапки — цвет в покое должен совпадать с текстом рядом')
        .toBe(text.color);
      // Отклик на наведение — то, что теперь единственно отличает ссылку от
      // текста в покое (тот же сторож есть у шапки, `shell.spec.ts`, «пункт
      // навигации отвечает на курсор»).
      const linkLocator = page.locator('footer nav a').first();
      const linkColor = () => linkLocator.evaluate((el) => getComputedStyle(el).color);
      await linkLocator.hover();
      // `expect.poll`, не разовое чтение сразу после `hover()`: цвет идёт
      // через `transition: color var(--dur-micro)` (160ms), и чтение раньше
      // конца перехода ловит промежуточное значение — тот же приём, что и в
      // `shell.spec.ts`, «пункт навигации отвечает на курсор».
      await expect.poll(linkColor, { message: 'цвет ссылки подвала не меняется под курсором' })
        .not.toBe(link.color);
      // Правка дизайн-ревью 2026-08-19: ссылка подвала — пункт меню/списка,
      // не проза. Постоянного `text-decoration: underline` у неё больше нет
      // (черту рисует псевдоэлемент `.link-label::after`, см. тест ниже) —
      // до правки здесь стояло обратное ожидание, и это была часть дефекта.
      expect(link.deco, 'ссылка подвала несёт постоянное подчёркивание в покое')
        .not.toContain('underline');
      // Заголовка группы (`.group-title`) вариант Ф-Б не несёт вовсе —
      // колонки с подписью сняты вместе с сеткой `.groups` (см. комментарий
      // у снятых сторожей выше в этом файле), а находка дизайн-ревью,
      // которую держали прежние две строки («второго и третьего акцента,
      // заголовок группы и ссылки, быть не должно»), зафиксирована в
      // комментарии `Footer.astro` (`.links a`, «Правка дизайн-ревью
      // 2026-08-22») — сравнивать здесь больше нечего.
    });
}

/* Сторож на правило дизайн-ревью 2026-08-19: ссылка ВНУТРИ ПРОЗЫ обязана
 * остаться подчёркнутой постоянно (единственный небуквенный отличитель от
 * текста абзаца), а ссылка в СПИСКЕ/МЕНЮ — нести подчёркивание только на
 * `:hover`/`:focus-visible` (роль читается местом, постоянная черта — шум).
 * Ревью нашло двенадцать подчёркнутых ссылок на странице: восемь в подвале
 * (пять «РАЗДЕЛЫ» + три юридические), два прямых канала в контактной секции
 * («Расскажите о задаче» → «Не любите формы — напишите сразу») — им черта
 * положена только под курсором/фокусом; ссылки внутри прозы формы (согласие,
 * отдельная Политика и запасной Telegram в сообщении об ошибке) — им черта
 * положена всегда, их этот сторож не трогает.
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

    // Колонка «Разделы» (`nav[aria-labelledby="footer-sections"]`) снята
    // вариантом Ф-Б — юридический ряд остался единственной навигацией
    // подвала, и его доступное имя несёт `aria-label` на самом `<nav>`, а не
    // `aria-labelledby` на видимом заголовке (заголовков в подвале больше
    // нет вовсе).
    const menuLinks = [
      'footer nav[aria-label] a',
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
    const proseLinks = [
      '#contact .consent a',
      '#contact .privacy-note a',
    ];
    for (const selector of proseLinks) {
      const s = await underlineState(selector);
      expect(s.deco, `${selector}: ссылка внутри прозы без подчёркивания`)
        .toContain('underline');
    }
  });
