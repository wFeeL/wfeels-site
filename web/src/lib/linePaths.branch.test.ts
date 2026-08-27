import { describe, expect, it } from 'vitest';
import { LINE_PATHS } from './linePaths';
import { flattenPath, parsePath, resampleByLength } from './pathGeometry';

/** Сторож ветвей линии — `70-workshop/specs/site-v3/11-line-narrator-brief.md`,
 *  раздел 12.5 (реестр) и раздел 12.7 (список замены): «`linePaths.branch.
 *  test.ts` переписывается целиком: все восемь проверок написаны под старую
 *  спину (`M941,120`, ось `x=88`, разрыв 800/900, уход на `x=1000`) и не
 *  описывают ни одну существующую фигуру». Прежняя версия проверяла
 *  ОДНУ длинную «спину шагов» (пять цифр одним путём с разрывом посередине) —
 *  правка раздела 12.1/12.5 заменяет её на ДВЕ разные фигуры: у `process` —
 *  пять КОРОТКИХ независимых отводов (по одному на цифру 01…05), у `cases` —
 *  один отвод к стрелке иллюстрации «Замера». Обе проверяются здесь.
 *
 *  Разбор идёт по РАЗОБРАННЫМ СЕГМЕНТАМ `d` (`parsePath`), не по плотной
 *  выборке точек вдоль кривой, — тот же приём, что и в прежней версии
 *  (см. её объяснение в истории git): плотная выборка ловит артефакты формы
 *  на хвостах кубик, разбор по сегментам проверяет ровно то, что реально
 *  нарисовано. */

describe('реестр линии — ветвь process: пять коротких отводов к цифрам 01…05 (раздел 12.5/12.7 брифа)', () => {
  const BRANCH = LINE_PATHS.process.branch!;
  const SEGMENTS = parsePath(BRANCH);

  it('запись process несёт поле branch', () => {
    expect(LINE_PATHS.process.branch, 'LINE_PATHS.process.branch не задан').toBeTruthy();
  });

  it('десять сегментов: пять независимых подпутей M L, разделённых явным M', () => {
    expect(SEGMENTS.map((s) => s.type)).toEqual(['M', 'L', 'M', 'L', 'M', 'L', 'M', 'L', 'M', 'L']);
  });

  it('ровно пять подпутей', () => {
    const starts = SEGMENTS.filter((s) => s.type === 'M');
    expect(starts).toHaveLength(5);
  });

  const pairs = Array.from({ length: 5 }, (_, i) => [SEGMENTS[i * 2], SEGMENTS[i * 2 + 1]] as const);

  it.each(pairs.map((p, i) => [i + 1, p] as const))('отвод к цифре %02d: рождается на x=59 (ось основной линии process)', (_, [m]) => {
    if (m.type !== 'M') throw new Error('первый сегмент подпути не M');
    // process стоит на левом доке по всей высоте (боковой ход 0, раздел 12.5) —
    // «самая высокая точка каждого отвода лежит на основной линии» (12.7)
    // здесь проверяется буквально: x рождения обязан совпасть с осью дока.
    expect(m.to.x, `отвод рождается на x=${m.to.x}, обязан быть на оси дока x=59`).toBe(59);
  });

  it.each(pairs.map((p, i) => [i + 1, p] as const))('отвод к цифре %02d: приходит на x=112 — 11 vb внутри коробки цифры (x 101…194)', (_, [, l]) => {
    if (l.type !== 'L') throw new Error('второй сегмент подпути не L');
    expect(l.to.x, `отвод приходит на x=${l.to.x}, обязан быть x=112`).toBe(112);
  });

  it.each(pairs.map((p, i) => [i + 1, p] as const))('отвод к цифре %02d: лёгкий наклон вниз — прирост vbY ровно 10 (чтобы отвод прорисовывался, а не появлялся целиком)', (_, [m, l]) => {
    if (m.type !== 'M' || l.type !== 'L') throw new Error('порядок сегментов подпути разошёлся');
    expect(l.to.y - m.to.y, `прирост vbY=${l.to.y - m.to.y}, обязан быть 10`).toBe(10);
  });

  it('рождения пяти отводов идут СТРОГО по возрастанию vbY — по одному на цифру сверху вниз', () => {
    const births = pairs.map(([m]) => {
      if (m.type !== 'M') throw new Error('первый сегмент подпути не M');
      return m.to.y;
    });
    for (let i = 1; i < births.length; i++) {
      expect(births[i], `рождение ${i} (vbY=${births[i]}) обязано быть ниже рождения ${i - 1} (vbY=${births[i - 1]})`).toBeGreaterThan(
        births[i - 1],
      );
    }
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
