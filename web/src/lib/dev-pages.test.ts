import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { devPagesEnabled } from './dev-pages';

describe('devPagesEnabled', () => {
  // Витрина компонентов нужна при разработке и не нужна на боевой раздаче.
  // Раньше её закрывал только `noindex` и правило в Caddy: та же сборка,
  // выложенная на любую другую раздачу, показала бы служебную страницу наружу.
  it('в режиме разработки витрина есть всегда', () => {
    expect(devPagesEnabled('dev', {})).toBe(true);
  });

  it('в обычной сборке витрины нет', () => {
    expect(devPagesEnabled('build', {})).toBe(false);
    expect(devPagesEnabled('build', { DEV_PAGES: '' })).toBe(false);
    expect(devPagesEnabled('build', { DEV_PAGES: '0' })).toBe(false);
  });

  // Прогон e2e собирает сайт и открывает его через preview: там витрина нужна —
  // на ней стоят проверки примитивов и полосы прогресса. Флаг ставит
  // playwright.config.ts, боевая сборка его не ставит.
  it('сборка под тесты включает витрину явным флагом', () => {
    expect(devPagesEnabled('build', { DEV_PAGES: '1' })).toBe(true);
    expect(devPagesEnabled('preview', { DEV_PAGES: '1' })).toBe(true);
  });
});

describe('место витрины в дереве', () => {
  // Условие выше значит что-то только пока витрина лежит ВНЕ `src/pages`: всё,
  // что лежит там, Astro делает страницей безусловно, и никакой флаг её оттуда
  // не уберёт. Это и есть путь, которым дефект вернулся бы — файл, положенный
  // «куда все». Прогон e2e собирает сайт с флагом и потому увидеть этого не
  // может: там витрина обязана быть.
  it('витрина живёт вне маршрутов, иначе флаг ни на что не влияет', () => {
    expect(existsSync(new URL('../pages/dev', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../dev/ui.astro', import.meta.url))).toBe(true);
  });
});
