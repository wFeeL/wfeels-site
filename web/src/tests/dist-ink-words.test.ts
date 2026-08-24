import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { aboutText } from '../data/about';
import { inkWords } from '../lib/inkWords';

describe('dist — Ф-4 пословное проявление', () => {
  for (const [locale, path] of [['ru', 'index.html'], ['en', 'en/index.html']] as const) {
    it(`${locale}: сохраняет текст и оборачивает каждое слово ровно один раз`, () => {
      const html = readFileSync(resolve(process.cwd(), 'dist', path), 'utf8');
      const found = /<p class="closing ink"[^>]*>([\s\S]*?)<\/p>/.exec(html);
      expect(found).not.toBeNull();
      const inner = found![1];
      const text = aboutText(locale).closing;
      expect(inner.replace(/<[^>]+>/g, '')).toBe(text);
      expect([...inner.matchAll(/<i>([\s\S]*?)<\/i>/g)].map((m) => m[1]))
        .toEqual(inkWords(text));
      expect((html.match(/<p class="[^"]*\bink\b/g) ?? []).length).toBe(1);
    });
  }
});
