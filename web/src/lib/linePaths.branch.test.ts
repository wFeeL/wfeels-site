import { describe, expect, it } from 'vitest';
import { LINE_PATHS } from './linePaths';
import { flattenPath, parsePath, resampleByLength } from './pathGeometry';

/** Сторож ветвей линии — `70-workshop/specs/site-v3/11-line-narrator-brief.md`,
 *  раздел 12.5 (реестр) и раздел 12.7 (список замены). На главной прежде
 *  было ДВЕ фигуры-ветви: у `process` — пять коротких отводов к цифрам
 *  01…05, у `cases` — один отвод к стрелке иллюстрации «Замера».
 *
 *  ПРАВКА `2026-08-27` (`70-workshop/specs/site-v3/16-line-digits-and-
 *  finale-brief.md`, раздел 1.3/раздел 4.1, П-Ц5/П-Ц10): пять отводов
 *  `process` СНЯТЫ решением владельца — цифра зажигается сама
 *  (`Process.astro`), второй геометрии на неё больше не заводится. Блок
 *  проверок ветви `process` удалён вместе с предметом, а не помечен
 *  `skip`. Остаётся ровно одна ветвь на главной — `cases`, проверяется
 *  ниже.
 *
 *  Разбор идёт по РАЗОБРАННЫМ СЕГМЕНТАМ `d` (`parsePath`), не по плотной
 *  выборке точек вдоль кривой, — тот же приём, что и в прежней версии
 *  (см. её объяснение в истории git): плотная выборка ловит артефакты формы
 *  на хвостах кубик, разбор по сегментам проверяет ровно то, что реально
 *  нарисовано. */

describe('реестр линии — ветвь process снята целиком (раздел 1.3 брифа `16-…`)', () => {
  it('запись process не несёт поле branch', () => {
    expect(LINE_PATHS.process.branch, 'LINE_PATHS.process.branch обязан отсутствовать — пять отводов к цифрам сняты').toBeUndefined();
  });
});

describe('реестр линии — ветвь cases: один отвод к стрелке иллюстрации «Замера» (раздел 12.5/12.6/12.7 брифа)', () => {
  const BRANCH = LINE_PATHS.cases.branch!;
  const SEGMENTS = parsePath(BRANCH);

  it('запись cases несёт поле branch', () => {
    expect(LINE_PATHS.cases.branch, 'LINE_PATHS.cases.branch не задан').toBeTruthy();
  });

  it('три сегмента: M C L — рождение, поворот к оси стрелки, спуск вдоль неё', () => {
    expect(SEGMENTS.map((s) => s.type)).toEqual(['M', 'C', 'L']);
  });

  it('рождение отвода лежит НА основной линии cases (в пределах 17 vb — полуширины штриха)', () => {
    const birth = SEGMENTS[0];
    if (birth.type !== 'M') throw new Error('первый сегмент не M');
    // «Самая высокая точка каждого отвода лежит НА основной линии — иначе
    // шторка обнажит висящий в воздухе кусок» (12.7). Проверка ищет x
    // основной кривой `cases.wide` на том же vbY, что и рождение отвода,
    // тем же приёмом, каким сторож ищет точку на кривой (передискретизация
    // по длине дуги, затем ближайшая по y).
    const dense = resampleByLength(flattenPath(LINE_PATHS.cases.wide), 2000);
    let nearest = dense[0];
    for (const p of dense) {
      if (Math.abs(p.y - birth.to.y) < Math.abs(nearest.y - birth.to.y)) nearest = p;
    }
    const dx = Math.abs(nearest.x - birth.to.x);
    expect(dx, `рождение отвода на x=${birth.to.x}, основная линия на том же vbY даёт x=${nearest.x.toFixed(1)} (Δ=${dx.toFixed(1)})`).toBeLessThanOrEqual(
      17,
    );
  });

  it('рождение — самая высокая (наименьший vbY) точка отвода', () => {
    const ys = SEGMENTS.map((s) => s.to.y);
    expect(Math.min(...ys), 'первая точка (M) обязана быть минимумом по vbY').toBe(ys[0]);
  });

  it('отвод приходит на ось стрелки x=693 (компромисс двух ширин, раздел 12.5 «Про две ширины»)', () => {
    const last = SEGMENTS[SEGMENTS.length - 1];
    expect(last.to.x, `конец отвода на x=${last.to.x}, обязан быть x=693`).toBe(693);
  });

  it('поворот к оси стрелки (C) встаёт на x=693 не позже конца пути (L)', () => {
    const curve = SEGMENTS[1];
    const straight = SEGMENTS[2];
    if (curve.type !== 'C' || straight.type !== 'L') throw new Error('порядок сегментов разошёлся');
    expect(curve.to.x, 'кривая обязана прийти ровно на ось x=693').toBe(693);
    expect(straight.to.y, 'прямой участок вдоль оси обязан идти вниз').toBeGreaterThan(curve.to.y);
  });
});
