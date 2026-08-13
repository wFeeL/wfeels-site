import { describe, it, expect } from 'vitest';
import { computeLineData, lineDataFor } from './backgroundLine';
import { railPoints } from './rail';
import { HOME_SECTIONS } from './sections';

/** Приёмка брифа `02-background-line.md`, раздел 9, пункт 10: «Число
 *  переходов на странице равно числу точек рельса минус один, и позиции
 *  переходов совпадают с границами точек рельса». Проверяется по данным,
 *  не по картинке — граница здесь означает «cross» на последней секции
 *  группы N и «crossTop» с тем же направлением на первой секции группы N+1. */
describe('линия на фоне — геометрия переходов (схема Ч-3)', () => {
  const data = computeLineData();
  const points = railPoints();

  it('данные посчитаны для всех десяти секций главной', () => {
    expect(Object.keys(data).sort()).toEqual(HOME_SECTIONS.map((s) => s.id).sort());
  });

  it('начало — левая сторона (раздел 3.5)', () => {
    expect(data[HOME_SECTIONS[0].id].side).toBe('left');
    expect(data[HOME_SECTIONS[0].id].crossTop).toBe('none');
  });

  it('число переходов = число точек рельса − 1', () => {
    const crossings = HOME_SECTIONS.filter((s) => data[s.id].cross !== 'none');
    expect(crossings.length).toBe(points.length - 1);
  });

  it('переход стоит РОВНО на границе точки рельса, ни на одной внутренней секции', () => {
    for (const point of points) {
      point.sectionIds.forEach((id, i) => {
        if (i < point.sectionIds.length - 1) {
          // внутри одной точки рельса переходов нет
          expect(data[id].cross, `${id} внутри группы «${point.label}» не должна нести переход`).toBe('none');
        }
      });
    }
  });

  it('каждая граница точки рельса, кроме последней, несёт ровно один переход', () => {
    points.forEach((point, i) => {
      const lastId = point.sectionIds[point.sectionIds.length - 1];
      const cross = data[lastId].cross;
      if (i === points.length - 1) {
        expect(cross, 'у последней точки рельса стока продолжается без переворота').toBe('none');
      } else {
        expect(cross).not.toBe('none');
      }
    });
  });

  it('crossTop следующей группы равен cross предыдущей — общий источник, без второго списка', () => {
    points.forEach((point, i) => {
      if (i === 0) return;
      const prevLastId = points[i - 1].sectionIds[points[i - 1].sectionIds.length - 1];
      const firstId = point.sectionIds[0];
      expect(data[firstId].crossTop).toBe(data[prevLastId].cross);
    });
  });

  it('финал — правая сторона (раздел 4: «стороны чередуются: старт слева, финал справа»)', () => {
    const lastId = HOME_SECTIONS[HOME_SECTIONS.length - 1].id;
    expect(data[lastId].side).toBe('right');
  });

  it('сторона не меняется внутри одной точки рельса', () => {
    for (const point of points) {
      const sides = new Set(point.sectionIds.map((id) => data[id].side));
      expect(sides.size, `точка «${point.label}» держит две стороны сразу`).toBe(1);
    }
  });

  it('lineDataFor возвращает null для якоря вне HOME_SECTIONS', () => {
    expect(lineDataFor('not-a-real-section')).toBeNull();
    expect(lineDataFor(undefined)).toBeNull();
  });

  it('lineDataFor совпадает с computeLineData для реального якоря', () => {
    expect(lineDataFor('services')).toEqual(data.services);
  });
});
