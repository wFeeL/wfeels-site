import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WEIGHT_ILLUSTRATION } from '../data/case-illustrations';

/* Иллюстрация «Замер» (`CaseWeightIllustration.astro`) — сторож сторожа.
 *
 * `check-budget.mjs` сверяет вес, медиану и кратность с фактом на собранной
 * странице, но делает это, только если сам НАХОДИТ клетку по её якорю
 * `data-cell`. Если разметка когда-нибудь потеряет якорь (переименуют,
 * перевёрстают, соберут числа иначе), проверка молча перестанет выполняться и
 * гейт продолжит печатать зелёную галочку, не проверяя то, ради чего заведён —
 * тот же класс дефекта, что уже дважды ловили на флаге `i` и на литерале
 * медианы (`pageWeight.ts`).
 *
 * Требует `npm run build` перед `npm run test:unit`. */
const DIST_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));

/** Поддерево `<div …маркер…>…</div>` по БАЛАНСУ тегов — тот же приём, что
 *  `extractElementByMarker` в `check-budget.mjs`: наивный поиск первого
 *  `</div>` оборвал бы срез на первой внутренней клетке. */
function extractByMarker(html: string, marker: string): string {
  const openRe = /<div\b[^>]*>/g;
  let start = -1;
  let scanFrom = -1;
  for (const m of html.matchAll(openRe)) {
    if (m[0].includes(marker)) {
      start = m.index!;
      scanFrom = m.index! + m[0].length;
      break;
    }
  }
  if (start === -1) return '';
  const tagRe = /<div\b[^>]*>|<\/div>/g;
  tagRe.lastIndex = scanFrom;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(start, tagRe.lastIndex);
  }
  return '';
}

/** Срез клетки по якорю — тем же приёмом, что `extractCell` в
 *  `check-budget.mjs`: от начала клетки до начала следующей. */
function cell(html: string, key: string): string {
  const start = html.indexOf(`data-cell="${key}"`);
  if (start === -1) return '';
  const next = html.indexOf('data-cell="', start + 1);
  return html.slice(start, next === -1 ? html.length : next);
}

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
  const sectionHtml = html.slice(weightStart, weightEnd);
  /** Только сама иллюстрация — без прозы кейса вокруг неё: иначе тексты
   *  соседних блоков подворачивались бы под проверки ниже. */
  const weightHtml = extractByMarker(sectionHtml, 'data-illustration="case-weight"');

  it('иллюстрация вырезается по маркеру — без него сверять числа некому', () => {
    expect(weightHtml, 'поддерево иллюстрации не вырезалось').not.toBe('');
    // `data-illustration="case-weight"` — машинный признак, по которому
    // `check-budget.mjs` вырезает именно эту иллюстрацию из собранной страницы.
    expect(weightHtml, 'data-illustration="case-weight"').toContain(
      'data-illustration="case-weight"',
    );
  });

  it('четыре клетки сравнения — каждая со своим якорем и своим числом', () => {
    for (const c of WEIGHT_ILLUSTRATION.cells) {
      const slice = cell(weightHtml, c.key);
      expect(slice, `клетка data-cell="${c.key}" не найдена`).not.toBe('');
      expect(slice, `${c.key}: значение «${c.value}»`).toContain(c.value);
      expect(slice, `${c.key}: подпись «${c.caption}»`).toContain(c.caption);
    }
  });

  it('регулярки гейта находят вес и медиану каждую в своей клетке', () => {
    // Ровно те выражения, которыми числа читает `check-budget.mjs`: если
    // разметка разведёт число и единицу по разным тегам, регулярка перестанет
    // совпадать, и гейт пройдёт молча, ничего не проверив.
    expect(/(\d+)\s*КБ/.test(cell(weightHtml, 'weight-ours'))).toBe(true);
    expect(/(\d+),(\d+)\s*МБ/.test(cell(weightHtml, 'weight-typical'))).toBe(true);
  });

  it('вес страницы не подвернулся гейту из чужой клетки', () => {
    // Клетка медианы не должна содержать «N КБ», иначе срез «наша сторона»
    // и срез «чужая» стали бы взаимозаменяемы, и ошибка вёрстки прошла бы.
    expect(/(\d+)\s*КБ/.test(cell(weightHtml, 'weight-typical'))).toBe(false);
  });

  it('вывод несёт кратность цифрой и тем же числом словами', () => {
    const verdict = cell(weightHtml, 'verdict');
    expect(verdict, `${WEIGHT_ILLUSTRATION.multiplier}×`).toContain(
      `${WEIGHT_ILLUSTRATION.multiplier}×`,
    );
    expect(verdict, WEIGHT_ILLUSTRATION.multiplierPhrase).toContain(
      WEIGHT_ILLUSTRATION.multiplierPhrase,
    );
    // Слово выведено из числа, а не написано рядом: смена кратности обязана
    // менять обе формы разом. Здесь это проверяется на СОБРАННОЙ странице —
    // именно там они и могли бы разойтись.
    expect(/(\d+)×/.exec(verdict)?.[1]).toBe(String(WEIGHT_ILLUSTRATION.multiplier));
  });

  it('канал и метрика названы на самом рисунке, а не только в коде', () => {
    // Без названного канала «0,4 с» — не число, а впечатление: та же страница
    // даёт 0,048 с на 100 Мбит/с. Оговорка обязана быть видима читателю.
    const link = cell(weightHtml, 'link');
    expect(link, WEIGHT_ILLUSTRATION.linkLabel).toContain(WEIGHT_ILLUSTRATION.linkLabel);
    expect(/\d+\s*МБИТ\/С/i.test(link)).toBe(true);
    expect(/ПОЛНАЯ ЗАГРУЗКА/i.test(link)).toBe(true);
  });

  it('рисунок ничего не обещает читателю про его собственный сайт', () => {
    // Сайт не опубликован, хостинг не выбран, TTFB хостинга в замер не входит:
    // «время загрузки у вас» было бы обещанием, а не замером.
    expect(weightHtml).not.toMatch(/у\s+вас/i);
    expect(weightHtml).not.toMatch(/ваш(его|а|ей|ем)?\s+сайт/i);
  });

  it('число тестов не напечатано — у него нет и не может быть сторожа', () => {
    expect(weightHtml).not.toMatch(/тест/i);
  });

  it('конечное состояние — состояние по умолчанию: ни одного нуля в разметке', () => {
    // Отсчёт от нуля живёт только в скрипте и только при разрешённом
    // движении. В разметке обязаны стоять конечные значения: любой сбой
    // (нет JS, нет таймлайнов, `reduce`) оставляет рисунок правдивым.
    for (const c of WEIGHT_ILLUSTRATION.cells) {
      const slice = cell(weightHtml, c.key);
      const printed = /<p class="v"[^>]*>([^<]+)</.exec(slice)?.[1];
      expect(printed, `клетка ${c.key}: напечатанное значение`).toBe(c.value);
    }
  });

  it('счётчик уехал в сборку инлайном — поднимаемый скрипт сюда не доезжает', () => {
    // Иллюстрации приезжают на страницу через слот, который
    // `CaseIllustrationField` рендерит вручную, — поднятые скрипты страницы к
    // этому моменту уже собраны, и обычный `<script>` из этого компонента в
    // сборке не появится вовсе. Потеря молчаливая: сборка зелёная, разметка на
    // месте, тесты проходят, поведения нет. Ищем сам текст счётчика в HTML.
    expect(sectionHtml, 'инлайновый счётчик не доехал до сборки')
      .toContain("querySelectorAll('[data-count]')");
  });

  it('единственный акцент рисунка — наша сторона сравнения', () => {
    // `.cell.ours .v` красится акцентом, чужая сторона — нет. Проверяется по
    // классам разметки: сама раскраска живёт в CSS компонента.
    for (const c of WEIGHT_ILLUSTRATION.cells) {
      expect(weightHtml, `клетка ${c.key} на стороне «${c.side}»`)
        .toContain(`class="cell ${c.side}" data-cell="${c.key}"`);
    }
  });

  it('внутри иллюстрации нет растра, видео, canvas или background-image: url()', () => {
    expect(weightHtml).not.toMatch(/<img\b/i);
    expect(weightHtml).not.toMatch(/<video\b/i);
    expect(weightHtml).not.toMatch(/<canvas\b/i);
    expect(weightHtml).not.toContain('url(');
  });
});
