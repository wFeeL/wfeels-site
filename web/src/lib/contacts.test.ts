import { describe, it, expect } from 'vitest';
import { TELEGRAM_URL, telegramHandle } from './contacts';

describe('telegramHandle', () => {
  it('выводится из TELEGRAM_URL, а не хранится второй строкой', () => {
    expect(telegramHandle()).toBe('@wfeels');
    expect(TELEGRAM_URL).toBe(`https://t.me/${telegramHandle().slice(1)}`);
  });
});
