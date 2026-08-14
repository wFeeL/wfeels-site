import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { computeLineData, lineDataFor, LR_TILE, RL_TILE, tileUrl } from './backgroundLine';
import { railPoints } from './rail';
import { HOME_SECTIONS } from './sections';

/** `BackgroundLine.astro` вписывает `mask-image` плиток перехода буквально
 *  (не через `define:vars` — см. комментарий в компоненте, почему). Раз
 *  строка не вычисляется на сборке, а переписана руками, её надо сверять
 *  с тем, что производит сам код СЕЙЧАС — иначе правка кривой (раздел 3.2)
 *  разойдётся с CSS молча, штрих перехода останется старой формы. */
describe('линия на фоне — плитка перехода в CSS совпадает с tileUrl()', () => {
  const component = readFileSync(
    new URL('../components/BackgroundLine.astro', import.meta.url),
    'utf8',
  );

  it('LR_TILE вписан в компонент буквально', () => {
    expect(component).toContain(tileUrl(LR_TILE));
  });

  it('RL_TILE вписан в компонент буквально', () => {
    expect(component).toContain(tileUrl(RL_TILE));
  });
});

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

/* Сторож стыка перехода с вертикалями (правка 2026-08-14).
 *
 * Владелец увидел на экране то, чего не видел ни один тест: переход висел в
 * воздухе — не доходил до левой вертикали 280 px и обрывался за 280 px до
 * правой. Причина не в геометрии полосы (она честно занимала всю ширину, это
 * было измерено), а в том, что SVG-маска со своим `viewBox` без
 * `preserveAspectRatio='none'` вписывается по умолчанию как `xMidYMid meet`:
 * сохраняет пропорцию 1000:192 и центрируется. На полосе 1230×128 это давало
 * кривую шириной 128 · (1000/192) ≈ 667 px по центру.
 *
 * Весь набор проверок линии при этом оставался зелёным: он сверял наличие
 * элементов, стороны, число переходов и отсутствие горизонтальной прокрутки —
 * но ни одна не спрашивала, СОЕДИНЯЕТ ли переход то, что должен соединять.
 * Этот тест закрывает ровно ту дыру, и стоит он здесь, а не в e2e, потому что
 * причина живёт в строке-литерале, а не в раскладке. */
describe('маска перехода растягивается по коробке, а не вписывается в неё', () => {
  for (const [name, tile] of [['LR_TILE', LR_TILE], ['RL_TILE', RL_TILE]] as const) {
    it(`${name} несёт preserveAspectRatio='none'`, () => {
      expect(
        tile,
        `${name} без preserveAspectRatio='none' вписывается с сохранением пропорций ` +
        'и центрируется: переход перестаёт доставать до вертикалей и повисает в воздухе',
      ).toContain("preserveAspectRatio='none'");
    });

    it(`${name} остаётся одним путём с вертикальными касательными на концах`, () => {
      // Концы кривой обязаны выходить вертикально: переход продолжает
      // вертикальный прогон, а не втыкается в него под углом.
      expect(tile).toMatch(/d='M(0|1000),0 C(0|1000),96 (0|1000),96 (0|1000),192'/);
    });
  }
});
