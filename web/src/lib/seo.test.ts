import { describe, it, expect } from 'vitest';
import { buildMeta } from './seo';

const SITE = 'https://wfeels.ru';

describe('buildMeta', () => {
  it('канонический адрес абсолютный и без хвостового слеша', () => {
    const m = buildMeta({ title: 'A', description: 'B', pathname: '/about', site: SITE });
    expect(m.canonical).toBe('https://wfeels.ru/about');
  });

  it('корень получает канонический адрес со слешем', () => {
    const m = buildMeta({ title: 'A', description: 'B', pathname: '/', site: SITE });
    expect(m.canonical).toBe('https://wfeels.ru/');
  });

  // До правки владельца 2026-08-21 («убираем переключатель на английский
  // язык страницы... убрать путь /en») здесь стояло обратное ожидание — три
  // альтернативы у главной, включая x-default. `BILINGUAL_PATHS` опустел
  // (`i18n/locales.ts`), `hasTranslation` теперь всегда `false`, и главная
  // альтернатив не несёт — как и любая другая страница.
  it('hreflang не рисуется нигде: BILINGUAL_PATHS пуст', () => {
    const m = buildMeta({ title: 'A', description: 'B', pathname: '/', site: SITE });
    expect(m.alternates).toEqual([]);
  });

  // Страница без английской пары не должна звать поисковик на несуществующий
  // адрес: пока `/en/contact` нет, hreflang в <head> не появляется вовсе.
  it('у страницы без английской пары альтернатив нет', () => {
    const m = buildMeta({ title: 'A', description: 'B', pathname: '/contact', site: SITE });
    expect(m.alternates).toEqual([]);
  });

  it('у одноязычной страницы альтернатив нет', () => {
    const m = buildMeta({ title: 'A', description: 'B', pathname: '/privacy', site: SITE });
    expect(m.alternates).toEqual([]);
  });

  it('обычная страница индексируется', () => {
    const m = buildMeta({ title: 'A', description: 'B', pathname: '/', site: SITE });
    expect(m.robots).toBe('index, follow');
  });

  it('закрытая страница не индексируется', () => {
    const m = buildMeta({ title: 'A', description: 'B', pathname: '/privacy', site: SITE, noindex: true });
    expect(m.robots).toBe('noindex, nofollow');
  });
});
