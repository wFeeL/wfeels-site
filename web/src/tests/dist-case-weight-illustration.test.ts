import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WEIGHT_ILLUSTRATION } from '../data/case-illustrations';

/* Иллюстрация «Замер» (`CaseWeightIllustration.astro`) — сторож сторожа.
 *
 * `check-budget.mjs` сверяет числа «весит N КБ», «JS N,N КБ», «N сторонних
 * скриптов» с фактом на собранной странице, но делает это, только если сам
 * НАХОДИТ строку на странице — если разметка когда-нибудь потеряет один из
 * этих кусков текста (переименуют класс, перепишут фразу), проверка молча
 * перестанет выполняться и гейт продолжит печатать зелёную галочку, не
 * проверяя то, ради чего заведён (тот же класс дефекта, что уже дважды ловили
 * на флаге `i` и на литерале медианы, `pageWeight.ts:19-30`).
 *
 * Требует `npm run build` перед `npm run test:unit`. */
const DIST_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));

describe('dist/index.html — иллюстрация «Замер»', () => {
  it('сборка существует (npm run build перед этим набором)', () => {
    if (!existsSync(DIST_INDEX)) {
      throw new Error(
        `\n${DIST_INDEX} не найден. Сначала выполни \`npm run build\` в web/, ` +
        'затем повтори `npm run test:unit`.',
      );
    }
    expect(true).toBe(true);
  });

  if (!existsSync(DIST_INDEX)) return;
  const html = readFileSync(DIST_INDEX, 'utf8');

  const casesStart = html.indexOf('id="cases"');
  const casesEnd = html.indexOf('id="process"');
  expect(casesStart, 'секция id="cases" не найдена').toBeGreaterThan(-1);
  expect(casesEnd, 'секция id="process" не найдена').toBeGreaterThan(casesStart);
  const weightStart = casesStart;
  const weightEnd = html.indexOf('class="flow"', weightStart);
  expect(weightEnd, 'иллюстрация «Одна труба» не найдена следом').toBeGreaterThan(weightStart);
  const weightHtml = html.slice(weightStart, weightEnd);

  it('обе полосы сравнения и оба числа — дословно из data/pageWeight.ts', () => {
    expect(weightHtml, 'ЭТОТ САЙТ').toContain('ЭТОТ САЙТ');
    expect(weightHtml, 'СРЕДНИЙ').toContain('СРЕДНИЙ');
    expect(weightHtml, `${WEIGHT_ILLUSTRATION.ourKb} КБ`).toContain(`${WEIGHT_ILLUSTRATION.ourKb} КБ`);
    expect(weightHtml, `${WEIGHT_ILLUSTRATION.typicalMbText} МБ`).toContain(
      `${WEIGHT_ILLUSTRATION.typicalMbText} МБ`,
    );
  });

  it('регулярка гейта «весит N КБ» находит утверждение на этой же странице', () => {
    // Тот же паттерн, что `check-budget.mjs:368` — строчными, без флага `i`.
    expect(/весит\s+\d+\s*КБ/.test(html)).toBe(true);
  });

  it('регулярка гейта «N,N КБ JS» находит мелкую метрику JS дословно', () => {
    expect(weightHtml, `${WEIGHT_ILLUSTRATION.jsGzipKbText} КБ JS`).toContain(
      `${WEIGHT_ILLUSTRATION.jsGzipKbText} КБ JS`,
    );
    expect(/(\d+),(\d+)\s*КБ\s*JS\b/.test(weightHtml)).toBe(true);
  });

  it('регулярка гейта «N сторонних скриптов» находит мелкую метрику дословно', () => {
    expect(weightHtml, `${WEIGHT_ILLUSTRATION.thirdPartyScriptsCount} сторонних скриптов`).toContain(
      `${WEIGHT_ILLUSTRATION.thirdPartyScriptsCount} сторонних скриптов`,
    );
    expect(/\d+\s*сторонних\s*скрипт/i.test(weightHtml)).toBe(true);
  });

  it('число тестов не напечатано — у него нет и не может быть сторожа', () => {
    expect(weightHtml).not.toMatch(/тест/i);
  });

  it('доля полосы «этот сайт» — точное вычисление из тех же двух чисел, не второй литерал', () => {
    const expectedPct = ((WEIGHT_ILLUSTRATION.ourKb / WEIGHT_ILLUSTRATION.typicalKb) * 100).toFixed(2);
    expect(weightHtml, `--target:${expectedPct}%`).toContain(`--target:${expectedPct}%`);
    // Соразмерность: полоса «этот сайт» обязана быть короче в ту же кратность,
    // что печатает подпись под полем (WEIGHT_CLAIM) — не «заметно короче».
    const ratio = WEIGHT_ILLUSTRATION.typicalKb / WEIGHT_ILLUSTRATION.ourKb;
    expect(Math.round(ratio)).toBe(WEIGHT_ILLUSTRATION.multiplier);
  });

  it('якорь гейта и коэффициент — правый нижний угол блока, число из WEIGHT_ILLUSTRATION.multiplier', () => {
    // `data-illustration="case-weight"` — машинный признак, по которому
    // `check-budget.mjs` вырезает именно эту иллюстрацию из собранной
    // страницы (решение владельца 2026-08-14, пункт 7 списка правок).
    expect(weightHtml, 'data-illustration="case-weight"').toContain(
      'data-illustration="case-weight"',
    );
    expect(weightHtml, `×${WEIGHT_ILLUSTRATION.multiplier}`).toContain(
      `×${WEIGHT_ILLUSTRATION.multiplier}`,
    );
  });

  it('единственный акцент рисунка — на полосе «этот сайт», не на полосе медианы', () => {
    const oursRow = weightHtml.slice(weightHtml.indexOf('class="bar-row ours"'), weightHtml.indexOf('class="bar-row typical"'));
    const typicalRow = weightHtml.slice(weightHtml.indexOf('class="bar-row typical"'));
    expect(oursRow, 'полоса «этот сайт» несёт класс accent').toContain('fill accent');
    expect(typicalRow, 'полоса медианы не несёт accent').not.toContain('fill accent');
  });

  it('внутри иллюстрации нет растра, видео, canvas или background-image: url()', () => {
    expect(weightHtml).not.toMatch(/<img\b/i);
    expect(weightHtml).not.toMatch(/<video\b/i);
    expect(weightHtml).not.toMatch(/<canvas\b/i);
    expect(weightHtml).not.toContain('url(');
  });
});
