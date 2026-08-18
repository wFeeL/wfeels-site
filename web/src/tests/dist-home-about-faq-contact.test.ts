import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ABOUT_LEAD, ABOUT_BLOCKS, ABOUT_CLOSING, ABOUT_CLIENT_LABEL } from '../data/about';
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
    expect(html).toContain('src="/wfeels-photo.jpg"');
    expect(html).toContain(ABOUT_LEAD);
    // `ABOUT_BLOCKS` — плоский список текстов без заголовков (брифом
    // `04-sections-brief.md`, раздел 4.3, пункт 15: подзаголовки сняты) —
    // проверяется присутствие самого текста, не снятого `title`.
    for (const block of ABOUT_BLOCKS) {
      expect(html, block.slice(0, 40)).toContain(block);
    }
    expect(html).toContain(ABOUT_CLOSING);
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

  it('ld+json несёт ровно один блок FAQPage, второго на странице нет', () => {
    const scripts = [...html.matchAll(
      /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    )].map((m) => JSON.parse(m[1].replace(/\\u003C/g, '<')));
    const faqBlocks = scripts.filter((s) => s['@type'] === 'FAQPage');
    expect(faqBlocks, 'ровно один блок FAQPage в разметке').toHaveLength(1);
    expect(faqBlocks[0].mainEntity).toHaveLength(FAQ_ITEMS.length);

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

  it('секция 11: почта кликабельна, но в исходнике нет буквального адреса', () => {
    expect(html).toContain('mailto:githubwfeel&#64;gmail&#46;com');
    // Простой сборщик почты ищет в сыром HTML подстроку вида «адрес@домен» —
    // такой подстроки в разметке нет вовсе, есть только числовая ссылка.
    expect(html).not.toContain(EMAIL);
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
    expect(fullEmailTag).toContain('href="mailto:githubwfeel&#64;gmail&#46;com"');
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
