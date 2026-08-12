import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PRICING } from '../../data/pricing';

/* Требование блокера B1 (финальное дизайн-ревью, задача 8 плана): «в разметке
 * секции нет ни одного числа, все приходят из данных». Строже, чем проверка
 * секций 1–3 в `home-sections.test.ts` (та ловит только ₽/%/срок) — здесь ни
 * одной цифры вообще, потому что вся секция — таблица цен, и любая цифра,
 * набранная руками, рискует разойтись с `data/pricing.ts` молча. Читает
 * исходный `.astro`, не `dist/` — число, вписанное в разметку, красит тест
 * независимо от того, что попадёт в сборку. */

/** Оставляет только шаблон разметки (то, что реально попадёт на страницу) —
 *  без фронтматтера между `---`/`---`, где живут JS-логика, комментарии и
 *  ссылки на файлы вроде «02-texts.md»: они не рендерятся читателю, и цифра
 *  в них — не то, что ловит требование «ни одного числа в разметке». */
function templateOnly(source: string): string {
  const secondFence = source.indexOf('---', source.indexOf('---') + 3);
  return secondFence === -1 ? source : source.slice(secondFence + 3);
}

function stripNonProse(source: string): string {
  return templateOnly(source)
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    // Открывающие/закрывающие теги и их атрибуты — не текст читателя: цифра
    // в имени тега (`h2`) или классе (`t-h2`) не то, что ловит требование.
    // Остаётся текст между тегами и JSX-выражения `{…}` (там нет литералов —
    // только ссылки на поля данных, first-child-класс.astro-скоупа и т.п.).
    .replace(/<[^>]*>/g, ' ');
}

describe('Pricing.astro — ни одной цифры в разметке, всё из data/pricing.ts', () => {
  const path = fileURLToPath(new URL('./Pricing.astro', import.meta.url));
  const raw = readFileSync(path, 'utf8');
  const template = stripNonProse(raw);

  it('в шаблоне разметки (без фронтматтера, стилей и комментариев) нет ни одной цифры', () => {
    const match = /\d/.exec(template);
    expect(match, `найдена цифра «${match?.[0]}» рядом: …${template.slice(Math.max(0, (match?.index ?? 0) - 30), (match?.index ?? 0) + 10)}…`)
      .toBeNull();
  });

  it('компонент читает цены из PRICING, а не хранит их сам', () => {
    expect(raw).toContain("from '../../data/pricing'");
  });
});

describe('Pricing.astro — пять групп секции 4, как в data/pricing.ts', () => {
  it('группировка — пять групп в порядке данных, а не пять разделов PRICING.md вручную', () => {
    expect(PRICING.map((g) => g.name)).toEqual([
      'Сайты', 'Автоматизация и интеграции', 'ИИ', 'Telegram', 'Поддержка',
    ]);
  });
});
