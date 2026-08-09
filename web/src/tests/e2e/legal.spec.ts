import { test, expect } from '@playwright/test';

const PAGES = ['/politika', '/oferta', '/soglasie'];

for (const path of PAGES) {
  test(`${path} отдаётся и закрыт от индексации`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]'))
      .toHaveAttribute('content', 'noindex, nofollow');
  });

  test(`${path} честно помечен как черновик`, async ({ page }) => {
    await page.goto(path);
    const notice = page.locator('[data-draft-notice]');

    // `toBeVisible()` ловит `display: none` и `visibility: hidden`, но не увод
    // за край экрана: у такого элемента ненулевой прямоугольник, и Playwright
    // считает его видимым. Проверено мутацией — `position: absolute;
    // left: -9999px` в блоке <style> страницы оставлял тест зелёным, а пометку
    // невидимой. Приём не выдуманный: ровно им в этом же репозитории убран
    // skip-link (Base.astro, правило `.skip`), то есть погасить пометку можно
    // штатной идиомой проекта. Поэтому рядом стоит требование быть в окне.
    await expect(notice).toBeVisible();
    await expect(notice).toBeInViewport();

    // Существования пометки мало: смысл в конкретных словах. Документ обязан
    // говорить, что он НЕ ДЕЙСТВУЕТ, — без этой формулировки страница снова
    // начинает выдавать заготовку за действующий документ.
    await expect(notice).toContainText('не действует');
  });
}
