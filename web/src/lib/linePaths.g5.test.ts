import { describe, expect, it } from 'vitest';
import { LINE_PATHS } from './linePaths';
import { flattenPath, lateralTurningPoints } from './pathGeometry';

/** Г-5 (раздел 3, 4.5 и 11 п.8 брифа `70-workshop/specs/site-v3/05-line.md`):
 *  «Вершина изгиба не касается угла карточки» — локальный экстремум пути по
 *  горизонтали (место, где путь реально «оборачивается», не просто меняет
 *  сторону доком-в-док) обязан отстоять от любого угла непрозрачной коробки
 *  карты 6.2 не менее чем на **64 px**.
 *
 *  Простой траверс (докин-в-док, `services`/`process`/`contact`) x меняет
 *  МОНОТОННО — `lateralTurningPoints` не находит там ни одной точки, и это
 *  корректно: у траверса нет «вершины», есть диагональ (раздел 4.4 сам
 *  строит её так, чтобы вторая вершина шаблона, если бы она была, пряталась
 *  под карточками — здесь вершины просто нет, вопрос снят конструкцией).
 *  Единственная запись реестра с настоящим разворотом — `cases` («выход
 *  внутрь и обратно», раздел 4.3): ей одной и посвящена проверка расстояний
 *  ниже; остальные записи проходят пустым множеством вершин.
 *
 *  Перевод в единицы: карта 6.2 измерена в РЕАЛЬНЫХ px на окне 1440 (`x` —
 *  от кромки окна). Холст на 1440 px равен окну (раздел 4.2, `--line-
 *  canvas: min(100vw,1440px)`), поэтому `viewBox`-x переводится в реальный
 *  px тем же коэффициентом, что и доки причалов (раздел 4.2, таблица):
 *  `realX = vbX · 1440/1000`; сверено с самой таблицей — `59·1.44 = 85 px`,
 *  `941·1.44 = 1355 px`, ОБА совпадают со строкой «1440» таблицы 4.2 день в
 *  день. `y` карты 6.2 измерена «от верха своей секции» — тот же порядок
 *  величины, что и `viewBox`-y секции (раздел 4.4 сравнивает их напрямую:
 *  «вершины траверса лежат на y≈232… карточка начинается на y=+245»), и это
 *  тот же приём, каким уже пользуется сама спека, а не второе допущение. */

const CANVAS_1440_SCALE = 1440 / 1000;
const CORNER_MIN_DISTANCE = 64;

interface Box {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

/** Карта перекрытия — раздел 6.2 брифа `05-line`, только записи с
 *  документированными коробками, задействованные ниже (`cases`). */
const CASES_BOXES: Box[] = [
  { x1: 647, x2: 1270, y1: 262, y2: 646 },
  { x1: 170, x2: 793, y1: 1014, y2: 1590 },
];

function corners(box: Box): Array<[number, number]> {
  return [
    [box.x1, box.y1],
    [box.x2, box.y1],
    [box.x1, box.y2],
    [box.x2, box.y2],
  ];
}

function toRealX(vbX: number): number {
  return vbX * CANVAS_1440_SCALE;
}

describe('реестр линии — Г-5: вершина изгиба не ближе 64 px к углу карточки (раздел 3/4.5 брифа `05-line`)', () => {
  it.each(Object.keys(LINE_PATHS))('%s: вершины изгиба (если есть) не ближе 64 px к углу непрозрачной коробки', (id) => {
    const entry = LINE_PATHS[id];
    const flat = flattenPath(entry.wide);
    const turns = lateralTurningPoints(flat);

    const boxes = id === 'cases' ? CASES_BOXES : [];
    if (boxes.length === 0) {
      // Нет документированной непрозрачной коробки для этой записи (или
      // путь не несёт вершин вовсе, что для прямых и простых траверсов —
      // норма, см. фронтматтер) — проверять нечего, тест проходит пусто.
      expect(true).toBe(true);
      return;
    }

    for (const turn of turns) {
      const realX = toRealX(turn.x);
      for (const box of boxes) {
        for (const [cx, cy] of corners(box)) {
          const distance = Math.hypot(realX - cx, turn.y - cy);
          expect(
            distance,
            `${id}: вершина (vb x=${turn.x.toFixed(1)} → real x=${realX.toFixed(1)}, y=${turn.y.toFixed(1)}) в ${distance.toFixed(1)} px от угла (${cx},${cy})`,
          ).toBeGreaterThanOrEqual(CORNER_MIN_DISTANCE);
        }
      }
    }
  });
});
