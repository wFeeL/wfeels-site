import { describe, expect, it } from 'vitest';
import { LINE_PATHS } from './linePaths';
import { parsePath } from './pathGeometry';

/** Сторож ветви линии — `70-workshop/specs/site-v3/11-line-narrator-brief.md`,
 *  раздел 3 П4, приёмка П-8/П-9 (геометрическая часть, без браузера —
 *  контраст и наличие в DOM проверяются отдельно, `lineBranch.contrast.
 *  test.ts` и `background-line-registry-sync.spec.ts` соответственно).
 *
 *  Проверка идёт по РАЗОБРАННЫМ СЕГМЕНТАМ `d` (`parsePath`), а не по
 *  плотной выборке точек вдоль кривой (`flattenPath`): плотная выборка
 *  ловит артефакт формы — на хвосте кубики `y` уже вошёл в проверяемую
 *  полосу, а `x` ещё не сошёлся к оси (кривая не несёт вертикальной
 *  касательной на конце, в отличие от симметричного траверса
 *  `traversePath`), и то же самое верно для «разрыва»: `flattenPath`
 *  сэмплирует прямые `L`-отрезки ОДНОЙ конечной точкой (без промежуточных
 *  точек), поэтому фильтр по диапазону `y` не видит середину прямого
 *  прогона вовсе. Разбор по сегментам проверяет ровно то, что реально
 *  нарисовано — управляющие и конечные точки команд `M`/`L`/`C`, — без
 *  этих двух артефактов. */

const BRANCH = LINE_PATHS.process.branch!;
const SEGMENTS = parsePath(BRANCH);

describe('реестр линии — ветвь process (раздел 3 П4 брифа `11-line-narrator-brief.md`)', () => {
  it('запись process несёт поле branch', () => {
    expect(LINE_PATHS.process.branch, 'LINE_PATHS.process.branch не задан').toBeTruthy();
  });

  it('шесть сегментов: M C L M L C — два подпути с разрывом между ними', () => {
    expect(SEGMENTS.map((s) => s.type)).toEqual(['M', 'C', 'L', 'M', 'L', 'C']);
  });

  it('начало спины (первый M) лежит в полосе vbY 100…160 (правый док, до начала кубики траверса)', () => {
    const start = SEGMENTS[0];
    if (start.type !== 'M') throw new Error('первый сегмент не M');
    expect(start.to.y, `начало спины на vbY=${start.to.y} вне полосы 100…160`).toBeGreaterThanOrEqual(100);
    expect(start.to.y, `начало спины на vbY=${start.to.y} вне полосы 100…160`).toBeLessThanOrEqual(160);
  });

  it('первая кривая встаёт на ось x=88 не ниже vbY=260 (выше цифры 01, vbY=290)', () => {
    const curve = SEGMENTS[1];
    if (curve.type !== 'C') throw new Error('второй сегмент не C');
    expect(curve.to.x, 'первая кривая обязана прийти ровно на ось x=88').toBe(88);
    expect(curve.to.y, `кривая встаёт на ось при vbY=${curve.to.y}, позже требуемых 260`).toBeLessThanOrEqual(260);
    expect(curve.to.y, 'кривая встаёт на ось выше цифры 01 (vbY=290)').toBeLessThan(290);
  });

  it('прямой участок под цифрами идёт по оси x=88 (первый L)', () => {
    const straight = SEGMENTS[2];
    if (straight.type !== 'L') throw new Error('третий сегмент не L');
    expect(straight.to.x, 'прямой участок спины обязан идти по x=88').toBe(88);
  });

  it('разрыв: прямой участок обрывается до vbY=800, второй подпуть (M) начинается после vbY=900', () => {
    const endOfFirstRun = SEGMENTS[2];
    const secondM = SEGMENTS[3];
    if (endOfFirstRun.type !== 'L' || secondM.type !== 'M') throw new Error('порядок сегментов разошёлся');
    expect(endOfFirstRun.to.y, `первый подпуть обрывается на vbY=${endOfFirstRun.to.y}, обязан быть < 800`).toBeLessThan(800);
    expect(secondM.to.y, `второй подпуть начинается на vbY=${secondM.to.y}, обязан быть > 900`).toBeGreaterThan(900);
    // Разрыв стоит по той же оси x=88 с обеих сторон — не боковой скачок.
    expect(endOfFirstRun.to.x).toBe(88);
    expect(secondM.to.x).toBe(88);
  });

  it('после разрыва спина возвращается на ось x=88, затем прямая идёт вниз', () => {
    const straightAfterGap = SEGMENTS[4];
    if (straightAfterGap.type !== 'L') throw new Error('пятый сегмент не L');
    expect(straightAfterGap.to.x).toBe(88);
    expect(straightAfterGap.to.y, 'прямой участок после разрыва обязан идти вниз').toBeGreaterThan(900);
  });

  it('конец спины уходит за viewBox на x=1000 не выше vbY=1075 («в конце уходя вправо снизу»)', () => {
    const finalCurve = SEGMENTS[5];
    if (finalCurve.type !== 'C') throw new Error('шестой сегмент не C');
    expect(finalCurve.to.x, `конец спины на x=${finalCurve.to.x}, обязан покидать viewBox на x=1000`).toBe(1000);
    expect(finalCurve.to.y, `конец спины на vbY=${finalCurve.to.y}, обязан быть не выше 1075`).toBeGreaterThanOrEqual(1075);
  });
});
