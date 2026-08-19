import { describe, it, expect } from 'vitest';
import { splitBrandText, stripBrandMarkers, brandTextSegments } from './brandMarkers';

describe('brandMarkers — разбор мест под фирменные значки', () => {
  it('текст вокруг маркера сохраняется дословно, вместе с пробелом после него', () => {
    expect(splitBrandText('в {figma} Figma')).toEqual([
      { kind: 'text', value: 'в ' },
      { kind: 'mark', name: 'figma' },
      { kind: 'text', value: ' Figma' },
    ]);
  });

  it('строка без маркеров остаётся одним куском текста', () => {
    expect(splitBrandText('обычное предложение')).toEqual([
      { kind: 'text', value: 'обычное предложение' },
    ]);
  });

  it('снятие маркера убирает и один пробел за ним — двойного пробела не остаётся', () => {
    expect(stripBrandMarkers('при помощи {claude} Claude Code')).toBe(
      'при помощи Claude Code',
    );
  });

  // Опечатка в имени значка обязана ронять сборку, а не проезжать на страницу
  // фигурными скобками: `{clude}` в тексте владельца прочитался бы как
  // выпавший значок только глазами, и только на живом сайте.
  it('неизвестный маркер — ошибка, а не текст на странице', () => {
    expect(() => splitBrandText('при помощи {clude} Claude')).toThrow(/clude/);
    expect(() => stripBrandMarkers('при помощи {clude} Claude')).toThrow(/clude/);
  });

  it('текстовые куски отдаются без пустых — по ним ищется текст в собранной странице', () => {
    expect(brandTextSegments('{claude} Claude и {figma} Figma')).toEqual([
      ' Claude и ',
      ' Figma',
    ]);
  });
});
