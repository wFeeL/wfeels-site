import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ABOUT_LEAD, ABOUT_BLOCKS, ABOUT_CLOSING, ABOUT_CLIENT_LABEL } from '../data/about';
import { FAQ_ITEMS } from '../data/faq';
import { telegramHandle } from '../lib/contacts';

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
    for (const block of ABOUT_BLOCKS) {
      expect(html, block.title).toContain(block.title);
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

  it('заголовок секции 11 дословно совпадает с заголовком /contact', () => {
    const contactPath = fileURLToPath(new URL('../../dist/contact/index.html', import.meta.url));
    if (!existsSync(contactPath)) return;
    const contactHtml = readFileSync(contactPath, 'utf8');
    expect(contactHtml).toContain('Расскажите о задаче');
  });
});
