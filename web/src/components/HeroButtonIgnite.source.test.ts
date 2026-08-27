import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Приёмка `70-workshop/specs/site-v3/11-line-narrator-brief.md`, раздел 3,
 *  П2(в), и `70-workshop/specs/site-v3/15-line-through-scale-brief.md`,
 *  раздел 4.2 (перенос порогов на сквозную шкалу `--line-head`). CSS живёт
 *  в литеральном `<style is:global>` (не в `set:html`-строке фронтматтера,
 *  как раньше — правка `2026-08-27`: сквозной шторке не нужно собирать
 *  реестр путей построчно, весь блок стал статическим), но правило читается
 *  из исходного текста файла напрямую, а не через собранный DOM — это
 *  дешёвая структурная проверка ДО сборки; фактическое поведение в браузере
 *  (ступенька цвета, пороги, запасные режимы) проверяет
 *  `e2e/background-line-narrator.spec.ts`.
 *
 *  Проверки написаны терпимо к пробелам вокруг `{`/`:` — статический
 *  `<style>` форматирован читаемо (не компактной строкой, как бывший
 *  `drawingSupportsCss`), и байтовая точность формату здесь не предмет
 *  теста. */

const SOURCE = readFileSync(
  new URL('./BackgroundLine.astro', import.meta.url),
  'utf8',
);

/** Убирает всё, кроме букв/цифр/пунктуации, значимой для CSS-сравнения —
 *  пробелы и переносы строк схлопывает в ничто. Так `#hero .cta .btn.primary{`
 *  и `#hero .cta .btn.primary {` (с пробелом перед скобкой, как в форматированном
 *  `<style>`) дают одну и ту же строку для поиска. */
function squash(css: string): string {
  return css.replace(/\s+/g, '');
}

const SQUASHED = squash(SOURCE);

describe('BackgroundLine.astro — кнопка первого экрана (раздел 3, П2; пороги — раздел 4.2 брифа 15-…)', () => {
  it('правило адресное — #hero .cta .btn.primary, не общий .btn.primary', () => {
    expect(SQUASHED).toContain('#hero.cta.btn.primary{');
  });

  it('живёт внутри @media (min-width:900px) — ниже 900 px рассказа нет', () => {
    const idx = SQUASHED.indexOf('#hero.cta.btn.primary{');
    const before = SQUASHED.slice(0, idx);
    const lastMediaOpen = before.lastIndexOf('@media(min-width:900px){');
    expect(lastMediaOpen, 'правило кнопки не найдено внутри @media (min-width:900px)').toBeGreaterThan(-1);
  });

  it('базовое состояние — --border/--text, статическое, БЕЗ анимации (диагноз стоимости отрисовки: перекраска самой кнопки стоила 880–1046 `Paint` за 60 тиков колеса, порог сторожа 320)', () => {
    const idx = SQUASHED.indexOf('#hero.cta.btn.primary{');
    const block = SQUASHED.slice(idx, SQUASHED.indexOf('}', idx));
    expect(block).toContain('background-color:var(--border)');
    expect(block).toContain('color:var(--text)');
    expect(block, 'кнопка не обязана нести ни одного anim-свойства — ступеньку рисует лестница слоёв').not.toContain('animation');
  });

  it('правило адресное — #hero .cta .cta-ignite-step, декоративные слои лестницы, а не сама кнопка', () => {
    expect(SQUASHED).toContain('#hero.cta.cta-ignite-step{');
  });

  it('общий блок лестницы живёт в той же @media (min-width:900px), сразу после блока кнопки', () => {
    const btnIdx = SQUASHED.indexOf('#hero.cta.btn.primary{');
    const stepIdx = SQUASHED.indexOf('#hero.cta.cta-ignite-step{');
    expect(stepIdx, 'общий блок лестницы обязан идти после блока кнопки').toBeGreaterThan(btnIdx);
    const between = SQUASHED.slice(SQUASHED.indexOf('}', btnIdx) + 1, stepIdx);
    expect(between, 'между блоком кнопки и общим блоком лестницы не должно быть закрытия @media').not.toContain('}');
  });

  it('fill-mode: forwards, не both — ступеньку несёт каждый слой, не сама кнопка', () => {
    const idx = SQUASHED.indexOf('#hero.cta.cta-ignite-step{');
    const block = SQUASHED.slice(idx, SQUASHED.indexOf('}', idx));
    expect(block).toContain('animation-fill-mode:forwards');
    expect(block).not.toContain('animation-fill-mode:both');
  });

  it('ступенька, не плавный переход: steps(1,jump-end), не linear и не var(--ease)', () => {
    const idx = SQUASHED.indexOf('#hero.cta.cta-ignite-step{');
    const block = SQUASHED.slice(idx, SQUASHED.indexOf('}', idx));
    expect(block).toContain('animation-timing-function:steps(1,jump-end)');
  });

  it('шкала — своя (безымянная view()) на коробке слоя, не именованная --line-progress секции', () => {
    const idx = SQUASHED.indexOf('#hero.cta.cta-ignite-step{');
    const block = SQUASHED.slice(idx, SQUASHED.indexOf('}', idx));
    expect(block).toContain('animation-timeline:view()');
    expect(block).not.toContain('--line-progress');
  });

  it('пять порогов лестницы (раздел 10.6 брифа 11-…, Р-3), перенесённых на --line-head (раздел 4.2 брифа 15-…): пятый совпадает со старым единственным, 1…4 сдвинуты раньше на (N−i)·8,8px', () => {
    const steps: [number, string][] = [
      [1, 'cover calc(100%-var(--line-head)-35.2px)'],
      [2, 'cover calc(100%-var(--line-head)-26.4px)'],
      [3, 'cover calc(100%-var(--line-head)-17.6px)'],
      [4, 'cover calc(100%-var(--line-head)-8.8px)'],
      [5, 'cover calc(100%-var(--line-head))'],
    ];
    for (const [step, endExpr] of steps) {
      const idx = SQUASHED.indexOf(`#hero.cta.cta-ignite-step[data-step="${step}"]{`);
      expect(idx, `правило для data-step="${step}" не найдено`).toBeGreaterThan(-1);
      const block = SQUASHED.slice(idx, SQUASHED.indexOf('}', idx));
      expect(
        block,
        `data-step="${step}": animation-range обязан начинаться на calc(100vh - var(--line-head)) — механическая замена var(--line-lead)`,
      ).toContain('animation-range:covercalc(100vh-var(--line-head))');
      expect(block, `data-step="${step}": animation-range обязан кончаться на ${endExpr}`).toContain(
        squash(endExpr),
      );
    }
  });

  it('токены --line-lead/--line-trail сняты из живого CSS (раздел 2.3/4.1 брифа 15-…) — заменены на --line-head', () => {
    // Комментарии объясняют историю правки прозой и законно упоминают
    // старые имена токенов — предмет проверки живой CSS-код, не текст
    // документации внутри /* … */.
    const withoutComments = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toContain('--line-lead');
    expect(withoutComments).not.toContain('--line-trail');
    expect(withoutComments).toContain('--line-head');
  });

  it('кадры ступеньки — opacity 0→1 (композитное свойство), не background-color/color', () => {
    const idx = SOURCE.indexOf('@keyframes hero-cta-ignite');
    const block = SOURCE.slice(idx, SOURCE.indexOf('}\n  }', idx) + 1);
    expect(block).toContain('opacity: 0');
    expect(block).toContain('opacity: 1');
    expect(block, 'некомпозитные background-color/color не должны вернуться в кадры').not.toContain('background-color');
  });

  it('@keyframes hero-cta-ignite объявлен ровно один раз и живёт статически', () => {
    const first = SOURCE.indexOf('@keyframes hero-cta-ignite');
    expect(first, '@keyframes hero-cta-ignite обязан быть в файле').toBeGreaterThan(-1);
    const second = SOURCE.indexOf('@keyframes hero-cta-ignite', first + 1);
    expect(second, '@keyframes hero-cta-ignite не должен дублироваться').toBe(-1);
  });

  it('Button.astro не тронут этим правилом — здесь его нет ни строкой, .primary остаётся акцентной по умолчанию', () => {
    const buttonSource = readFileSync(
      new URL('./Button.astro', import.meta.url),
      'utf8',
    );
    expect(buttonSource).not.toContain('hero-cta-ignite');
    expect(buttonSource).not.toContain('animation-timeline');
    expect(buttonSource).toContain('.primary { background: var(--accent); color: var(--text-on-accent); }');
  });
});
