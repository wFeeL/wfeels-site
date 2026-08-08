import { describe, it, expect } from 'vitest';
import { buildMeta } from './seo';

const SITE = 'https://wfeels.ru';

describe('buildMeta', () => {
  it('канонический адрес абсолютный и без хвостового слеша', () => {
    const m = buildMeta({ title: 'A', description: 'B', pathname: '/o-mne', site: SITE });
    expect(m.canonical).toBe('https://wfeels.ru/o-mne');
  });

  it('корень получает канонический адрес со слешем', () => {
    const m = buildMeta({ title: 'A', description: 'B', pathname: '/', site: SITE });
    expect(m.canonical).toBe('https://wfeels.ru/');
  });

  it('у двуязычной страницы три альтернативы, включая x-default', () => {
    const m = buildMeta({ title: 'A', description: 'B', pathname: '/o-mne', site: SITE });
    expect(m.alternates).toEqual([
      { hreflang: 'ru', href: 'https://wfeels.ru/o-mne' },
      { hreflang: 'en', href: 'https://wfeels.ru/en/o-mne' },
      { hreflang: 'x-default', href: 'https://wfeels.ru/o-mne' },
    ]);
  });

  it('у одноязычной страницы альтернатив нет', () => {
    const m = buildMeta({ title: 'A', description: 'B', pathname: '/politika', site: SITE });
    expect(m.alternates).toEqual([]);
  });

  it('обычная страница индексируется', () => {
    const m = buildMeta({ title: 'A', description: 'B', pathname: '/', site: SITE });
    expect(m.robots).toBe('index, follow');
  });

  it('закрытая страница не индексируется', () => {
    const m = buildMeta({ title: 'A', description: 'B', pathname: '/politika', site: SITE, noindex: true });
    expect(m.robots).toBe('noindex, nofollow');
  });
});
