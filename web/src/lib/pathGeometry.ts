/** Численная геометрия SVG-путей `M`/`L`/`C` — общий инструмент контракт-
 *  теста реестра линии (`lib/linePaths.contract.test.ts`, бриф `70-workshop/
 *  specs/site-v3/05-line.md`, раздел 10 шаг 3 / раздел 11 «Геометрия»).
 *
 *  Пути линии несут только `M`, `L`, `C` (см. `backgroundLine.ts`:
 *  `runD` — `M…L…`, `turnD` — `M…C…`) — второй грамматики не заводится:
 *  парсер ниже сознательно не понимает ни дуг (`A`), ни квадратичных кривых
 *  (`Q`), ни относительных команд (`m`/`l`/`c`).
 *
 *  Тест не читает `getPointAtLength` браузера (контракт-тест — модульный,
 *  без DOM, раздел 10 шаг 3 отделён от e2e-сторожа шага 3в): кривая
 *  спрямляется вручную (`flattenPath`) с мелким шагом на каждой кубике,
 *  затем передискретизируется в 200 точек, равномерных по ДЛИНЕ пути
 *  («контракт-тест численно считает по 200 точкам», раздел 10 брифа) —
 *  не по параметру `t`, чтобы точки не сгущались на медленных участках
 *  кривой и не редели на быстрых.
 */

export interface Point {
  x: number;
  y: number;
}

type Segment =
  | { type: 'M'; to: Point }
  | { type: 'L'; to: Point }
  | { type: 'C'; c1: Point; c2: Point; to: Point };

/** Разбирает `d` вида `"M59,-60 L59,815"` или `"M59,-43.2 C59,54 941,54
 *  941,151.2 L941,1363"` — команда, затем один или несколько `x,y` без
 *  пробела вокруг запятой (как пишут `runD`/`turnD`/`widePathFor`). */
export function parsePath(d: string): Segment[] {
  const matches = [...d.trim().matchAll(/([MLC])((?:\s*-?[\d.]+,-?[\d.]+)+)/g)];
  const segments: Segment[] = [];
  for (const m of matches) {
    const cmd = m[1] as 'M' | 'L' | 'C';
    const pts = m[2]
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [x, y] = pair.split(',').map(Number);
        return { x, y };
      });
    if (cmd === 'M') segments.push({ type: 'M', to: pts[0] });
    else if (cmd === 'L') segments.push({ type: 'L', to: pts[0] });
    else segments.push({ type: 'C', c1: pts[0], c2: pts[1], to: pts[2] });
  }
  return segments;
}

function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const e = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + e * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + e * p3.y,
  };
}

/** Спрямляет путь в плотную ломаную: прямые сегменты — двумя концами,
 *  кубики — `samplesPerCurve` подвыборками. Первая точка каждого сегмента —
 *  это последняя точка предыдущего, второй раз не добавляется. */
export function flattenPath(d: string, samplesPerCurve = 400): Point[] {
  const segments = parsePath(d);
  const points: Point[] = [];
  let cur: Point = { x: 0, y: 0 };
  for (const seg of segments) {
    if (seg.type === 'M') {
      cur = seg.to;
      points.push(cur);
    } else if (seg.type === 'L') {
      cur = seg.to;
      points.push(cur);
    } else {
      const p0 = cur;
      for (let i = 1; i <= samplesPerCurve; i++) {
        points.push(cubicPoint(p0, seg.c1, seg.c2, seg.to, i / samplesPerCurve));
      }
      cur = seg.to;
    }
  }
  return points;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Длина ломаной — сумма отрезков между соседними точками. */
export function polylineLength(points: readonly Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i]);
  return len;
}

/** Передискретизирует плотную ломаную в `n` точек, равномерных по длине
 *  пути (не по индексу исходного массива). */
export function resampleByLength(points: readonly Point[], n: number): Point[] {
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
  const total = cum[cum.length - 1];
  const out: Point[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / (n - 1)) * total;
    while (j < cum.length - 2 && cum[j + 1] < target) j++;
    const segLen = cum[j + 1] - cum[j] || 1;
    const t = (target - cum[j]) / segLen;
    const a = points[j];
    const b = points[j + 1] ?? points[j];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

/** Радиус описанной окружности треугольника трёх точек — дискретная оценка
 *  радиуса кривизны в средней точке (формула Менгера: `R = abc / 4·S`).
 *  Вырожденный (почти коллинеарный) треугольник даёт `Infinity` — то есть
 *  «прямая», а не ошибка деления на ноль. */
function circumRadius(a: Point, b: Point, c: Point): number {
  const ab = dist(a, b);
  const bc = dist(b, c);
  const ca = dist(c, a);
  const s = (ab + bc + ca) / 2;
  const area = Math.sqrt(Math.max(s * (s - ab) * (s - bc) * (s - ca), 0));
  if (area < 1e-9) return Infinity;
  return (ab * bc * ca) / (4 * area);
}

/** Минимальный радиус кривизны по 200 (или сколько передали) точкам,
 *  равномерным по длине пути — Г-1 (раздел 3 брифа `05-line`). Прямая
 *  секция (все точки коллинеарны) даёт `Infinity`, что корректно проходит
 *  `R_min ≥ 8·w` при любом `w`. */
export function minRadius(sampledPoints: readonly Point[]): number {
  let min = Infinity;
  for (let i = 1; i < sampledPoints.length - 1; i++) {
    const r = circumRadius(sampledPoints[i - 1], sampledPoints[i], sampledPoints[i + 1]);
    if (r < min) min = r;
  }
  return min;
}

/** Боковой ход — максимальное отклонение `x` от `x` первой точки, в
 *  процентах ширины холста `viewBox` (canvasWidth = 1000) — Г-4. */
export function lateralPercent(points: readonly Point[], canvasWidth = 1000): number {
  const x0 = points[0].x;
  let maxDev = 0;
  for (const p of points) maxDev = Math.max(maxDev, Math.abs(p.x - x0));
  return (maxDev / canvasWidth) * 100;
}

/** Длина вертикального прямого участка от начала пути (`fromStart: true`)
 *  или от конца (`false`) — сколько пути проходит при неизменном `x`
 *  (допуск 0.01 единицы) прежде чем `x` трогается. Численная форма Г-2:
 *  «каждый путь начинается и кончается вертикальным прямым отрезком
 *  длиной ≥ 96 px». Считается на плотной ломаной (`flattenPath`), не на
 *  200 передискретизированных точках — иначе короткий прямой хвост короче
 *  шага передискретизации потерялся бы между двумя точками. */
export function verticalRunLength(points: readonly Point[], fromStart: boolean): number {
  const seq = fromStart ? points : [...points].reverse();
  const x0 = seq[0].x;
  let len = 0;
  for (let i = 1; i < seq.length; i++) {
    if (Math.abs(seq[i].x - x0) > 0.01) break;
    len += dist(seq[i - 1], seq[i]);
  }
  return len;
}

/** Точки, где путь «оборачивается» по горизонтали — Г-5 (раздел 3 брифа
 *  `05-line`): индекс `i` такой, что знак `x[i]-x[i-1]` не совпадает со
 *  знаком `x[i+1]-x[i]`. Простой траверс (док → док, `x` меняется
 *  монотонно) таких точек не даёт вовсе — «вершина изгиба» есть только там,
 *  где путь реально поворачивает назад (`cases`: «выход внутрь и обратно»),
 *  что и назначает Г-5 предметом проверки: не каждый путь несёт вершину. */
export function lateralTurningPoints(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const dPrev = points[i].x - points[i - 1].x;
    const dNext = points[i + 1].x - points[i].x;
    if (dPrev !== 0 && dNext !== 0 && Math.sign(dPrev) !== Math.sign(dNext)) {
      out.push(points[i]);
    }
  }
  return out;
}

/** Вынос концов пути за пределы `viewBox` (`0…vbH`) — вторая половина Г-2.
 *  Возвращает `{ start, end }`: на сколько единиц первая/последняя точка
 *  пути лежит за пределами `[0, vbH]` (отрицательное — внутри бокса). */
export function overhang(points: readonly Point[], vbH: number): { start: number; end: number } {
  const first = points[0].y;
  const last = points[points.length - 1].y;
  return { start: 0 - first, end: last - vbH };
}
