import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ABOUT_LEAD, ABOUT_BLOCKS, ABOUT_CLOSING, ABOUT_CLIENT_LABEL } from '../data/about';
import { BRAND_MARKERS, brandTextSegments } from '../lib/brandMarkers';
import { FAQ_ITEMS } from '../data/faq';
import { telegramHandle, EMAIL } from '../lib/contacts';
import { SERVICE_GROUPS } from '../data/services';

/* Тот же паттерн, что `dist-home-process-guarantees.test.ts`: читает
 * `dist/index.html` напрямую, без браузера, — доказывает, что текст секций
 * 9, 10 и 11 присутствует в статической сборке без выполнения JavaScript
 * (план `02-home-plan.md`, «Статика прежде всего»). Требует `npm run build`
 * перед `npm run test:unit`. */
const DIST_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));

describe('dist/index.html — секции 9, 10 и 11', () => {
  it('сборка существует (npm run build перед этим набором)', () => {
    if (!existsSync(DIST_INDEX)) {
      throw new Error(
        `\n${DIST_INDEX} не найден. Сначала выполни \`npm run build\` в web/, ` +
        'затем повтори `npm run test:unit`.',
      );
    }
    expect(true).toBe(true);
  });

  if (!existsSync(DIST_INDEX)) return;
  const html = readFileSync(DIST_INDEX, 'utf8');

  it('секция 9: метка, заголовок, фото и весь текст дословно на странице', () => {
    expect(html).toContain('КТО ЭТО ДЕЛАЕТ');
    expect(html).toContain('>Обо мне<');
    expect(html).toContain('src="/wfeels-photo.avif"');
    expect(html).toContain(ABOUT_LEAD);
    // `ABOUT_BLOCKS` — плоский список текстов без заголовков (брифом
    // `04-sections-brief.md`, раздел 4.3, пункт 15: подзаголовки сняты) —
    // проверяется присутствие самого текста, не снятого `title`.
    //
    // Ищется не строка целиком, а каждый её кусок между значками марок:
    // значок разрывает предложение на несколько текстовых узлов, и целиком
    // такой строки в разметке нет по устройству. Проверка от этого не
    // слабеет — куски покрывают весь текст, кроме самих маркеров.
    for (const block of ABOUT_BLOCKS) {
      for (const segment of brandTextSegments(block)) {
        expect(html, segment.slice(0, 40)).toContain(segment);
      }
    }
    // Маркер значка не должен доехать до страницы буквально: `{claude}` в
    // разметке значил бы, что разбор не отработал, а текст всё равно на месте.
    for (const marker of BRAND_MARKERS) {
      expect(html, `маркер {${marker}} остался в разметке`).not.toContain(`{${marker}}`);
    }
    const closing = /<p class="closing ink"[^>]*>([\s\S]*?)<\/p>/.exec(html);
    expect(closing, 'закрывающая фраза «Обо мне» не найдена').not.toBeNull();
    expect(closing![1].replace(/<[^>]+>/g, '')).toBe(ABOUT_CLOSING);
  });

  it('секция 9: формулировка «зоосервис в Москве» присутствует — единственное место с «клиент»', () => {
    // Положительная проверка вместо отрицательной (план, задача 12, «Про имя
    // клиента»): проверить отсутствие имени в репозитории сайта значило бы
    // вписать имя в файл теста. Здесь утверждается только формулировка.
    expect(html).toContain(ABOUT_CLIENT_LABEL);
  });

  it('секция 10: метка, заголовок и все пять вопросов дословно на странице', () => {
    expect(html).toContain('ЧАСТЫЕ ВОПРОСЫ');
    expect(html).toContain('Что обычно спрашивают');
    for (const item of FAQ_ITEMS) {
      expect(html, item.question).toContain(item.question);
    }
  });

  it('частые вопросы остаются видимым контентом, но не дублируются в FAQPage', () => {
    const scripts = [...html.matchAll(
      /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    )].map((m) => JSON.parse(m[1].replace(/\\u003C/g, '<')));
    const faqBlocks = scripts.filter((s) => s['@type'] === 'FAQPage');
    expect(faqBlocks, 'FAQPage для коммерческого портфолио не выпускается').toHaveLength(0);

    const websiteBlocks = scripts.filter((s) => s['@type'] === 'WebSite');
    expect(websiteBlocks, 'блок WebSite остаётся на месте').toHaveLength(1);
  });

  it('секция 11: метка, заголовок, форма и запасной путь в Telegram', () => {
    expect(html).toContain('ПОСЛЕДНИЙ ШАГ');
    expect(html).toContain('Расскажите о задаче');
    expect(html).toContain('id="lead-form"');
    expect(html).toContain(telegramHandle());
    expect(html).toContain('https://t.me/wfeels');
  });

  it('секция 11: почта кликабельна, а сама кнопка не несёт буквального адреса', () => {
    expect(html).toContain('mailto:i&#64;dsaburov&#46;ru');
    // Простой сборщик почты ищет в сыром HTML подстроку вида «адрес@домен».
    // Проверка сужена до самой кнопки (`contact-action`), а не всей страницы:
    // с 2026-08-26 адрес подвала (`Footer.astro`, `LEGAL_EMAIL`, юридические
    // реквизиты) и адрес кнопки — один и тот же `i@dsaburov.ru` (решение
    // владельца, единый контактный адрес). Подвал показывает его открытым
    // текстом намеренно — так того требует раскрытие оператора персональных
    // данных, — и это не тот канал, который защищается от сборщика здесь.
    const actions = [...html.matchAll(
      /<a[^>]*class="contact-action"[^>]*>([\s\S]*?)<\/a>/g,
    )];
    const emailButton = actions.find((m) => m[1].includes('Написать на почту'));
    expect(emailButton, 'кнопка почты найдена').toBeDefined();
    expect(emailButton![0]).not.toContain(EMAIL);
    // Двойного экранирования нет: `&amp;#64;` значило бы, что ссылка
    // разворачивается не в «@», а в буквальный текст «&#64;».
    expect(html).not.toContain('&amp;#64;');
  });

  it('заголовок секции 11 дословно совпадает с заголовком /contact', () => {
    const contactPath = fileURLToPath(new URL('../../dist/contact/index.html', import.meta.url));
    if (!existsSync(contactPath)) return;
    const contactHtml = readFileSync(contactPath, 'utf8');
    expect(contactHtml).toContain('Расскажите о задаче');
  });

  // Задача 18 (правка 2026-08-19): форма поднята к тексту, текст сокращён до
  // одного предложения, строка «Не любите формы» и список прямых каналов
  // уступили место двум кнопкам.
  it('секция 11: текст сокращён до одного предложения (первое из утверждённого)', () => {
    expect(html).toContain('Напишите пару строк: что нужно — или что сейчас не работает.');
    // Второй абзац утверждённого текста снят целиком — не обрезан посередине.
    expect(html).not.toContain('Дальше несколько вопросов и вилка срока и цены');
  });

  it('секция 11: строки «Не любите формы» больше нет', () => {
    expect(html).not.toContain('Не любите формы');
  });

  it('секция 11: две кнопки прямой связи под текстом, со значками', () => {
    // Каждая кнопка целиком — свой `<a>`, содержащий и `<svg>` значка, и
    // видимую подпись; окно `[\s\S]*?` нежадное, поэтому не проглатывает
    // соседнюю кнопку, а атрибуты у двух кнопок в разном порядке (одна —
    // обычная разметка Astro, другая — `set:html`), поэтому href ищется
    // ЛЮБЫМ атрибутом внутри тега, не первым.
    const actions = [...html.matchAll(
      /<a[^>]*class="contact-action"[^>]*>([\s\S]*?)<\/a>/g,
    )];
    expect(actions, 'обе кнопки прямой связи найдены').toHaveLength(2);

    const telegram = actions.find((m) => m[1].includes('Написать в Telegram'));
    const email = actions.find((m) => m[1].includes('Написать на почту'));
    expect(telegram, 'кнопка Telegram').toBeDefined();
    expect(email, 'кнопка почты').toBeDefined();
    expect(telegram![1]).toContain('<svg');
    expect(email![1]).toContain('<svg');

    const fullTelegramTag = html.slice(
      html.lastIndexOf('<a', telegram!.index),
      telegram!.index! + telegram![0].length,
    );
    expect(fullTelegramTag).toContain('href="https://t.me/wfeels"');

    const fullEmailTag = html.slice(
      html.lastIndexOf('<a', email!.index),
      email!.index! + email![0].length,
    );
    expect(fullEmailTag).toContain('href="mailto:i&#64;dsaburov&#46;ru"');
  });

  it('секция 11: выпадающий список услуг ровно из каталога `data/services.ts`', () => {
    // Сторож на задачу 18: список не должен разойтись со SERVICE_GROUPS —
    // второй ручной перечень услуг молча расползся бы при следующей правке
    // одного из двух мест. Разбирается ИЗ dist, а не мимо него.
    const selectMatch = /<select id="f-service"[^>]*>([\s\S]*?)<\/select>/.exec(html);
    expect(selectMatch, 'select#f-service не найден в разметке').not.toBeNull();
    const selectHtml = selectMatch![1];

    const optgroups = [...selectHtml.matchAll(/<optgroup label="([^"]+)"[^>]*>([\s\S]*?)<\/optgroup>/g)];
    expect(optgroups.map((m) => m[1])).toEqual(SERVICE_GROUPS.map((g) => g.title));

    optgroups.forEach(([, , groupHtml], i) => {
      const options = [...groupHtml.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)]
        .map((m) => ({ code: m[1], text: m[2] }));
      const expected = SERVICE_GROUPS[i].links.map((l) => ({ code: l.code, text: l.text }));
      expect(options, `группа «${SERVICE_GROUPS[i].title}»`).toEqual(expected);
    });

    // Плейсхолдер-опция обязана быть отключена и не иметь кода: иначе форма
    // без JS отправится с пустым service, а он обязателен.
    expect(selectHtml).toMatch(/<option value="" disabled selected hidden[^>]*>Выберите услугу<\/option>/);
  });
});
