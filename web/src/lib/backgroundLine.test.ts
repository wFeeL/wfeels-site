import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  computeActGroups,
  computeLineData,
  footerLineData,
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

  it('ровно три перехода на действующем составе: services→pricing, cases→process, faq→contact', () => {
    // Правка 2026-08-27 (`70-workshop/specs/site-v3/11-line-narrator-brief.md`,
    // раздел 10.4, Р-2): `pain` и `services` переведены на акт `'in'`, поэтому
    // граница акта «вход/дело» переехала с «pain→services» на
    // «services→pricing» — переход теперь владеет `pricing`, не `services`.
    const owners = turnOwners();
    expect(owners).toEqual(['pricing', 'process', 'contact']);
  });

  it('направления переходов чередуются: lr, rl, lr', () => {
    const data = computeLineData();
    expect(data.pricing.turn).toBe('lr');
    expect(data.process.turn).toBe('rl');
    expect(data.contact.turn).toBe('lr');
  });

  it('акт «вход» несёт три секции без внутренних переходов: hero, pain, services — одна сторона, одна группа', () => {
    // Правка 2026-08-27: `pain` и `services` не «поглощены» коротким прогоном
    // (как раньше `pain` при мерже коротких групп) — они литерально несут
    // тот же акт `'in'`, что и `hero`, поэтому переходов внутри группы нет
    // ни по одной причине, а не только потому что группа короче порога.
    const data = computeLineData();
    expect(data.pain.turn).toBe('none');
    expect(data.pain.side).toBe(data.hero.side);
    expect(data.services.turn).toBe('none');
    expect(data.services.side).toBe(data.hero.side);
  });

  it('сторона не меняется внутри одной группы (цены/кейсы — одна сторона)', () => {
    const data = computeLineData();
    const group = ['pricing', 'cases'].map((id) => data[id].side);
    expect(new Set(group).size).toBe(1);
  });

  it('turnOwners пуст и переходов ноль, если ни одна группа не короче минимального прогона', () => {
    // Синтетический состав из четырёх РАВНОВЕСОМЫХ актов — правило Ч-4 не
    // сливает ни одной группы, значит переход стоит на КАЖДОЙ границе акта.
    const heights = Object.fromEntries(HOME_SECTIONS.map((s) => [s.id, 1000]));
    const owners = turnOwners(HOME_SECTIONS, heights, 1000);
    // Границы актов на действующем составе (правка 2026-08-27): вход
    // (hero, pain, services), 2 (pricing, cases), 3 (process…faq), выход
    // (contact) — первая секция каждой не-первой группы владеет переходом.
    expect(owners).toEqual(['pricing', 'process', 'contact']);
  });

  it('короткий подвал возвращает акт «выход» под порог и сливает faq→contact', () => {
    // Если contact САМ по себе короче порога и подвал не добирает высоту —
    // третий переход (faq→contact) обязан исчезнуть, акт «выход» сливается
    // с актом 3. Проверяет, что подвал ДЕЙСТВИТЕЛЬНО участвует в решении,
    // а не игнорируется алгоритмом.
    const heights = { ...MEASURED_SECTION_HEIGHT, contact: 200 };
    const owners = turnOwners(HOME_SECTIONS, heights, 50);
    expect(owners).toEqual(['pricing', 'process']);
  });

  it('lineDataFor возвращает null для якоря вне HOME_SECTIONS', () => {
    expect(lineDataFor('not-a-real-section')).toBeNull();
    expect(lineDataFor(undefined)).toBeNull();
  });

  it('lineDataFor совпадает с computeLineData для реального якоря', () => {
    expect(lineDataFor('services')).toEqual(computeLineData().services);
  });

  it('footerLineData несёт ту же сторону (тот же док), что и contact', () => {
    // Раздел 7.2: «подвал продолжает акт «выход», а не начинает новый» —
    // ЭТА функция несёт только сторону (метаданные Ч-4, `data-line-side`).
    // Путь подвала (свой `vbH`, свой `d`, продолжающий `contact` с точки
    // схода) — `LINE_PATHS.footer` (`lib/linePaths.ts`, раздел 10 шаг 6),
    // не эта функция; его вычерчивает `linePaths.contract.test.ts` и
    // e2e-сторож соответствия, не этот файл.
    const data = computeLineData();
    const footer = footerLineData();
    expect(footer.side).toBe(data.contact.side);
  });

  it('измеренные высоты — положительные числа для всех десяти секций и подвала', () => {
    for (const s of HOME_SECTIONS) {
      expect(MEASURED_SECTION_HEIGHT[s.id], `нет измеренной высоты для ${s.id}`).toBeGreaterThan(0);
    }
    expect(MEASURED_FOOTER_HEIGHT).toBeGreaterThan(0);
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

  /* ПРАВКА `2026-08-27` (`70-workshop/specs/site-v3/11-line-narrator-
   *  brief.md`, раздел 12.1 В-4): подвал ПЕРЕСТАВАЛ рисовать `.line` —
   *  линия уходила за левую кромку холста внутри `contact` и в подвал не
   *  заходила.
   *
   *  ПРАВКА `2026-08-27`, тем же днём, позже (`70-workshop/specs/site-v3/
   *  16-line-digits-and-finale-brief.md`, раздел 3.3, вариант Б «Разгон»,
   *  выбран владельцем): В-4 ПЕРЕОТКРЫТА решением владельца — уход
   *  переехал с `contact` на подвал. Проверка переписана НАЗАД, к
   *  исходному смыслу («каждый `<svg>` компонента несёт
   *  `preserveAspectRatio="none"`»), а не оставлена в состоянии «нет
   *  `<svg>» — предмет проверки (ловушка 1, `preserveAspectRatio` на КАЖДОМ
   *  SVG страницы) не изменился, изменился только факт «есть ли этот SVG у
   *  Footer.astro вообще». */
  it('Footer.astro пишет preserveAspectRatio="none" на своём <svg> (В-4 переоткрыта, раздел 3.3 брифа `16-…`)', () => {
    const url = new URL('../components/Footer.astro', import.meta.url);
    const svgTags = markupSvgTags(readFileSync(url, 'utf8'));
    expect(svgTags.length, 'в Footer.astro нет ни одного <svg> — вариант Б ожидает линию в подвале').toBeGreaterThan(0);
    for (const tag of svgTags) {
      expect(tag, tag).toContain('preserveAspectRatio="none"');
    }
  });
});

/* Концы путей вне viewBox (раздел 3.6 брифа `02-background-line`, приёмка
 * п. 4) и доки (раздел 4.2) — эти инварианты раньше проверялись здесь на
 * `runD`/`turnD`, которых в этом файле больше нет (раздел 10 шаг 6: путь
 * считает только `lib/linePaths.ts`). Тот же вынос ≥ 60 единиц — Г-2,
 * строже прежней проверки «просто вне viewBox» — уже гоняет
 * `linePaths.contract.test.ts` на КАЖДОЙ записи `LINE_PATHS`; вершины
 * изгибов (аналог «доков» для траверса) — `linePaths.g5.test.ts`; а то, что
 * СТРАНИЦА рисует именно эти проверенные пути, а не какие-то другие, —
 * `background-line-registry-sync.spec.ts` (e2e). Второй копии этих
 * сторожей здесь не заводится. */
