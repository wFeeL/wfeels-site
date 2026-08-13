import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* Сторож шрифта цены.
 *
 * Владелец 2026-08-13: «мне не нравится шрифт для цифр… не нравится, что у
 * ноликов там внутри какие-то точки». Точка внутри нуля — фирменная цифра
 * JetBrains Mono; сами числа переведены на заголовочный Manrope.
 *
 * Тест существует потому, что эта правка УЖЕ была объявлена сделанной и не
 * была сделана: коммит назывался «цена заголовочным шрифтом», а в CSS
 * оставался `--font-mono`. Приёмка пропустила — ни один тест шрифта не
 * проверял. Здесь проверяется само свойство, а не намерение автора коммита.
 *
 * Проверяются ТОЛЬКО селекторы самого числа. Соседи по строке цены —
 * предлог «от» (`.price .from`) и срок (`.price .timeframe`) — остаются
 * моноширинными намеренно: они метки, а не число, и контраст гарнитур here
 * работает на иерархию. Первая редакция этого сторожа хватала все правила со
 * словом `price` в селекторе, ловила эти двa и падала на верном коде.
 *
 * Читаются ИСХОДНИКИ, а не сборка: в собранном CSS переменная развёрнута в
 * имя гарнитуры, и тест перестал бы отличать «взяли токен» от «вписали шрифт
 * руками» — а второе ломает смену гарнитуры в одном месте. */
const PRICE_SELECTORS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['home/Pricing.astro', ['.price code', '.shelf-price code']],
  ['home/Hero.astro', ['.offer-price']],
];

function ruleBody(src: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(^|[,}])\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(src);
  return m ? m[2] : null;
}

describe('шрифт цены — заголовочный, не моноширинный', () => {
  for (const [file, selectors] of PRICE_SELECTORS) {
    for (const selector of selectors) {
      it(`${file}: «${selector}» набирает число заголовочным шрифтом`, () => {
        const src = readFileSync(
          fileURLToPath(new URL(`../components/${file}`, import.meta.url)),
          'utf8',
        );
        const body = ruleBody(src, selector);

        expect(
          body,
          `в ${file} не нашлось правила «${selector}» — цену переименовали, ` +
          'и сторож перестал сторожить молча. Обнови список селекторов здесь.',
        ).not.toBeNull();

        expect(
          body!,
          `${file}, «${selector}» набирает цену моноширинным: у JetBrains Mono ` +
          'точка внутри нуля, владелец её отклонил 2026-08-13',
        ).not.toContain('--font-mono');

        expect(
          body!,
          `${file}, «${selector}»: число обязано брать --font-head токеном, ` +
          'а не именем гарнитуры — иначе смена шрифта перестанет быть правкой в одном месте',
        ).toContain('--font-head');
      });
    }
  }
});
