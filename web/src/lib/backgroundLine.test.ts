import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  computeActGroups,
  computeLineData,
  computeVbH,
  footerLineData,
  isActStitch,
  lineDataFor,
  MEASURED_FOOTER_HEIGHT,
  MEASURED_SECTION_HEIGHT,
  turnOwners,
} from './backgroundLine';
import { HOME_SECTIONS } from './sections';

/** Приёмка `02-background-line.md`, раздел 9, пункт 10: «Число и позиции
 *  переходов совпадают с тем, что даёт правило Ч-4, пересчитанное тестом
 *  заново из lib/sections.ts и замеренных высот секций». Тест ниже
 *  импортирует ТУ ЖЕ таблицу высот, что и сама сборка (`MEASURED_SECTION_HEIGHT`
 *  из `backgroundLine.ts`) — второй копии чисел не заводится, а проверяется
 *  сам АЛГОРИТМ (правило Ч-4), а не переписанный вручную список. */
describe('линия на фоне — Ч-4 «Акт» (раздел 4.2)', () => {
  it('данные посчитаны для всех десяти секций главной', () => {
    const data = computeLineData();
    expect(Object.keys(data).sort()).toEqual(HOME_SECTIONS.map((s) => s.id).sort());
  });

  it('начало — левая сторона, без перехода ([[00-overview]], раздел 3.6)', () => {
    const data = computeLineData();
    expect(data.hero.side).toBe('left');
    expect(data.hero.turn).toBe('none');
  });

  it('финал — правая сторона (раздел 4.2: старт слева, финал справа)', () => {
    const data = computeLineData();
    expect(data.contact.side).toBe('right');
  });

  it('ровно три перехода на действующем составе: pain→services, cases→process, faq→contact', () => {
    const owners = turnOwners();
    expect(owners).toEqual(['services', 'process', 'contact']);
  });

  it('направления переходов чередуются: lr, rl, lr', () => {
    const data = computeLineData();
    expect(data.services.turn).toBe('lr');
    expect(data.process.turn).toBe('rl');
    expect(data.contact.turn).toBe('lr');
  });

  it('акт 1 (pain, ≈650 px < 900) поглощён входом — переход hero→pain отсутствует', () => {
    const data = computeLineData();
    expect(data.pain.turn).toBe('none');
    expect(data.pain.side).toBe(data.hero.side);
  });

  it('сторона не меняется внутри одной группы (услуги/цены/кейсы — одна сторона)', () => {
    const data = computeLineData();
    const group = ['services', 'pricing', 'cases'].map((id) => data[id].side);
    expect(new Set(group).size).toBe(1);
  });

  it('turnOwners пуст и переходов ноль, если ни одна группа не короче минимального прогона', () => {
    // Синтетический состав из четырёх РАВНОВЕСОМЫХ актов — правило Ч-4 не
    // сливает ни одной группы, значит переход стоит на КАЖДОЙ границе акта.
    const heights = Object.fromEntries(HOME_SECTIONS.map((s) => [s.id, 1000]));
    const owners = turnOwners(HOME_SECTIONS, heights, 1000);
    // Границы актов на действующем составе: pain(1), services(2), process(3), contact(out) —
    // первая секция каждой не-первой группы владеет переходом.
    expect(owners).toEqual(['pain', 'services', 'process', 'contact']);
  });

  it('короткий подвал возвращает акт «выход» под порог и сливает faq→contact', () => {
    // Если contact САМ по себе короче порога и подвал не добирает высоту —
    // третий переход (faq→contact) обязан исчезнуть, акт «выход» сливается
    // с актом 3. Проверяет, что подвал ДЕЙСТВИТЕЛЬНО участвует в решении,
    // а не игнорируется алгоритмом.
    const heights = { ...MEASURED_SECTION_HEIGHT, contact: 200 };
    const owners = turnOwners(HOME_SECTIONS, heights, 50);
    expect(owners).toEqual(['services', 'process']);
  });

  it('lineDataFor возвращает null для якоря вне HOME_SECTIONS', () => {
    expect(lineDataFor('not-a-real-section')).toBeNull();
    expect(lineDataFor(undefined)).toBeNull();
  });

  it('lineDataFor совпадает с computeLineData для реального якоря', () => {
    expect(lineDataFor('services')).toEqual(computeLineData().services);
  });

  it('footerLineData несёт ту же сторону (тот же док), что и contact, но свой vbH', () => {
    // Раздел 4.1 брифа `05-line`: `vbH` посчитан из ИЗМЕРЕННОЙ высоты
    // своего бокса, а подвал (469 px) ниже `contact` (966 px) — буквально
    // тот же `runD`, что у `contact`, был бы посчитан под чужой vbH и не
    // достал бы до низа бокса подвала (или вышел бы за него). Совпадать
    // обязаны сторона (док) и МАСШТАБ (`stroke-width` в единицах viewBox
    // остаётся тем же 34 у обоих — раздел 7.2), не буквальная строка `d`.
    const data = computeLineData();
    const footer = footerLineData();
    expect(footer.side).toBe(data.contact.side);
    expect(footer.runVbH).toBe(computeVbH(MEASURED_FOOTER_HEIGHT));
    expect(footer.runVbH).not.toBe(data.contact.runVbH);
    expect(footer.runD).not.toBe(data.contact.runD);
  });

  it('измеренные высоты — положительные числа для всех десяти секций и подвала', () => {
    for (const s of HOME_SECTIONS) {
      expect(MEASURED_SECTION_HEIGHT[s.id], `нет измеренной высоты для ${s.id}`).toBeGreaterThan(0);
    }
    expect(MEASURED_FOOTER_HEIGHT).toBeGreaterThan(0);
  });
});

/** `topGap: 'stitch'` (`pages/index.astro`) — раздел 4.2: «GAPS выводит
 *  topGap:'stitch' из смены act». */
describe('линия на фоне — isActStitch (раздел 4.2)', () => {
  it('services и process — стык актов (1→2, 2→3)', () => {
    expect(isActStitch('services')).toBe(true);
    expect(isActStitch('process')).toBe(true);
  });

  it('pricing, cases, guarantees, about, faq — внутри акта, не стык', () => {
    for (const id of ['pricing', 'cases', 'guarantees', 'about', 'faq']) {
      expect(isActStitch(id), id).toBe(false);
    }
  });

  it('hero (первая секция) и pain («вход» → 1) — не стык между пронумерованными актами', () => {
    expect(isActStitch('hero')).toBe(false);
    expect(isActStitch('pain')).toBe(false);
  });

  it('contact (3 → «выход») не считается стыком — этот заход её topGap не трогает', () => {
    expect(isActStitch('contact')).toBe(false);
  });
});

/** Раздел 3.5 «Разбиение страницы на боксы»: группа Ч-4 сама по себе не
 *  должна терять и не должна дублировать секции. */
describe('линия на фоне — computeActGroups мостит секции без потерь', () => {
  it('каждая секция входит ровно в одну группу', () => {
    const groups = computeActGroups();
    const all = groups.flatMap((g) => g.ids);
    expect(all.sort()).toEqual(HOME_SECTIONS.map((s) => s.id).sort());
  });

  it('высота каждой ГРУППЫ, кроме первой, не короче минимального прогона (900 px)', () => {
    const groups = computeActGroups();
    groups.slice(1).forEach((g) => {
      expect(g.height, `группа ${g.ids.join(',')}`).toBeGreaterThanOrEqual(900);
    });
  });
});

/* Сторож ловушки 1 раздела 3.2-бис: `preserveAspectRatio="none"` — не
 * украшение, а условие того, что переход вообще соединяет две вертикали
 * (иначе кривая вписывается `xMidYMid meet` и повисает в воздухе). Тест
 * читает СОБРАННЫЙ `dist/index.html`, а не литерал в TS, — этот файл
 * больше не хранит строки `<svg>` буквально (раздел 7.2: geometry пишется в
 * разметке компонента, не в TS-константе), поэтому сверять здесь можно
 * только сам компонент. Сборка обязана предшествовать этому прогону
 * (см. `sections.test.ts`, тот же приём). */
describe('линия на фоне — preserveAspectRatio на каждом SVG (раздел 3.2-бис, ловушка 1)', () => {
  /** Ищет теги `<svg …>` только в РАЗМЕТКЕ компонента — после закрывающего
   *  `---` фронтматтера, а не во всём файле: комментарии фронтматтера
   *  упоминают `` `<svg>` `` как текст, и наивный поиск по всему файлу ловит
   *  это слово, а не настоящий тег. */
  function markupSvgTags(src: string): string[] {
    const closes = [...src.matchAll(/^---\s*$/gm)];
    const markupStart = closes.length >= 2 ? closes[1].index! + closes[1][0].length : 0;
    const markup = src.slice(markupStart);
    return [...markup.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0]);
  }

  it('Section.astro пишет preserveAspectRatio="none" на обоих <svg>', () => {
    const url = new URL('../components/Section.astro', import.meta.url);
    const svgTags = markupSvgTags(readFileSync(url, 'utf8'));
    expect(svgTags.length, 'в Section.astro нет ни одного <svg>').toBeGreaterThan(0);
    for (const tag of svgTags) {
      expect(tag, tag).toContain('preserveAspectRatio="none"');
    }
  });

  it('Footer.astro пишет preserveAspectRatio="none" на хвосте', () => {
    const url = new URL('../components/Footer.astro', import.meta.url);
    const svgTags = markupSvgTags(readFileSync(url, 'utf8'));
    expect(svgTags.length).toBeGreaterThan(0);
    for (const tag of svgTags) {
      expect(tag, tag).toContain('preserveAspectRatio="none"');
    }
  });
});

/* Сторож концов пути вне viewBox (раздел 3.6 брифа `02-background-line`,
 * приёмка п. 4; раздел 10 шаг 2 / Г-2 брифа `05-line`): круглый торец не
 * должен быть виден ни на одном стыке — оба конца каждого `d` обязаны
 * лежать за пределами СОБСТВЕННОГО `viewBox` (`0…vbH`, не фиксированного
 * `0…1000`/`0…100` — раздел 4.1 брифа `05-line` дал каждому боксу СВОЙ
 * `vbH`, второй фиксированной высоты в системе больше нет). */
describe('линия на фоне — концы путей выходят за viewBox (раздел 3.6)', () => {
  it('прогон: y начинается < 0 и кончается > runVbH (высота viewBox прогона)', () => {
    const data = computeLineData();
    for (const id of Object.keys(data)) {
      const { runD: d, runVbH } = data[id];
      const ys = [...d.matchAll(/-?[\d.]+,(-?[\d.]+)/g)].map((m) => Number(m[1]));
      expect(Math.min(...ys), `${id}: ${d}`).toBeLessThan(0);
      expect(Math.max(...ys), `${id}: ${d}`).toBeGreaterThan(runVbH);
    }
  });

  it('переход: y начинается < 0 и кончается > turnVbH (высота viewBox перехода)', () => {
    const data = computeLineData();
    for (const id of turnOwners()) {
      const { turnD: d, turnVbH } = data[id];
      expect(d, id).not.toBeNull();
      expect(turnVbH, id).not.toBeNull();
      const ys = [...d!.matchAll(/-?[\d.]+,(-?[\d.]+)/g)].map((m) => Number(m[1]));
      expect(Math.min(...ys), `${id}: ${d}`).toBeLessThan(0);
      expect(Math.max(...ys), `${id}: ${d}`).toBeGreaterThan(turnVbH!);
    }
  });
});

/* Сторож доков (раздел 4.2 брифа `05-line`): прогон стоит РОВНО на своём
 * доке (x=59 слева, x=941 справа) на всех точках пути, переход идёт
 * строго от одного дока к другому. Ловит, если кто-то в будущем случайно
 * подвинет `x` при рефакторинге `runD`/`turnD`. */
describe('линия на фоне — доки (раздел 4.2)', () => {
  it('прогон: обе точки на x=59 (левый) или x=941 (правый) по стороне', () => {
    const data = computeLineData();
    for (const id of Object.keys(data)) {
      const { runD: d, side } = data[id];
      const expectedX = side === 'left' ? 59 : 941;
      const xs = [...d.matchAll(/(-?[\d.]+),-?[\d.]+/g)].map((m) => Number(m[1]));
      for (const x of xs) expect(x, `${id}: ${d}`).toBe(expectedX);
    }
  });

  it('переход: первая и последняя точка на доках 59/941 (по направлению)', () => {
    const data = computeLineData();
    for (const id of turnOwners()) {
      const { turnD: d, turn } = data[id];
      const xs = [...d!.matchAll(/(-?[\d.]+),-?[\d.]+/g)].map((m) => Number(m[1]));
      const [startX, endX] = [xs[0], xs[xs.length - 1]];
      if (turn === 'lr') {
        expect(startX, id).toBe(59);
        expect(endX, id).toBe(941);
      } else {
        expect(startX, id).toBe(941);
        expect(endX, id).toBe(59);
      }
    }
  });
});
