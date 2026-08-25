import { describe, it, expect } from 'vitest';
import { serviceHref } from './serviceHref';

describe('lib/serviceHref', () => {
  it('находит адрес посадочной по значку группы и дословному тексту ссылки', () => {
    expect(serviceHref('sites', 'Сайт под ключ')).toBe('/services/website');
    expect(serviceHref('sites', 'Аудит сайта')).toBe('/services/website-audit');
    expect(serviceHref('automation', 'Прием заявок и интеграции')).toBe('/services/integrations');
    expect(serviceHref('ai', 'ИИ-консультант по материалам')).toBe('/services/ai-consultant');
    expect(serviceHref('telegram', 'Telegram-бот под задачу')).toBe('/services/telegram-bot');
  });

  it('кидает явную ошибку, если ссылка переименована или пропала', () => {
    expect(() => serviceHref('sites', 'Такой ссылки не существует')).toThrow(/serviceHref/);
  });
});
