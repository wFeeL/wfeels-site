import { describe, it, expect } from 'vitest';
import { TELEGRAM_URL, telegramHandle, EMAIL, emailLinkHtml, emailButtonHtml } from './contacts';

describe('telegramHandle', () => {
  it('выводится из TELEGRAM_URL, а не хранится второй строкой', () => {
    expect(telegramHandle()).toBe('@wfeels');
    expect(TELEGRAM_URL).toBe(`https://t.me/${telegramHandle().slice(1)}`);
  });
});

describe('emailLinkHtml', () => {
  it('в разметке нет буквального «@» — только числовая ссылка &#64;', () => {
    const html = emailLinkHtml('Почта');
    expect(html).not.toContain(EMAIL);
    expect(html).not.toContain('@');
    expect(html).toContain('&#64;');
    expect(html).toContain('&#46;');
  });

  it('href разворачивается ровно в EMAIL — по одному проходу декодирования HTML-сущностей', () => {
    const html = emailLinkHtml('Почта');
    const hrefMatch = html.match(/href="mailto:([^"]+)"/);
    expect(hrefMatch).not.toBeNull();
    const decoded = hrefMatch![1].replace(/&#64;/g, '@').replace(/&#46;/g, '.');
    expect(decoded).toBe(EMAIL);
    // Один проход, не два: экранированный амперсанд `&amp;#64;` доказывал бы
    // двойное экранирование (баг, пойманный при сборке 2026-08-13 — Astro
    // экранирует `&` в значениях атрибутов, заданных через `{}`).
    expect(html).not.toContain('&amp;');
  });

  it('видимая подпись совпадает с href — один и тот же экранированный адрес', () => {
    const html = emailLinkHtml('Почта');
    const strongMatch = html.match(/<strong>([^<]+)<\/strong>/);
    const hrefMatch = html.match(/href="mailto:([^"]+)"/);
    expect(strongMatch![1]).toBe(hrefMatch![1]);
  });
});

// Задача 18 (правка 2026-08-19): кнопка «Написать на почту» секции
// «Расскажите о задаче» — та же защита адреса, что у `emailLinkHtml`, только
// с иконкой перед подписью, а не строкой «Почта · адрес».
describe('emailButtonHtml', () => {
  it('в разметке нет буквального «@» — только числовая ссылка &#64;', () => {
    const html = emailButtonHtml('Написать на почту');
    expect(html).not.toContain(EMAIL);
    expect(html).not.toContain('@');
    expect(html).toContain('&#64;');
    expect(html).toContain('&#46;');
    expect(html).not.toContain('&amp;');
  });

  it('несёт значок и видимую подпись, класс необязателен', () => {
    const html = emailButtonHtml('Написать на почту', 'contact-action');
    expect(html).toContain('class="contact-action"');
    expect(html).toContain('<svg');
    expect(html).toContain('<span>Написать на почту</span>');
  });
});
