import { describe, it, expect } from 'vitest';
import { SERVICE_GROUPS, NICHES, SERVICES_CATALOG_HREF } from './services';

describe('services.ts — внутренняя целостность', () => {
  it('четыре группы, в порядке Сайты · Автоматизация и интеграции · ИИ · Telegram', () => {
    expect(SERVICE_GROUPS.map((g) => g.title)).toEqual([
      'Сайты',
      'Автоматизация и интеграции',
      'ИИ',
      'Telegram',
    ]);
  });

  it('Telegram стоит четвёртым — не переставлять при правке', () => {
    expect(SERVICE_GROUPS.at(-1)?.title).toBe('Telegram');
  });

  it('у каждой группы 3–4 пункта', () => {
    for (const g of SERVICE_GROUPS) {
      expect(g.points.length, `«${g.title}»`).toBeGreaterThanOrEqual(3);
      expect(g.points.length, `«${g.title}»`).toBeLessThanOrEqual(4);
    }
  });

  it('у каждой группы хотя бы одна ссылка на посадочную', () => {
    for (const g of SERVICE_GROUPS) {
      expect(g.links.length, `«${g.title}»`).toBeGreaterThan(0);
    }
  });

  it('девять ссылок на посадочные всего — по числу услуг S1…S9', () => {
    const total = SERVICE_GROUPS.reduce((n, g) => n + g.links.length, 0);
    expect(total).toBe(9);
  });

  it('строка стека — латиницей, без кириллицы', () => {
    const cyrillic = /[а-яА-ЯёЁ]/;
    for (const g of SERVICE_GROUPS) {
      expect(cyrillic.test(g.stack), `«${g.title}»: «${g.stack}»`).toBe(false);
    }
  });

  it('ни одна цена и ни один срок не просочились в описания и пункты', () => {
    const rub = /₽/;
    const days = /\d+\s*[–-]\s*\d+\s*(дн|дня|дней|недел)/;
    for (const g of SERVICE_GROUPS) {
      expect(rub.test(g.description)).toBe(false);
      expect(days.test(g.description)).toBe(false);
      for (const p of g.points) {
        expect(rub.test(p)).toBe(false);
        expect(days.test(p)).toBe(false);
      }
    }
  });

  it('четыре ниши, дословно из 02-texts.md', () => {
    expect(NICHES.map((n) => n.text)).toEqual([
      'зооуслуги',
      'салоны и барбершопы',
      'мастера-ремесленники',
      'клиники',
    ]);
  });

  it('ссылки уникальны — ни одна посадочная не задвоена', () => {
    const hrefs = [
      ...SERVICE_GROUPS.flatMap((g) => g.links.map((l) => l.href)),
      ...NICHES.map((n) => n.href),
      SERVICES_CATALOG_HREF,
    ];
    expect(new Set(hrefs).size, 'повтор адреса среди ссылок секции').toBe(hrefs.length);
  });

  it('каталог услуг ведёт на /services', () => {
    expect(SERVICES_CATALOG_HREF).toBe('/services');
  });

  // Задача 18 (правка 2026-08-19): выпадающий список услуг в `LeadForm.astro`
  // берёт коды ОТСЮДА, а не из своего перечня. Бэкенд (`api/app/schemas.py`,
  // `SERVICE_LABELS`) ждёт РОВНО коды S1…S9 — расхождение здесь молча ломало
  // бы приём заявки (код вне каталога отвергается 422-й).
  it('коды услуг — ровно S1…S9, без повторов и пропусков', () => {
    const codes = SERVICE_GROUPS.flatMap((g) => g.links.map((l) => l.code));
    expect(new Set(codes).size, 'код услуги задвоен').toBe(codes.length);
    expect([...codes].sort()).toEqual(
      Array.from({ length: 9 }, (_, i) => `S${i + 1}`).sort(),
    );
  });
});
