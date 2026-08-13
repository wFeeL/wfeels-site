import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TOP_CARDS, SHELF_ROWS, SUPPORT_AUDIT_ROW } from '../../data/pricingShowcase';

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

const path = fileURLToPath(new URL('./Pricing.astro', import.meta.url));
const raw = readFileSync(path, 'utf8');
const template = stripNonProse(raw);

describe('Pricing.astro — ни одной цифры в разметке, всё из data/pricing.ts', () => {
  it('в шаблоне разметки (без фронтматтера, стилей и комментариев) нет ни одной цифры', () => {
    const match = /\d/.exec(template);
    expect(match, `найдена цифра «${match?.[0]}» рядом: …${template.slice(Math.max(0, (match?.index ?? 0) - 30), (match?.index ?? 0) + 10)}…`)
      .toBeNull();
  });

  it('компонент читает витрину из pricingShowcase, а не хранит цены сам', () => {
    expect(raw).toContain("from '../../data/pricingShowcase'");
  });
});

describe('Pricing.astro — три верхние карточки и полка, как в data/pricingShowcase.ts', () => {
  it('на странице ровно три верхние карточки — имена дословно из витрины', () => {
    for (const card of TOP_CARDS) {
      expect(raw).not.toContain(`>${card.showcaseName}<`); // имя не вписано литералом — идёт через {card.showcaseName}
    }
    expect(raw).toContain('TOP_CARDS.map');
  });

  it('на полке — три строки остальных групп плюс строка поддержки/аудита, все через данные', () => {
    expect(raw).toContain('SHELF_ROWS.map');
    expect(raw).toContain('SUPPORT_AUDIT_ROW');
    expect(raw).toContain('SUPPORT_ROW.');
    expect(raw).toContain('AUDIT_ROW.');
  });
});

/* Метки спроса запрещены (спека, пункт 7): статистики продаж не существует
 * (D-029). «хит продаж», «популярное», «выбор клиентов», «чаще всего
 * заказывают» и любые их варианты не должны появиться ни в разметке
 * компонента, ни в данных витрины — оба места читателю видны напрямую или
 * через `{…}`. Список слов сознательно шире буквальных четырёх примеров
 * спеки: ловит однокоренные варианты через основу «популярн» и очевидные
 * синонимы. */
const DEMAND_CLAIM_WORDS = [
  'хит продаж',
  'популярн', // популярное, популярный, популярностью
  'выбор клиентов',
  'чаще всего заказывают',
  'бестселлер',
  'лидер продаж',
  'самый заказываемый',
  'топ продаж',
];

function findDemandClaim(text: string): string | null {
  const lower = text.toLowerCase();
  for (const word of DEMAND_CLAIM_WORDS) {
    if (lower.includes(word)) return word;
  }
  return null;
}

describe('Pricing.astro — сторож меток спроса (D-029)', () => {
  it('в исходнике компонента нет ни одной метки спроса', () => {
    const hit = findDemandClaim(raw);
    expect(hit, `найдена метка спроса «${hit}» в Pricing.astro`).toBeNull();
  });

  it('в данных витрины (имена карточек, причина ярлыка, подписи полки) нет ни одной метки спроса', () => {
    for (const card of TOP_CARDS) {
      expect(findDemandClaim(card.showcaseName), `карточка «${card.showcaseName}»`).toBeNull();
      if (card.recommended) {
        expect(findDemandClaim(card.recommended.label), `ярлык «${card.showcaseName}»`).toBeNull();
        expect(findDemandClaim(card.recommended.reason), `причина «${card.showcaseName}»`).toBeNull();
      }
    }
    for (const row of [...SHELF_ROWS, ...SUPPORT_AUDIT_ROW]) {
      expect(findDemandClaim(row.label), `строка полки «${row.label}»`).toBeNull();
    }
  });

  // Доказательство, что сторож действительно ловит запрещённые формулировки,
  // а не всегда возвращает null: та же функция-детектор на заведомо плохом
  // тексте обязана вернуть слово, а не пройти молча.
  it('доказательство красноты: детектор ловит каждую из запрещённых формулировок', () => {
    expect(findDemandClaim('Это хит продаж сезона')).toBe('хит продаж');
    expect(findDemandClaim('Самое популярное решение')).toBe('популярн');
    expect(findDemandClaim('Выбор клиентов номер один')).toBe('выбор клиентов');
    expect(findDemandClaim('Чаще всего заказывают именно этот пакет')).toBe('чаще всего заказывают');
    expect(findDemandClaim('Обычный нейтральный текст без утверждений о спросе')).toBeNull();
  });
});
