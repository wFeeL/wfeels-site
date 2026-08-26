import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  FLOW_SOURCES,
  DELIVERY_CHANNELS,
  FLOW_RETRY_LABEL,
  DIALOGUE_LINES,
  DIALOGUE_INPUT_PLACEHOLDER,
  DIALOGUE_STATUS_LABEL,
  DIALOGUE_WINDOW_TITLE,
} from '../data/case-illustrations';

/* Критерии приёмки `70-workshop/specs/site-v3/02-case-illustrations.md`,
 * раздел 7, проверяемые на готовой сборке `dist/`, а не рассуждением. Тот же
 * паттерн, что `dist-factory-core.test.ts`. Требует `npm run build` перед
 * `npm run test:unit`.
 *
 * Правка владельца 2026-08-20 сняла с главной кейсы «Заявка-Хаб» и
 * «ИИ-консультант»: сегодня их рисунки не выводятся НИ НА ОДНОЙ странице
 * сборки. Проверки не удалены и не переписаны под пустоту — они ищут свой
 * рисунок по всей сборке, а не только в `index.html`, и спят ровно до тех
 * пор, пока его негде найти. Появится страница каталога кейсов (спека 04) —
 * они проснутся сами, на той странице, где рисунок окажется, и без правки
 * этого файла. Пустой прогон был бы хуже: он бы молчал.
 *
 * Общие сторожа секции кейсов главной читают `index.html` как прежде. С
 * 2026-08-24 у галереи Telegram Mini App законно появились один ленивый
 * растр первой загрузки и две кнопки навигации; остальные медиа и элементы
 * формы по-прежнему запрещены. */

const DIST_DIR = fileURLToPath(new URL('../../dist/', import.meta.url));
const DIST_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));

/** Все собранные HTML-страницы, включая вложенные (`contact/index.html`). */
function distPages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}${entry.name}`;
    if (entry.isDirectory()) out.push(...distPages(`${full}/`));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

/** Разметка страницы сборки, на которой сегодня выведен рисунок с этим
 *  машинным признаком, — или `null`, если такой страницы нет. */
function renderedPage(marker: string): string | null {
  if (!existsSync(DIST_DIR)) return null;
  for (const file of distPages(DIST_DIR)) {
    const html = readFileSync(file, 'utf8');
    if (html.includes(marker)) return html;
  }
  return null;
}

const FLOW_PAGE = renderedPage('data-case-flow');
const DIALOGUE_PAGE = renderedPage('data-case-dialogue');

describe('dist/index.html — иллюстрации «Одна труба» и «Пример диалога»', () => {
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
  const casesHtml = html.slice(casesStart, casesEnd);

  it('внутри секции по одному img на галерею; видео, canvas и background-image нет', () => {
    const images = casesHtml.match(/<img\b[^>]*>/gi) ?? [];
    expect(images).toHaveLength(2);
    expect(images[0]).toContain('/cases/storefront/yasmina-home.avif');
    expect(images[0]).toContain('data-storefront-screen');
    expect(images[0]).toContain('loading="lazy"');
    expect(images[1]).toContain('data-website-screen');
    expect(images[1]).toContain('loading="lazy"');
    expect(images[1]).not.toMatch(/\bsrc=/);
    expect(casesHtml).not.toMatch(/<video\b/i);
    expect(casesHtml).not.toMatch(/<canvas\b/i);
    expect(casesHtml).not.toContain('url(');
  });

  it('внутри секции нет формы; каждая галерея содержит ровно две стрелки', () => {
    expect(casesHtml).not.toMatch(/<input\b/i);
    expect(casesHtml).not.toMatch(/<form\b/i);
    const buttons = casesHtml.match(/<button\b[^>]*>/gi) ?? [];
    expect(buttons).toHaveLength(4);
    const arrows = buttons.filter((button) => button.includes('data-step='));
    expect(arrows).toHaveLength(4);
    expect(casesHtml).not.toContain('data-app-index');
    expect(casesHtml).not.toContain('data-screen-index');
    expect(casesHtml).toContain('data-storefront-store');
    expect(casesHtml).toContain('data-website-site');
    for (const button of arrows) {
      expect(button).toContain('data-step=');
      expect(button).toContain('aria-label=');
      expect(button).toContain('type="button"');
    }
  });

  describe.skipIf(FLOW_PAGE === null)('«Одна труба, четыре отвода» (Заявка-Хаб)', () => {
    // Страница, на которой рисунок выведен сегодня. До правки 2026-08-20 это
    // была секция кейсов главной; имя переменной сохранено, чтобы правка не
    // трогала два десятка проверок ниже.
    const casesHtml = FLOW_PAGE ?? '';
    /* С 2026-08-26 (`70-workshop/specs/site-v3/12-case-pages-brief.md`,
     * раздел 2, П-3) компонент умеет режим ОДНОЙ копии разметки —
     * `single="b"`, обязательный для панели разворота: два `<svg>` под
     * разные ширины запрещены. Сегодня единственный вывод рисунка на сайте —
     * ровно этот режим (`/cases/zayavka-hub`, разворот 4), поэтому проверки
     * ниже ветвятся по фактическому атрибуту `data-single="b"` на странице,
     * а не предполагают дуальный раскрой как единственный. */
    const isSingleB = /data-single="b"/.test(casesHtml);

    it('раскрой Б присутствует всегда; раскрой А — только вне режима одной копии', () => {
      expect(casesHtml).toContain('class="svg rb"');
      expect(casesHtml.includes('class="svg ra"')).toBe(!isSingleB);
    });

    it('четыре канала доставки и подпись возврата — дословно из данных', () => {
      for (const c of DELIVERY_CHANNELS) {
        expect(casesHtml, c.label).toContain(`>${c.label}<`);
      }
      expect(casesHtml, FLOW_RETRY_LABEL).toContain(FLOW_RETRY_LABEL);
    });

    it('три источника — дословно из данных', () => {
      for (const s of FLOW_SOURCES) {
        expect(casesHtml, s.label).toContain(s.label);
      }
    });

    it('ни один канал не назван чужим сервисом (README.md:105)', () => {
      expect(/google|sheets|bitrix|amocrm|битрикс|амоцрм/i.test(casesHtml)).toBe(false);
    });

    it('число попыток повтора не названо — MAX_DELIVERY_ATTEMPTS настраиваемый', () => {
      // Подпись возврата — текстовый узел `>НЕ ДОШЛО — ПОВТОР<`, без цифры
      // рядом внутри самого текстового содержимого (README.md:94).
      expect(/\d/.test(FLOW_RETRY_LABEL)).toBe(false);
      expect(casesHtml).toContain(`>${FLOW_RETRY_LABEL}<`);
    });

    // В режиме одной копии срез начинается с единственного `class="svg rb"`,
    // а не с отсутствующего `class="svg ra"` — иначе `indexOf` даёт `-1`, и
    // `slice(-1, …)` читает мусор с конца строки (ровно так покраснел этот
    // файл при первом включении `single="b"`, 2026-08-26).
    const flowStart = casesHtml.indexOf(isSingleB ? 'class="svg rb"' : 'class="svg ra"');
    const flowEnd = casesHtml.indexOf('</svg>', casesHtml.indexOf('class="svg rb"')) + 6;
    const flowSvgs = casesHtml.slice(flowStart, flowEnd);
    const expectedSvgCount = isSingleB ? 1 : 2;

    it('раскрой(ы) дают одно и то же описание в role="img"/aria-label', () => {
      // Срез только SVG «Одной трубы» — секция кейсов несёт третий
      // `role="img"` (ядро фабрики, `FactoryCore.astro`), он не в счёте.
      const labels = [...flowSvgs.matchAll(/role="img" aria-label="([^"]+)"/g)].map((m) => m[1]);
      expect(labels.length).toBe(expectedSvgCount);
      if (labels.length > 1) expect(labels[0]).toBe(labels[1]);
      for (const s of FLOW_SOURCES) expect(labels[0].toLowerCase()).toContain(s.label.toLowerCase());
      for (const c of DELIVERY_CHANNELS) expect(labels[0].toLowerCase()).toContain(c.label.toLowerCase());
    });

    it('только ортогональные команды пути: нет C/S/Q/T — ни в `d`, ни в `offset-path`', () => {
      // Маршрут пакета живёт не в атрибуте `d`, а в инлайновом
      // `offset-path: path('…')` (бриф `07-flow-motion-brief.md`, раздел 6:
      // «правило ортогонали: C/S/Q/T в `d` нет и в `offset-path` нет»).
      // Проверка только по `d` его не видела бы вовсе.
      const pathData = [...flowSvgs.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
      expect(pathData.length).toBeGreaterThan(0);
      const routes = [...flowSvgs.matchAll(/offset-path:path\('([^']+)'\)/g)].map((m) => m[1]);
      expect(routes.length, 'маршрутов пакета в разметке нет — offset-path потерялся').toBe(expectedSvgCount);
      for (const d of [...pathData, ...routes]) {
        expect(d, d).not.toMatch(/[CSQT]/);
      }
    });

    it('ни одной цифры ни в одной подписи раскроя(ев) (бриф 07, критерий 13)', () => {
      const texts = [...flowSvgs.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1]);
      // Раскрой Б один несёт 7 текстовых узлов (источники одной строкой,
      // «ЗАЯВКА», четыре канала, подпись возврата); оба раскроя вместе — 16.
      expect(texts.length, 'подписей в раскроях не нашлось — селектор устарел').toBeGreaterThan(isSingleB ? 4 : 8);
      for (const t of texts) {
        expect(/[0-9]/.test(t), `подпись «${t}» несёт цифру`).toBe(false);
      }
    });
  });

  /* Переписка переработана 2026-08-19 по эскизу и решениям владельца: ровно
   * одна пара реплик, метки поля больше нет, окно зациклено. Проверки ниже
   * переписаны под этот состав, а не подогнаны под прежний. */
  describe.skipIf(DIALOGUE_PAGE === null)('«Пример диалога» (ИИ-консультант)', () => {
    const casesHtml = DIALOGUE_PAGE ?? '';
    it('шапка окна: состояние и собеседник — дословно из данных', () => {
      expect(casesHtml).toContain(DIALOGUE_STATUS_LABEL);
      expect(casesHtml).toContain(DIALOGUE_WINDOW_TITLE);
    });

    it('снятой метки поля «ПРИМЕР ДИАЛОГА · МАТЕРИАЛЫ ГРУМИНГ-САЛОНА» на странице нет', () => {
      expect(casesHtml).not.toContain('ПРИМЕР ДИАЛОГА');
      expect(casesHtml).not.toContain('МАТЕРИАЛЫ ГРУМИНГ-САЛОНА');
    });

    it('обе реплики присутствуют дословно, по порядку', () => {
      let cursor = -1;
      for (const line of DIALOGUE_LINES) {
        const idx = casesHtml.indexOf(line.text, cursor + 1);
        expect(idx, `реплика «${line.text}» не найдена по порядку`).toBeGreaterThan(cursor);
        cursor = idx;
      }
    });

    it('чип источника — дословно, у ответа', () => {
      const withSource = DIALOGUE_LINES.find((l) => l.source);
      expect(withSource).toBeDefined();
      expect(casesHtml).toContain(`ИСТОЧНИК: ${withSource!.source}`);
    });

    it('подписи времени присутствуют дословно', () => {
      for (const line of DIALOGUE_LINES) {
        expect(casesHtml).toContain(line.meta);
      }
    });

    it('в репликах диалога нет ни одной цифры и нет ₽ (время живёт отдельным полем)', () => {
      for (const line of DIALOGUE_LINES) {
        expect(/[0-9₽]/.test(line.text)).toBe(false);
      }
    });

    it('ни слова «клиент», «заказчик», «для компании» — правило действует и на выдуманный салон', () => {
      const start = casesHtml.indexOf('<ol');
      const end = casesHtml.indexOf('</ol>', start);
      const dialogueHtml = casesHtml.slice(start, end);
      expect(/клиент(?!ск)|заказчик|для компании/i.test(dialogueHtml)).toBe(false);
    });

    it('диалог — настоящий текст в разметке: список <ol> ровно из двух <li>', () => {
      const start = casesHtml.indexOf('<ol');
      const end = casesHtml.indexOf('</ol>', start);
      const ol = casesHtml.slice(start, end);
      expect((ol.match(/<li/g) || []).length).toBe(2);
      // Ни один пункт списка не спрятан от программы чтения по отдельности:
      // окно объявлено единой иллюстрацией целиком, а не по кускам.
      expect(ol).not.toMatch(/<li[^>]*aria-hidden/);
    });

    it('окно объявлено единой иллюстрацией с осмысленным описанием', () => {
      const idx = casesHtml.indexOf('role="img"');
      expect(idx, 'у окна переписки нет role="img"').toBeGreaterThan(-1);
      const tagStart = casesHtml.lastIndexOf('<div', idx);
      const tag = casesHtml.slice(tagStart, casesHtml.indexOf('>', idx) + 1);
      expect(tag).toContain('aria-label=');
      expect(tag).toContain('data-case-dialogue');
      // Описание собрано из тех же данных, что и рисунок.
      for (const line of DIALOGUE_LINES) {
        expect(tag, `описание не несёт реплику «${line.text}»`).toContain(line.text);
      }
      expect(tag).toContain(DIALOGUE_LINES[1].source!);
    });

    it('подсказка строки ввода присутствует дословно', () => {
      expect(casesHtml).toContain(DIALOGUE_INPUT_PLACEHOLDER);
    });

    it('строка ввода и кнопка отправки — рисунок, не форма: вне таб-порядка', () => {
      const idx = casesHtml.indexOf(DIALOGUE_INPUT_PLACEHOLDER);
      expect(idx).toBeGreaterThan(-1);
      const before = casesHtml.slice(Math.max(0, idx - 400), idx);
      const divStart = before.lastIndexOf('<div class="input');
      expect(divStart, 'контейнер строки ввода не найден перед подсказкой').toBeGreaterThan(-1);
      const inputTag = before.slice(divStart);
      expect(inputTag).not.toContain('tabindex');
      // Кнопка отправки — `<span>`, не `<button>`: две реальные кнопки
      // секции принадлежат только галерее Storefront и проверяются выше.
    });

    it('затвор цикла доехал до сборки: инлайновый скрипт с IntersectionObserver', () => {
      // Поднимаемый `<script>` из этого компонента в сборку не попадает —
      // иллюстрация приезжает через `Astro.slots.render`. Сторож ровно на это.
      expect(casesHtml).toContain('data-case-dialogue');
      expect(casesHtml).toMatch(/IntersectionObserver[\s\S]*data-case-dialogue/);
    });
  });
});
