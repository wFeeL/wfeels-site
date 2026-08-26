import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* Сторож пяти английских правовых и служебных страниц, построенных 2026-08-26
 * (`/en/privacy`, `/en/consent`, `/en/terms`, `/en/thanks`, `/en/404`).
 *
 * Заведён по следу конкретного риска, а не найденного дефекта: пять файлов
 * появились одним заходом, ссылки на два из них (`/en/consent`, `/en/privacy`)
 * ведёт форма заявки (`LeadForm.astro`) в зависимости от `locale`, а
 * `sitemap.ts` в том же заходе учился их НЕ индексировать. Ничто на сайте
 * само по себе не мешает будущей правке снова заменить условный `href` на
 * жёсткий `/consent` (тот же дефект, что уже ловил мутационный тест в
 * `e2e/links.spec.ts`, только для русской версии) — без сторожа регресс был
 * бы обнаружен только глазами или юристом.
 *
 * Проверяется СБОРКА (`dist/en/**`), тем же приёмом `existsSync`-гейта, что
 * в `dist-links.test.ts` и `dist-home-sections.test.ts`: без `npm run build`
 * тест падает с понятной причиной, а не тихо пропускается. Список адресов
 * здесь короткий и перечислен руками намеренно — это не обход всей сборки
 * (той роли уже служит `dist-links.test.ts`), а точечная проверка ПЯТИ
 * конкретных страниц, которые появились одним заходом и легко пропадут
 * тем же заходом обратно. */

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));

const EN_PAGES: ReadonlyArray<{ path: string; file: string; h1: string }> = [
  { path: '/en/privacy', file: 'en/privacy/index.html', h1: 'Privacy Policy' },
  {
    path: '/en/consent', file: 'en/consent/index.html',
    h1: 'Consent to the Processing of Personal Data',
  },
  { path: '/en/terms', file: 'en/terms/index.html', h1: 'Terms of Service' },
  { path: '/en/thanks', file: 'en/thanks/index.html', h1: 'Your message is on its way' },
  { path: '/en/404', file: 'en/404/index.html', h1: "This page doesn't exist" },
];

const RU_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));
const EN_INDEX = fileURLToPath(new URL('../../dist/en/index.html', import.meta.url));

describe('dist/en/** — пять правовых и служебных страниц на месте', () => {
  it('сборка существует (npm run build перед этим набором)', () => {
    if (!existsSync(DIST)) {
      throw new Error(
        `\nВ ${DIST} нет сборки. Сначала выполни \`npm run build\` в web/, ` +
        'затем повтори `npm run test:unit`.',
      );
    }
    expect(true).toBe(true);
  });

  if (!existsSync(DIST)) return;

  for (const { path, file, h1 } of EN_PAGES) {
    it(`${path} — страница есть в сборке и отдаёт содержимое`, () => {
      const full = `${DIST}${file}`;
      expect(existsSync(full), `нет файла ${file} — страница ${path} пропала из сборки`)
        .toBe(true);
      const html = readFileSync(full, 'utf8');
      expect(html.length, `${path} пуст`).toBeGreaterThan(500);
      expect(html, `${path}: заголовок «${h1}» не найден`).toContain(h1);
      expect(html, `${path}: язык страницы не английский`).toContain('<html lang="en"');
    });
  }

  it('три правовые страницы несут оговорку о приоритете русской редакции', () => {
    for (const { path, file } of EN_PAGES.slice(0, 3)) {
      const html = readFileSync(`${DIST}${file}`, 'utf8');
      expect(html, `${path}: нет оговорки о приоритете (TranslationNotice)`)
        .toMatch(/data-translation-notice/);
      expect(html, `${path}: оговорка не называет русский текст главным`)
        .toMatch(/Russian text controls/);
    }
  });
});

describe('согласие на `/en` ведёт на английский документ, а не на русский', () => {
  it('обе сборки существуют', () => {
    if (!existsSync(RU_INDEX) || !existsSync(EN_INDEX)) {
      throw new Error(
        '\nНет dist/index.html и/или dist/en/index.html. Сначала выполни ' +
        '`npm run build` в web/, затем повтори `npm run test:unit`.',
      );
    }
    expect(true).toBe(true);
  });

  if (!existsSync(RU_INDEX) || !existsSync(EN_INDEX)) return;

  it('на `/en` ссылка согласия ведёт на `/en/consent`, ссылка политики — на `/en/privacy`', () => {
    const en = readFileSync(EN_INDEX, 'utf8');
    expect(en, 'ссылка согласия на /en ведёт не на английский документ')
      .toMatch(/<label\s+for="f-consent"[^>]*>[\s\S]*?<a\s+href="\/en\/consent"/);
    expect(en, 'ссылка политики на /en ведёт не на английский документ')
      .toMatch(/class="privacy-note"[^>]*>[\s\S]*?<a\s+href="\/en\/privacy"/);
    // Отрицательный контроль: ровно тот дефект, который сторож обязан ловить —
    // условный `href` можно молча заменить на жёсткий русский адрес.
    expect(en, 'на /en осталась ссылка на русский /consent')
      .not.toMatch(/<label\s+for="f-consent"[^>]*>[\s\S]*?<a\s+href="\/consent"/);
    expect(en, 'на /en осталась ссылка на русский /privacy')
      .not.toMatch(/class="privacy-note"[^>]*>[\s\S]*?<a\s+href="\/privacy"/);
  });

  it('на русской главной ссылка согласия ведёт на `/consent`, а не на `/en/consent`', () => {
    const ru = readFileSync(RU_INDEX, 'utf8');
    expect(ru).toMatch(/<label\s+for="f-consent"[^>]*>[\s\S]*?<a\s+href="\/consent"/);
    expect(ru).not.toMatch(/<label\s+for="f-consent"[^>]*>[\s\S]*?<a\s+href="\/en\/consent"/);
  });

  it('версии документов в скрытых полях формы совпадают на обоих языках', () => {
    const ru = readFileSync(RU_INDEX, 'utf8');
    const en = readFileSync(EN_INDEX, 'utf8');
    const versionOf = (html: string, name: string): string => {
      const m = new RegExp(
        `<input type="hidden" name="${name}" value="([^"]+)"`,
      ).exec(html);
      if (!m) throw new Error(`поле ${name} не найдено в разметке формы`);
      return m[1];
    };
    expect(versionOf(en, 'consent_version')).toBe(versionOf(ru, 'consent_version'));
    expect(versionOf(en, 'privacy_version')).toBe(versionOf(ru, 'privacy_version'));
  });
});
