import { describe, expect, it } from 'vitest';
import { LINE_PATHS, LINE_STROKE_WIDTH_VB } from './linePaths';
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
    // Домен таблицы шторки — `OVERHANG` (координата конца пути), не
    // `CAP_OVERHANG` (раздел у `revealKeyframes`, `linePaths.ts`): таблица
    // кодирует движение кончика по дуге ПУТИ, а бокс, который накрывает
    // шторка (`overhangPercent`, проверен отдельным тестом ниже), больше на
    // `w/2` — это разные величины по конструкции, не расхождение.
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
    // Правка 2026-08-27, второй заход (`70-workshop/specs/site-v3/
    // 11-line-narrator-brief.md`, раздел 12.5): реестр переписан заново по
    // размеченному референсу, независимо от Р-2 (раздел 12.1: «откатывать
    // нечего», та ветка никогда не вливалась в `main`). Событие теперь несут
    // ОБЕ `services` и `pricing`, `hero` — пологая диагональ (событие «кнопка
    // загорается»), `cases` — S-образный подъём к «Замеру», `contact` —
    // уход с дока влево. Прямые (без события) — только те пять записей, чья
    // `wide` в `linePaths.ts` строится `straightPath`.
    const straightIds = ['pain', 'process', 'guarantees', 'about', 'faq'];
    for (const id of straightIds) {
      expect(LINE_PATHS[id].reveal.length, `${id}: ожидалось 2 стопа (прямая)`).toBe(2);
    }
  });

  it('траверсы/диагонали дают больше двух стопов — кривизна не сглаживается до прямой', () => {
    for (const id of ['hero', 'services', 'pricing', 'cases', 'contact']) {
      expect(LINE_PATHS[id].reveal.length, `${id}: ожидалась не-прямая раскладка`).toBeGreaterThan(2);
    }
  });

  it('overhangPercent совпадает с (OVERHANG + w/2)/vbH — прячет и координату, и полукруг торца', () => {
    // Раздел 3 брифа `05-line`, Г-2 + дефект «оторванный кусок линии»
    // (ревью 2026-08-21, `CAP_OVERHANG` в `linePaths.ts`): шторка обязана
    // накрывать не только координату конца пути (`OVERHANG`), но и
    // закрашенный `round`-полукруг вокруг неё (`w/2`) — иначе он торчит
    // из-под шторки соседней секции, которая красится позже в DOM.
    //
    // ИСКЛЮЧЕНИЕ — `hero` (раздел 12.4 брифа `11-line-narrator-brief.md`):
    // клин первого экрана поднимается выше, чем накрывает голый
    // `CAP_OVERHANG`, и её вынос считается от полуширины ГОЛОВЫ
    // (`CAP_OVERHANG_HERO = OVERHANG + HEAD_WIDTH_VB / 2 = 110,5`), не
    // штриха — проверено отдельно, ниже.
    const CAP_OVERHANG = 60 + LINE_STROKE_WIDTH_VB / 2;
    for (const [id, entry] of Object.entries(LINE_PATHS)) {
      if (id === 'hero') continue;
      const expected = (CAP_OVERHANG / entry.vbH) * 100;
      expect(entry.overhangPercent, id).toBeCloseTo(expected, 1);
    }
  });

  it('hero: overhangPercent считается от полуширины головы (CAP_OVERHANG_HERO = 110,5), не штриха', () => {
    const CAP_OVERHANG_HERO = 60 + 101 / 2; // OVERHANG + HEAD_WIDTH_VB / 2, раздел 12.4
    const hero = LINE_PATHS.hero;
    const expected = (CAP_OVERHANG_HERO / hero.vbH) * 100;
    expect(hero.overhangPercent).toBeCloseTo(expected, 1);
    // Габарит клина уходит до vbY = −84,1 (раздел 12.4) — шторка обязана
    // накрыть эту координату целиком, иначе клин виден до раскрытия.
    expect((hero.overhangPercent * hero.vbH) / 100).toBeGreaterThanOrEqual(84.1);
  });
});
