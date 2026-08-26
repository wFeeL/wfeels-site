import { test, expect } from '@playwright/test';

/* Сторож против возврата дефекта дизайн-ревью 2026-08-22 (находка 3): у
 * `body` стоял переход по цвету, а у `header`/`main`/`footer` — 0s, и кадр
 * через 70 мс после нажатия показывал шапку уже финального цвета, а фон
 * страницы — ещё в пути (половина страницы плывёт, половина щёлкает).
 *
 * Правка 2026-08-26 (жалоба владельца «лаганно») сделала смену темы по
 * клику МГНОВЕННОЙ под маской волны (`.theme-instant`, `base.css`) — замер
 * трассировкой рендерера показал 1355 операций `Paint` за клик до правки
 * против 283 после (боевая сборка, главная, CDP `Tracing`). Раз смены
 * больше нет как процесса (0.01ms, а не 0s), «одновременно» проверяется не
 * сравнением СКОРОСТИ перехода разных узлов, а тем, что через один кадр
 * после клика — шапка, страница, подвал и карточка уже показывают цвет одной
 * и той же новой темы. Ровно один кадр, а не «сразу же без ожидания»:
 * ловушка 12 (`50-code/CLAUDE.md`) — `0.01ms` всё равно заводит переход как
 * процесс, и `getComputedStyle`, прочитанный в ТОМ ЖЕ синхронном стеке, что
 * и клик, честно возвращает СТАРТОВОЕ значение перехода (проверено: прямой
 * `document.documentElement.dataset.theme = 'dark'` меняет `--text`
 * мгновенно и без ожидания, а клик по кнопке — нет, пока не пройдёт
 * `requestAnimationFrame` дважды). Кадр даётся всем четырём узлам поровну —
 * значит остаётся ровно то, что проверяет сторож: расходятся они или нет,
 * а не сама скорость. */
/* `header`, `main`, `footer` и `.card` несут РАЗНЫЕ роли токена (полный
 * текст, приглушённый текст подвала, поверхность карточки) — сравнивать их
 * между собой напрямую нельзя, это не то же самое, что «отстал» (первая
 * версия сторожа так и упала: подвал закономерно темнее шапки в обеих темах,
 * это не рассинхрон). Верная проверка — сравнить КАЖДЫЙ узел с током,
 * который его красит, читая сам токен с `:root` в тот же момент: если узел
 * отстал от токена, его цвет не совпадёт с уже обновившимся значением
 * переменной. */
const readState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const token = (name: string) => cs.getPropertyValue(name).trim();
    const colorOf = (sel: string) =>
      getComputedStyle(document.querySelector(sel)!).color;
    const bgOf = (sel: string) =>
      getComputedStyle(document.querySelector(sel)!).backgroundColor;
    return {
      theme: document.documentElement.dataset.theme,
      tokenText: token('--text'),
      tokenTextMuted: token('--text-muted'),
      tokenSurface: token('--surface'),
      header: colorOf('header'),
      main: colorOf('#main'),
      footer: colorOf('footer'),
      card: bgOf('.card'),
    };
  });

// Токены — hex-строки из tokens.css, `getComputedStyle` их не резолвит в rgb()
// сам по себе (это буквенное значение custom property), а цвет узла браузер
// вычисляет уже как rgb(). Сравнение поэтому идёт через явный список hex →
// rgb ниже, а не строковым равенством.
const HEX_TO_RGB: Record<string, string> = {
  '#0f1620': 'rgb(15, 22, 32)',
  '#dce3ee': 'rgb(220, 227, 238)',
  '#5b6675': 'rgb(91, 102, 117)',
  '#93a0b4': 'rgb(147, 160, 180)',
  '#ffffff': 'rgb(255, 255, 255)',
  '#141c2a': 'rgb(20, 28, 42)',
};
const rgb = (hex: string): string => {
  const found = HEX_TO_RGB[hex.toLowerCase()];
  if (!found) throw new Error(`токен ${hex} не внесён в карту сторожа — допиши HEX_TO_RGB`);
  return found;
};

test.describe('синхронность смены темы', () => {
  test('шапка, страница, подвал и карточка синхронно уходят в новую тему',
    async ({ page }) => {
      await page.goto('/');
      for (const sel of ['header', '#main', 'footer', '.card']) {
        await expect(page.locator(sel).first()).toBeVisible();
      }

      const before = await readState(page);
      expect(before.theme, 'страница уже была в тёмной теме до клика — тест не проверит переход')
        .not.toBe('dark');

      await page.locator('#theme-toggle').click();

      // Ровно один отрисованный кадр после клика — не «два одинаковых
      // чтения подряд» (ловушка 12, `50-code/CLAUDE.md`: это не отличает
      // конец перехода от его начала) и не таймаут-угадайка, а граница,
      // которую сам браузер обязан пересечь, чтобы вообще что-то нарисовать.
      // Проверено: прямой `dataset.theme = 'dark'` меняет `--text` внутри
      // ОДНОГО evaluate без ожидания, а клик по кнопке — нет, пока не
      // пройдёт `requestAnimationFrame` дважды (переход `0.01ms` — всё ещё
      // переход как процесс, не «0s»).
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );

      const after = await readState(page);
      expect(after.theme, 'клик не переключил тему').toBe('dark');

      expect(after.header, 'шапка отстала от токена --text')
        .toBe(rgb(after.tokenText));
      expect(after.main, 'страница отстала от токена --text')
        .toBe(rgb(after.tokenText));
      expect(after.footer, 'подвал отстал от токена --text-muted')
        .toBe(rgb(after.tokenTextMuted));
      expect(after.card, 'карточка отстала от токена --surface')
        .toBe(rgb(after.tokenSurface));
    });
});
