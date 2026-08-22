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

  /* Главная — единственная двуязычная пара сайта, и в её `<head>` стоят три
     альтернативы: обе версии и `x-default` на русскую (спека
     `01-foundation.md`, раздел 7). С 2026-08-21 по 2026-08-22 здесь стояло
     обратное ожидание — тогда `BILINGUAL_PATHS` был пуст и английской
     главной не существовало.

     `x-default` указывает на РУССКУЮ версию, а не на английскую: это язык
     основного рынка, и посетителю, чей язык поисковик определить не смог,
     показывается он. */
  it('главная несёт обе версии и x-default на русскую', () => {
    const m = buildMeta({ title: 'A', description: 'B', pathname: '/', site: SITE });
    expect(m.alternates).toEqual([
      { hreflang: 'ru', href: 'https://wfeels.ru/' },
      { hreflang: 'en', href: 'https://wfeels.ru/en' },
      { hreflang: 'x-default', href: 'https://wfeels.ru/' },
    ]);
  });

  // Английская главная объявляет ту же пару и тот же `x-default` — набор
  // альтернатив у двух версий одной страницы обязан совпадать, иначе
  // поисковик получает два разных утверждения об одном и том же.
  it('английская главная объявляет ту же пару', () => {
    const ru = buildMeta({ title: 'A', description: 'B', pathname: '/', site: SITE });
    const en = buildMeta({ title: 'A', description: 'B', pathname: '/en', site: SITE });
    expect(en.alternates).toEqual(ru.alternates);
    expect(en.canonical).toBe('https://wfeels.ru/en');
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
