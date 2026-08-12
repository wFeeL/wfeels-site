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
 * Задача 15 выполнена 2026-08-12: подставлены 365 КБ и «семь раз», измеренные
 * `npm run check:budget` на финальной сборке. `.skip` снят.
 *
 * Сам гейт бюджета с этого же дня сверяет утверждение страницы с фактическим
 * весом и падает при расхождении больше 5% — то есть соврать про вес нельзя
 * уже не по дисциплине, а механически. Этот тест остаётся вторым рубежом: он
 * ловит именно НЕподставленную заглушку, а гейт — устаревшее число. */
const DIST_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));

describe('dist/index.html — заглушки секции 6 не утекли в боевую сборку', () => {
  it(
    'заглушки [вес] и [кратность] подставлены числами',
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
