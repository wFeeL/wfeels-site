import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LINE_PATHS, LINE_STROKE_WIDTH_VB, type LinePathEntry } from './linePaths';
import {
  flattenPath,
  lateralPercent,
  minRadius,
  overhang,
  polylineLength,
  resampleByLength,
  verticalRunLength,
} from './pathGeometry';

/** Контракт-тест реестра `lib/linePaths.ts` — бриф `70-workshop/specs/
 *  site-v3/05-line.md`, раздел 10 шаг 3, раздел 3 (Г-1…Г-4), раздел 11
 *  «Геометрия» (пп. 5–8). Считает по 200 точкам, равномерным по длине пути
 *  (`resampleByLength`), на каждой записи реестра — как велит план.
 *
 *  ОЖИДАЕМО КРАСНЫЙ на сегодняшней геометрии (шаг 2, до рисования шагом 4).
 *  План (раздел 10, строка 3) предсказывает провал Г-1 и Г-3. Замер этим
 *  файлом (2026-08-18) показывает КРАСНЫМ ТРИ свойства, не два:
 *
 *    - Г-1 (`R_min ≥ 8·w`) — падает на `services`/`process`/`contact`
 *      (радиус переиспользованной S-кривой перехода ≈ 16…24 units против
 *      требуемых 272 = 8·34);
 *    - Г-3 (длина ≤ 1,6·vbH) — падает на тех же трёх (переход добавляет
 *      к прогону лишнюю длину сверх порога);
 *    - Г-2, ПОЛОВИНА (обе численные проверки — «вертикальный прямой
 *      участок ≥ 96 px» И «вынос за viewBox ≥ 60») — падает на НАЧАЛЕ путей
 *      тех же трёх записей: `turnD` (см. `backgroundLine.ts`) трогает
 *      горизонталь сразу от `M` (первая контрольная точка кривой делит `x`
 *      со стартовой, но кривизна на самом старте уже не нулевая — это и
 *      есть «разрыв кривизны», измеренный разделом 1.2 брифа: «конец
 *      перехода: радиус ≈ 15 px», «кривизна… меняется от нуля» ИМЕННО
 *      ПОТОМУ, что сегодня прямого вертикального участка перед кривой нет).
 *      Вынос на начале при этом тоже недобирает порог (32,4…43,2 против
 *      требуемых 60 — `turnD` строит первую контрольную точку от `y(-40)`,
 *      не от `-60`). КОНЕЦ каждой записи (прямой хвост до низа бокса)
 *      обе половины Г-2 проходит — падает только начало трёх записей.
 *
 *  Это не ошибка счёта: тот же дефект (кривизна перехода ненулевая прямо у
 *  стыка) уже назван в брифе как причина, по которой рисунок «трубопровод»,
 *  а не «росчерк» (раздел 1.2). Шаг 4 рисует одиннадцать новых путей заново
 *  и обязан дать каждому вертикальный вход/выход ≥ 96 px по построению
 *  (раздел 4.4 брифа: «вертикальный вход ≥ 96 px, S-дуга, вертикальный
 *  выход ≥ 96 px») — тогда все три свойства станут зелёными одновременно,
 *  не по одному. */

const SAMPLE_COUNT = 200;
const R_MIN_FACTOR = 8; // Г-1: R_min ≥ 8·w
const VERTICAL_END_MIN = 96; // Г-2: вертикальный отрезок ≥ 96 px (единиц viewBox)
const OVERHANG_MIN = 60; // Г-2: вынос за viewBox ≥ 60 единиц
const LENGTH_FACTOR = 1.6; // Г-3: длина пути ≤ 1,6 · vbH
const LATERAL_STRAIGHT_MAX = 2; // Г-4: «прямая» — боковой ход ≤ 2 %
const LATERAL_EVENT_MIN = 25; // Г-4: «событие» — боковой ход ≥ 25 %

function sampled(entry: LinePathEntry) {
  const flat = flattenPath(entry.wide);
  const points = resampleByLength(flat, SAMPLE_COUNT);
  return { flat, points };
}

describe('реестр линии — толщина штриха сверена с CSS (раздел 7.2 брифа `05-line`)', () => {
  it('LINE_STROKE_WIDTH_VB совпадает со `stroke-width` в BackgroundLine.astro', () => {
    const url = new URL('../components/BackgroundLine.astro', import.meta.url);
    const css = readFileSync(url, 'utf8');
    const match = css.match(/\.line path\s*\{[^}]*stroke-width:\s*([\d.]+);/s);
    expect(match, 'stroke-width не найден в BackgroundLine.astro').not.toBeNull();
    expect(Number(match![1])).toBe(LINE_STROKE_WIDTH_VB);
  });
});

describe('реестр линии — Г-1: минимальный радиус ≥ 8·w (раздел 3 брифа `05-line`)', () => {
  it.each(Object.keys(LINE_PATHS))('%s: R_min ≥ 8·w = %d units', (id) => {
    const entry = LINE_PATHS[id];
    const { points } = sampled(entry);
    const rMin = minRadius(points);
    expect(rMin, `${id}: R_min=${rMin.toFixed(1)}, требуется ≥ ${R_MIN_FACTOR * LINE_STROKE_WIDTH_VB}`).toBeGreaterThanOrEqual(
      R_MIN_FACTOR * LINE_STROKE_WIDTH_VB,
    );
  });
});

describe('реестр линии — Г-2: вертикальные концы ≥ 96 px и вынос ≥ 60 (раздел 3 брифа `05-line`)', () => {
  it.each(Object.keys(LINE_PATHS))('%s: начало — прямой вертикальный участок ≥ 96', (id) => {
    const entry = LINE_PATHS[id];
    const { flat } = sampled(entry);
    const vStart = verticalRunLength(flat, true);
    expect(vStart, `${id}: вертикальный участок на начале = ${vStart.toFixed(1)}`).toBeGreaterThanOrEqual(
      VERTICAL_END_MIN,
    );
  });

  it.each(Object.keys(LINE_PATHS))('%s: конец — прямой вертикальный участок ≥ 96', (id) => {
    const entry = LINE_PATHS[id];
    const { flat } = sampled(entry);
    const vEnd = verticalRunLength(flat, false);
    expect(vEnd, `${id}: вертикальный участок на конце = ${vEnd.toFixed(1)}`).toBeGreaterThanOrEqual(
      VERTICAL_END_MIN,
    );
  });

  it.each(Object.keys(LINE_PATHS))('%s: оба конца вынесены за viewBox ≥ 60 единиц', (id) => {
    const entry = LINE_PATHS[id];
    const { flat } = sampled(entry);
    const { start, end } = overhang(flat, entry.vbH);
    expect(start, `${id}: вынос на начале = ${start.toFixed(1)}`).toBeGreaterThanOrEqual(OVERHANG_MIN);
    expect(end, `${id}: вынос на конце = ${end.toFixed(1)}`).toBeGreaterThanOrEqual(OVERHANG_MIN);
  });
});

describe('реестр линии — Г-3: длина пути ≤ 1,6 · vbH (раздел 3 брифа `05-line`)', () => {
  it.each(Object.keys(LINE_PATHS))('%s: длина ≤ 1,6·vbH', (id) => {
    const entry = LINE_PATHS[id];
    const { flat } = sampled(entry);
    const length = polylineLength(flat);
    const limit = LENGTH_FACTOR * entry.vbH;
    expect(length, `${id}: длина=${length.toFixed(1)}, предел=${limit.toFixed(1)} (vbH=${entry.vbH})`).toBeLessThanOrEqual(
      limit,
    );
  });
});

describe('реестр линии — Г-4: боковой ход либо ≤ 2 %, либо ≥ 25 % (раздел 3 брифа `05-line`)', () => {
  it.each(Object.keys(LINE_PATHS))('%s: боковой ход не в запретной середине', (id) => {
    const entry = LINE_PATHS[id];
    const { flat } = sampled(entry);
    const lateral = lateralPercent(flat);
    const ok = lateral <= LATERAL_STRAIGHT_MAX || lateral >= LATERAL_EVENT_MIN;
    expect(ok, `${id}: боковой ход=${lateral.toFixed(2)}% — ни «прямая» (≤2%), ни «событие» (≥25%)`).toBe(true);
  });
});
