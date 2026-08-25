import { describe, expect, it } from 'vitest';
import { GET } from '../pages/case-galleries.json';

describe('/case-galleries.json', () => {
  it('не предлагает поисковику индексировать сырой транспорт галерей', async () => {
    const response = await GET({} as never) as Response;
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });
});
