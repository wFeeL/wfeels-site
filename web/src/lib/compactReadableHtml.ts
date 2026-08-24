import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/** Убирает цену отступов в готовом HTML, но сохраняет переносы строк.
 * Документ остаётся разбитым на читаемые блоки и не возвращается к одной
 * длинной строке, от которой проект отказался через `compressHTML: false`. */
export function compactReadableHtml(html: string): string {
  const trailingNewline = html.endsWith('\n');
  const lines: string[] = [];
  let rawTag: string | null = null;
  for (const line of html.split('\n')) {
    if (rawTag !== null) {
      /* Внутри этих тегов начальные пробелы могут быть данными: в <pre> и
       <textarea> — видимым текстом, в скрипте — частью шаблонной строки. */
      lines.push(line);
      if (new RegExp(`</${rawTag}>`, 'i').test(line)) rawTag = null;
      continue;
    }

    const trimmed = line.trimStart();
    if (trimmed.length === 0) continue;
    lines.push(trimmed);

    const opening = /<(pre|textarea|script|style)\b/i.exec(trimmed);
    if (opening && !new RegExp(`</${opening[1]}>`, 'i').test(trimmed.slice(opening.index))) {
      rawTag = opening[1];
    }
  }
  const compact = lines.join('\n');
  return compact + (trailingNewline ? '\n' : '');
}

async function htmlFiles(dir: URL): Promise<URL[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) return htmlFiles(url);
    return entry.name.endsWith('.html') ? [url] : [];
  }));
  return files.flat();
}

/** Производственный постпроцессор: Astro сохраняет удобные переносы строк,
 * а служебная индентация не расходует жёсткий сырой бюджет страницы. */
export function compactReadableHtmlIntegration(): AstroIntegration {
  return {
    name: 'compact-readable-html',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        for (const file of await htmlFiles(dir)) {
          const html = await readFile(file, 'utf8');
          await writeFile(fileURLToPath(file), compactReadableHtml(html));
        }
      },
    },
  };
}
