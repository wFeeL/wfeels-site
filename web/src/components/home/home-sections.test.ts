import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* Требование плана (задача 5/6/7, «в разметке трёх секций нет ни одной цены и
 * ни одного срока»): числа обязаны приходить из `data/pricing.ts` и
 * `data/terms.ts`, а не быть вписаны буквально в компонент. Проверка
 * `pricing.ts`/`services.ts`/`terms.ts` за внутреннюю целостность отвечает
 * своими тестами; этот файл проверяет обратное — что сами компоненты секций
 * 1–3 не содержат числа-литералы. Читает исходный текст `.astro`-файлов
 * (не `dist/`), поэтому число, случайно вписанное в разметку вместо ссылки на
 * данные, красит этот тест независимо от того, что попадёт в сборку. */

const COMPONENTS = ['Hero.astro', 'Pain.astro', 'Services.astro', 'ServiceCard.astro'];

const RUB = /₽/;
// «N–N дней/дня/недель» — форма срока, использованная в data/terms.ts и
// SERVICES.md. Число одиночное («30 страниц», «одним тегом») не считается —
// это не срок и не цена, а факт про продукт.
const TERM_LIKE = /\d+\s*[–-]\s*\d+\s*(дн|дня|дней|недел)/;

describe('секции 1–3 — числа только из data/, не в разметке', () => {
  for (const file of COMPONENTS) {
    it(`${file}: нет буквального «₽» и буквального срока вида «N–N дней»`, () => {
      const path = fileURLToPath(new URL(`./${file}`, import.meta.url));
      const source = readFileSync(path, 'utf8');
      expect(RUB.test(source), `${file} содержит «₽» буквально в разметке`).toBe(false);
      expect(TERM_LIKE.test(source), `${file} содержит срок буквально в разметке`).toBe(false);
    });
  }
});
