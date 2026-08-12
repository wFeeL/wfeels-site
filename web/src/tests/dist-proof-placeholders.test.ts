import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WEIGHT_PLACEHOLDER, MULTIPLIER_PLACEHOLDER } from '../data/proof';

/* Заглушки `[вес]` и `[кратность]` секции 6 (`data/proof.ts`) подставляются
 * последним шагом плана `02-home-plan.md` — задача 15 «Приёмка», когда все
 * одиннадцать секций уже на месте и `npm run check:budget` меряет
 * окончательную сборку (02-texts.md, секция 6, «Что здесь нельзя менять при
 * правке»: кратность выведена из веса и подставляется только вместе с ним).
 *
 * До этого момента заглушки ОБЯЗАНЫ быть на странице — их отсутствие сейчас
 * значило бы, что кто-то вписал число раньше времени. Поэтому набор красный
 * намеренно: подставлять их сейчас, до задачи 15, запрещено самой задачей
 * 10 этого плана. Снять `.skip`, когда задача 15 подставит оба числа. */
const DIST_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));

describe('dist/index.html — заглушки секции 6 не утекли в боевую сборку', () => {
  it.skip(
    'заглушки [вес] и [кратность] подставлены числами — включить в задаче 15 плана ' +
    '02-home-plan.md, после того как check:budget измерит финальную сборку',
    () => {
      if (!existsSync(DIST_INDEX)) {
        throw new Error(`${DIST_INDEX} не найден — сначала \`npm run build\`.`);
      }
      const html = readFileSync(DIST_INDEX, 'utf8');
      expect(html).not.toContain(WEIGHT_PLACEHOLDER);
      expect(html).not.toContain(MULTIPLIER_PLACEHOLDER);
    },
  );
});
