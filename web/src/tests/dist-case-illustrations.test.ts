import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
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
 * `npm run test:unit`. */

const DIST_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));

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

  it('внутри секции кейсов нет растра, видео, canvas или background-image: url()', () => {
    expect(casesHtml).not.toMatch(/<img\b/i);
    expect(casesHtml).not.toMatch(/<video\b/i);
    expect(casesHtml).not.toMatch(/<canvas\b/i);
    expect(casesHtml).not.toContain('url(');
  });

  it('внутри секции кейсов нет настоящей формы: ни <input, ни <button (бриф 04, раздел 3.2/13.7)', () => {
    // Кнопка «Все кейсы» — `<a class="btn secondary">` (Button.astro), не
    // `<button>`; строка ввода чата — `<div aria-hidden>`, не `<input>`.
    expect(casesHtml).not.toMatch(/<input\b/i);
    expect(casesHtml).not.toMatch(/<button\b/i);
  });

  describe('«Одна труба, четыре отвода» (Заявка-Хаб)', () => {
    it('оба раскроя SVG присутствуют в разметке', () => {
      expect(casesHtml).toContain('class="svg ra"');
      expect(casesHtml).toContain('class="svg rb"');
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

    const flowStart = casesHtml.indexOf('class="svg ra"');
    const flowEnd = casesHtml.indexOf('</svg>', casesHtml.indexOf('class="svg rb"')) + 6;
    const flowSvgs = casesHtml.slice(flowStart, flowEnd);

    it('оба раскроя дают одно и то же описание в role="img"/aria-label', () => {
      // Срез только двух SVG «Одной трубы» — секция кейсов несёт третий
      // `role="img"` (ядро фабрики, `FactoryCore.astro`), он не в счёте.
      const labels = [...flowSvgs.matchAll(/role="img" aria-label="([^"]+)"/g)].map((m) => m[1]);
      expect(labels.length).toBe(2);
      expect(labels[0]).toBe(labels[1]);
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
      expect(routes.length, 'маршрутов пакета в разметке нет — offset-path потерялся').toBe(2);
      for (const d of [...pathData, ...routes]) {
        expect(d, d).not.toMatch(/[CSQT]/);
      }
    });

    it('ни одной цифры ни в одной подписи обоих раскроев (бриф 07, критерий 13)', () => {
      const texts = [...flowSvgs.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1]);
      expect(texts.length, 'подписей в раскроях не нашлось — селектор устарел').toBeGreaterThan(8);
      for (const t of texts) {
        expect(/[0-9]/.test(t), `подпись «${t}» несёт цифру`).toBe(false);
      }
    });
  });

  /* Переписка переработана 2026-08-19 по эскизу и решениям владельца: ровно
   * одна пара реплик, метки поля больше нет, окно зациклено. Проверки ниже
   * переписаны под этот состав, а не подогнаны под прежний. */
  describe('«Пример диалога» (ИИ-консультант)', () => {
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
      // Кнопка отправки — `<span>`, не `<button>`: проверяется общим сторожем
      // «внутри секции кейсов нет <button>» выше.
    });

    it('затвор цикла доехал до сборки: инлайновый скрипт с IntersectionObserver', () => {
      // Поднимаемый `<script>` из этого компонента в сборку не попадает —
      // иллюстрация приезжает через `Astro.slots.render`. Сторож ровно на это.
      expect(casesHtml).toContain('data-case-dialogue');
      expect(casesHtml).toMatch(/IntersectionObserver[\s\S]*data-case-dialogue/);
    });
  });
});
