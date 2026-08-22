import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TOP_CARDS, SHELF_CARDS, topCards, shelfCards } from '../../data/pricingShowcase';

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

  it('на полке — шесть карточек из витрины, все через данные', () => {
    expect(raw).toContain('SHELF_CARDS.map');
    for (const card of SHELF_CARDS) {
      expect(raw).not.toContain(`>${card.label}<`); // подпись не вписана литералом — идёт через {item.label}
    }
  });
});

/* Метки спроса были запрещены целиком (спека, пункт 7; D-029) — статистики
 * продаж не существует. Правка владельца 2026-08-13 («Секция цен — десять
 * правок владельца», часть 2) — ОСОЗНАННАЯ И ОКОНЧАТЕЛЬНАЯ отмена D-029,
 * принятая владельцем лично: одна конкретная строка, «Самый популярный»,
 * теперь разрешена дословно как ярлык рекомендуемой карточки («Корпоративный
 * сайт»). Сторож НЕ удалён — он сузился до белого списка ровно этой одной
 * строки. Любая ДРУГАЯ метка спроса («хит продаж», «популярное» в значении
 * статистики, «выбор клиентов», «чаще всего заказывают» и однокоренные/
 * синонимичные варианты) по-прежнему запрещена везде — и в разметке
 * компонента, и в данных витрины. */
/* Разрешённых строк две — по одной на язык, и вторая появилась 2026-08-22
   вместе с английской главной. Отмена D-029 была сужена до ОДНОЙ строки, а
   не до одного языка: английская витрина ставит ту же метку на ту же
   карточку, и запрет на любую ДРУГУЮ метку спроса действует на ней ровно так
   же. Без этой пары английская страница осталась бы вне правила, которое
   русская соблюдает, — и «bestseller» уехал бы на неё молча. */
const ALLOWED_DEMAND_LABELS = ['Самый популярный', 'Most popular'];

const DEMAND_CLAIM_WORDS = [
  'хит продаж',
  'популярн', // популярное, популярный, популярностью — кроме разрешённой строки выше
  'выбор клиентов',
  'чаще всего заказывают',
  'бестселлер',
  'лидер продаж',
  'самый заказываемый',
  'топ продаж',
  // Английские формы того же утверждения. `popular` как основа ловит
  // `popular`, `popularity`, `most popular` — кроме разрешённой строки,
  // которая вырезается до поиска.
  'bestseller',
  'best seller',
  'best-selling',
  'popular',
  'top choice',
  'customers choose',
  'most ordered',
  'top seller',
];

/** Ищет запрещённую метку спроса, ПРЕДВАРИТЕЛЬНО вырезав из текста
 *  единственную разрешённую строку — иначе «популярн» как основа ловила бы
 *  и легитимный ярлык «Самый популярный». Любое другое употребление слова
 *  «популярн…» (не внутри дословной разрешённой строки) по-прежнему красит
 *  тест. */
function findDemandClaim(text: string): string | null {
  let withoutAllowed = text;
  for (const allowed of ALLOWED_DEMAND_LABELS) {
    withoutAllowed = withoutAllowed.split(allowed).join('');
  }
  const lower = withoutAllowed.toLowerCase();
  for (const word of DEMAND_CLAIM_WORDS) {
    if (lower.includes(word)) return word;
  }
  return null;
}

describe('Pricing.astro — сторож меток спроса (отмена D-029 сужена до одной строки, не удалена)', () => {
  it('в исходнике компонента нет ни одной метки спроса, КРОМЕ разрешённой «Самый популярный»', () => {
    const hit = findDemandClaim(raw);
    expect(hit, `найдена метка спроса «${hit}» в Pricing.astro`).toBeNull();
  });

  it('в данных витрины (имена карточек, ярлык, подписи полки) нет ни одной ДРУГОЙ метки спроса', () => {
    for (const card of TOP_CARDS) {
      expect(findDemandClaim(card.showcaseName), `карточка «${card.showcaseName}»`).toBeNull();
      if (card.recommended) {
        expect(findDemandClaim(card.recommended.label), `ярлык «${card.showcaseName}»`).toBeNull();
      }
    }
    for (const card of SHELF_CARDS) {
      expect(findDemandClaim(card.label), `карточка полки «${card.label}»`).toBeNull();
    }
  });

  it('ярлык рекомендуемой карточки — дословно разрешённая строка своего языка, и ровно на одной карточке', () => {
    for (const [locale, cards] of [['ru', topCards('ru')], ['en', topCards('en')]] as const) {
      const recommended = cards.filter((c) => c.recommended);
      expect(recommended, `${locale}: рекомендуемая карточка обязана быть ровно одна`).toHaveLength(1);
      expect(ALLOWED_DEMAND_LABELS, `${locale}: ярлык «${recommended[0].recommended!.label}» не из белого списка`)
        .toContain(recommended[0].recommended!.label);
    }
  });

  // Английская витрина проверяется тем же сторожем, что русская: правило одно
  // на обе версии страницы, и «most popular» в чужом месте — такая же
  // непроверяемая метка спроса, как «хит продаж».
  it('в английской витрине нет ни одной ДРУГОЙ метки спроса', () => {
    for (const card of topCards('en')) {
      expect(findDemandClaim(card.showcaseName), `карточка «${card.showcaseName}»`).toBeNull();
      if (card.recommended) {
        expect(findDemandClaim(card.recommended.label), `ярлык «${card.showcaseName}»`).toBeNull();
      }
    }
    for (const card of shelfCards('en')) {
      expect(findDemandClaim(card.label), `карточка полки «${card.label}»`).toBeNull();
    }
  });

  // Доказательство, что сторож действительно ловит запрещённые формулировки,
  // а не всегда возвращает null: та же функция-детектор на заведомо плохом
  // тексте обязана вернуть слово, а не пройти молча. И отдельно — что
  // разрешённая строка проходит МИМО детектора, а любая другая формулировка
  // со словом «популярн» — нет.
  it('доказательство красноты: детектор ловит каждую из запрещённых формулировок', () => {
    expect(findDemandClaim('Это хит продаж сезона')).toBe('хит продаж');
    expect(findDemandClaim('Самое популярное решение')).toBe('популярн');
    // Тот же детектор на английских формулировках: разрешённая строка
    // проходит мимо, любая другая — краснеет.
    expect(findDemandClaim('Most popular')).toBeNull();
    expect(findDemandClaim('Our bestseller')).toBe('bestseller');
    expect(findDemandClaim('A popular choice')).toBe('popular');
    expect(findDemandClaim('Выбор клиентов номер один')).toBe('выбор клиентов');
    expect(findDemandClaim('Чаще всего заказывают именно этот пакет')).toBe('чаще всего заказывают');
    expect(findDemandClaim('Обычный нейтральный текст без утверждений о спросе')).toBeNull();
    for (const allowed of ALLOWED_DEMAND_LABELS) {
      expect(findDemandClaim(allowed), `разрешённая строка «${allowed}» не должна красить тест`).toBeNull();
    }
  });
});
