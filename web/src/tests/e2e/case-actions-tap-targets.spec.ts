import { test, expect } from '@playwright/test';
import { publishedCases, caseHref } from '../../data/cases';

/* Сторож целей нажатия в блоке действия внизу страницы кейса
 * (`pages/cases/[slug].astro`, `.case-actions .action-link a`: «Следующий
 * кейс →», «Связанная услуга →», «Все кейсы →»).
 *
 * Найдено дизайн-ревью 2026-08-26 на `/cases/ai-consultant`, 390 px: высота
 * цели — 22 px (порог 44 px), три ссылки — единственный путь дальше со
 * страницы кейса, кроме кнопки «Обсудить задачу». Список страниц выводится
 * из `publishedCases()`, а не вписан руками — тот же приём, что уже применяют
 * `check-budget.mjs` и соседние сторожа (`50-code/CLAUDE.md`, ловушка 15):
 * пятый опубликованный кейс не должен остаться без проверки молча.
 *
 * Приём роста цели — тот же, что уже стоит у `.requisites a` в подвале
 * (`Footer.astro`): `display: inline` + `padding-block` + `box-decoration-
 * break: clone` растит кликабельный бокс ссылки, не растя строчный бокс
 * абзаца, — раскладка не двигается. Зазор между соседними целями несёт `gap`
 * родителя (`.case-actions`), поэтому проверяется отдельно: тот же класс
 * дефекта уже находили у подвала — поле ссылки, растущее НАВСТРЕЧУ соседней
 * цели, схлопывает зазор до нескольких пикселей при формальных 16. */

const CASES_WITH_ACTIONS = publishedCases().map((item) => item.slug);

test('в блоке действия каждая цель нажатия держит 44 px (390 px)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });

  for (const slug of CASES_WITH_ACTIONS) {
    await page.goto(caseHref(slug));
    const links = page.locator('.case-actions .action-link a');
    const count = await links.count();
    expect(count, `${caseHref(slug)}: ссылок в блоке действия`).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const link = links.nth(i);
      const text = (await link.innerText()).trim();
      const box = await link.boundingBox();
      expect(box, `${caseHref(slug)}: ссылка «${text}» не отрисована`).not.toBeNull();
      expect(box!.height, `${caseHref(slug)}: высота цели «${text}»`).toBeGreaterThanOrEqual(44);
    }
  }
});

test('в блоке действия зазор между соседними целями ≥ 16 px (390 px)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });

  for (const slug of CASES_WITH_ACTIONS) {
    await page.goto(caseHref(slug));
    const links = page.locator('.case-actions .action-link a');
    const count = await links.count();

    for (let i = 0; i < count - 1; i += 1) {
      const aBox = await links.nth(i).boundingBox();
      const bBox = await links.nth(i + 1).boundingBox();
      expect(aBox, `${caseHref(slug)}: цель ${i} не отрисована`).not.toBeNull();
      expect(bBox, `${caseHref(slug)}: цель ${i + 1} не отрисована`).not.toBeNull();
      const gap = bBox!.y - (aBox!.y + aBox!.height);
      expect(gap, `${caseHref(slug)}: зазор между целями ${i} и ${i + 1}`).toBeGreaterThanOrEqual(16);
    }
  }
});
