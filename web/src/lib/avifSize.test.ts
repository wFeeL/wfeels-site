import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { avifSize } from './avifSize';

/** Контрольные числа сверены `2026-08-30` командой `sips -g pixelWidth -g
 *  pixelHeight` (macOS) на всех 26 файлах `public/cases/**\/*.avif` — здесь
 *  оставлена репрезентативная выборка: два файла кейса `ai-consultant`
 *  (ровно те, что назвал владелец как расходящиеся с прежним резервированием
 *  `CaseGallery.astro`, ловушка 42), один ландшафтный и один портретный из
 *  других галерей. Полное совпадение по всем 26 — основание доверять
 *  парсеру, не повторять сверку в каждом тесте. */
const PUBLIC = fileURLToPath(new URL('../../public/', import.meta.url));

describe('lib/avifSize — размеры AVIF читаются из самого файла (ловушка 42)', () => {
  it('admin-knowledge-base.avif — обрезанный кадр 1586×480, не умолчание 1586×992', () => {
    expect(avifSize(`${PUBLIC}cases/ai-consultant/admin-knowledge-base.avif`))
      .toEqual({ width: 1586, height: 480 });
  });

  it('widget-answer.avif — 1000×1250, не умолчание 780×1688', () => {
    expect(avifSize(`${PUBLIC}cases/ai-consultant/widget-answer.avif`))
      .toEqual({ width: 1000, height: 1250 });
  });

  it('websites/relayos/01-home.avif — ландшафт 1586×992', () => {
    expect(avifSize(`${PUBLIC}cases/websites/relayos/01-home.avif`))
      .toEqual({ width: 1586, height: 992 });
  });

  it('storefront/yasmina-home.avif — портрет 780×1688', () => {
    expect(avifSize(`${PUBLIC}cases/storefront/yasmina-home.avif`))
      .toEqual({ width: 780, height: 1688 });
  });

  it('файл без AVIF/HEIF-коробок кидает явную ошибку, а не {0,0}', () => {
    expect(() => avifSize(`${PUBLIC}favicon.svg`)).toThrow(/avifSize\.ts/);
  });
});
