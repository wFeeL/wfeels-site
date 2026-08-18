import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  FLOW_SOURCES,
  DELIVERY_CHANNELS,
  FLOW_RETRY_LABEL,
  DIALOGUE_FIELD_LABEL,
  DIALOGUE_LINES,
  DIALOGUE_INPUT_PLACEHOLDER,
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

    it('только ортогональные команды пути: нет C/S/Q/T', () => {
      const pathData = [...flowSvgs.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
      expect(pathData.length).toBeGreaterThan(0);
      for (const d of pathData) {
        expect(d, d).not.toMatch(/[CSQT]/);
      }
    });
  });

  describe('«Пример диалога» (ИИ-консультант)', () => {
    it('метка поля — дословно, безымянный салон', () => {
      expect(casesHtml).toContain(DIALOGUE_FIELD_LABEL);
    });

    it('все четыре реплики присутствуют дословно, по порядку', () => {
      let cursor = -1;
      for (const line of DIALOGUE_LINES) {
        const idx = casesHtml.indexOf(line.text, cursor + 1);
        expect(idx, `реплика «${line.text}» не найдена по порядку`).toBeGreaterThan(cursor);
        cursor = idx;
      }
    });

    it('чип источника — дословно, у первой реплики бота', () => {
      const withSource = DIALOGUE_LINES.find((l) => l.source);
      expect(withSource).toBeDefined();
      expect(casesHtml).toContain(`ИСТОЧНИК: ${withSource!.source}`);
    });

    it('в репликах диалога нет ни одной цифры и нет ₽', () => {
      for (const line of DIALOGUE_LINES) {
        expect(/[0-9₽]/.test(line.text)).toBe(false);
      }
    });

    it('ни слова «клиент», «заказчик», «для компании» — правило действует и на выдуманный салон', () => {
      const start = casesHtml.indexOf('id="dialogue-field-label"');
      const end = casesHtml.indexOf('</ol>', start);
      const dialogueHtml = casesHtml.slice(start, end);
      expect(/клиент(?!ск)|заказчик|для компании/i.test(dialogueHtml)).toBe(false);
    });

    it('диалог читается как настоящий текст — список <ol> из четырёх <li>', () => {
      const start = casesHtml.indexOf('<ol');
      const end = casesHtml.indexOf('</ol>', start);
      const ol = casesHtml.slice(start, end);
      expect((ol.match(/<li/g) || []).length).toBe(4);
      expect(ol).not.toContain('aria-hidden');
      expect(ol).not.toContain('role="img"');
    });

    it('подсказка строки ввода присутствует дословно (бриф 04, раздел 4.6/13.8)', () => {
      expect(casesHtml).toContain(DIALOGUE_INPUT_PLACEHOLDER);
    });

    it('строка ввода — рисунок, не форма: `aria-hidden`, вне таб-порядка', () => {
      const idx = casesHtml.indexOf(DIALOGUE_INPUT_PLACEHOLDER);
      expect(idx).toBeGreaterThan(-1);
      // Ближайший открывающий div перед подсказкой — контейнер строки ввода.
      const before = casesHtml.slice(Math.max(0, idx - 400), idx);
      const divStart = before.lastIndexOf('<div class="input"');
      expect(divStart, 'контейнер строки ввода не найден перед подсказкой').toBeGreaterThan(-1);
      const inputTag = before.slice(divStart);
      expect(inputTag).toContain('aria-hidden="true"');
      expect(inputTag).not.toContain('tabindex');
    });
  });
});
