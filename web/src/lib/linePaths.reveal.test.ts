import { describe, expect, it } from 'vitest';
import { LINE_PATHS } from './linePaths';
import { flattenPath, resampleByLength } from './pathGeometry';

/** Сторож раскладки «шторки» (`RevealStop[]`, `linePaths.ts`) — задача
 *  «пролагивает при листании» (D-080, 2026-08-21), композитная замена
 *  `stroke-dashoffset` из спеки `70-workshop/specs/site-v3/05-line.md`,
 *  разделы 7.1–7.3 (изменение авторизовано владельцем).
 *
 *  Не проверяет «есть ли анимация» (намерение) — проверяет, что таблица,
 *  которой предстоит стать CSS `@keyframes`, воспроизводит ТУ ЖЕ самую
 *  раскладку, которую раньше давал `stroke-dashoffset` (открытие пути
 *  линейно по ДЛИНЕ ДУГИ), а не приблизительную. Это и есть жёсткое
 *  условие D-080 «картинка остаётся прежней» в машинной форме: если таблица
 *  разойдётся с дугой хоть на одном пути, сторож ловит расхождение до
 *  скриншота, а не после. */

describe('линия на фоне — таблица шторки воспроизводит раскрытие по длине дуги (D-080)', () => {
  it.each(Object.keys(LINE_PATHS))('%s: границы 0%% и 100%% совпадают с концами пути', (id) => {
    const entry = LINE_PATHS[id];
    const first = entry.reveal[0];
    const last = entry.reveal[entry.reveal.length - 1];
    expect(first.percent).toBe(0);
    expect(first.translate).toBe(0);
    expect(last.percent).toBe(100);
    expect(last.translate).toBe(100);
  });

  it.each(Object.keys(LINE_PATHS))('%s: таблица монотонна по обеим осям (шторка не пятится)', (id) => {
    const entry = LINE_PATHS[id];
    for (let i = 1; i < entry.reveal.length; i++) {
      expect(entry.reveal[i].percent).toBeGreaterThan(entry.reveal[i - 1].percent);
      expect(entry.reveal[i].translate).toBeGreaterThanOrEqual(entry.reveal[i - 1].translate);
    }
  });

  it.each(Object.keys(LINE_PATHS))('%s: прямые стопы попадают на реальную дугу (допуск 0.2%%)', (id) => {
    const entry = LINE_PATHS[id];
    const vbH = entry.vbH;
    const OVERHANG = 60; // раздел 3 брифа `05-line`, Г-2 — то же число, что и в реестре.
    const span = vbH + 2 * OVERHANG;
    // Плотная дуга — независимый пересчёт по arc-length (не переиспользует
    // `revealKeyframes`), чтобы тест не подтверждал сам себя той же формулой.
    const dense = resampleByLength(flattenPath(entry.wide), 401);
    for (const stop of entry.reveal) {
      const idx = Math.round((stop.percent / 100) * (dense.length - 1));
      const y = dense[idx].y;
      const expectedTranslate = ((y + OVERHANG) / span) * 100;
      expect(
        Math.abs(stop.translate - expectedTranslate),
        `${id} @ ${stop.percent}%: шторка=${stop.translate}, дуга=${expectedTranslate.toFixed(2)}`,
      ).toBeLessThan(0.2);
    }
  });

  it('прямые пути (без событий) сводятся к двум стопам — упрощение не плодит лишний CSS', () => {
    const straightIds = ['hero', 'pain', 'pricing', 'cases', 'guarantees', 'about', 'faq', 'footer'];
    for (const id of straightIds) {
      expect(LINE_PATHS[id].reveal.length, `${id}: ожидалось 2 стопа (прямая)`).toBe(2);
    }
  });

  it('траверсы (S-кривая) дают больше двух стопов — кривизна не сглаживается до прямой', () => {
    for (const id of ['services', 'process', 'contact']) {
      expect(LINE_PATHS[id].reveal.length, `${id}: ожидалась не-прямая раскладка`).toBeGreaterThan(2);
    }
  });

  it('overhangPercent совпадает с OVERHANG/vbH — тот же вынос, что несёт сам путь', () => {
    const OVERHANG = 60;
    for (const [id, entry] of Object.entries(LINE_PATHS)) {
      const expected = (OVERHANG / entry.vbH) * 100;
      expect(entry.overhangPercent, id).toBeCloseTo(expected, 1);
    }
  });
});
