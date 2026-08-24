import { describe, expect, it } from 'vitest';
import { compactReadableHtml } from './compactReadableHtml';

describe('compactReadableHtml', () => {
  it('снимает индентацию и пустые строки, сохраняя переносы блоков', () => {
    const source = '<main>\n\n  <section>\n    <p>Текст</p>\n  </section>\n</main>\n';
    expect(compactReadableHtml(source)).toBe(
      '<main>\n<section>\n<p>Текст</p>\n</section>\n</main>\n',
    );
  });

  it('не меняет пробелы внутри whitespace-sensitive элементов', () => {
    expect(compactReadableHtml('<script>\n  let x = 1;\n</script>'))
      .toBe('<script>\n  let x = 1;\n</script>');
    expect(compactReadableHtml('  <pre>\n    текст\n  </pre>'))
      .toBe('<pre>\n    текст\n  </pre>');
  });
});
