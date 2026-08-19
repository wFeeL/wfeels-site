// Разметка мест под фирменные значки внутри обычного предложения.
//
// Зачем отдельный механизм, а не готовая разбивка текста на куски в
// `data/about.ts`: тексты секции 9 владелец пишет и правит целыми
// предложениями, и они обязаны лежать в данных ОДНИМ читаемым литералом —
// чтобы строку можно было глазами сверить с сообщением владельца, не
// собирая её мысленно из массива. Значок при этом стоит внутри фразы, а не
// перед ней, поэтому его место обозначено маркером `{claude}` прямо в
// строке, а разбор живёт здесь.
//
// Неизвестный маркер роняет СБОРКУ, а не тихо остаётся на странице фигурными
// скобками: опечатка в имени значка обязана обнаружиться до публикации.

export const BRAND_MARKERS = ['claude', 'figma', 'chatgpt'] as const;

export type BrandMarkerName = (typeof BRAND_MARKERS)[number];

export type BrandTextPart =
  | { kind: 'text'; value: string }
  | { kind: 'mark'; name: BrandMarkerName };

/** Любая пара фигурных скобок со словом внутри — кандидат в маркер. Шаблон
 *  намеренно ШИРЕ списка известных имён: `{clude}` должен попасть в разбор и
 *  упасть с понятной ошибкой, а не проехать в разметку как обычный текст. */
const MARKER_RE = /\{([a-zA-Z-]+)\}/g;

function assertKnown(name: string): BrandMarkerName {
  if (!(BRAND_MARKERS as readonly string[]).includes(name)) {
    throw new Error(
      `lib/brandMarkers: неизвестный маркер значка «{${name}}». ` +
      `Известные: ${BRAND_MARKERS.map((m) => `{${m}}`).join(', ')}.`,
    );
  }
  return name as BrandMarkerName;
}

/** Разбирает предложение на куски текста и места под значки, СОХРАНЯЯ текст
 *  дословно — пробел после маркера остаётся в тексте и уезжает на страницу
 *  вместе с ним, поэтому значок и следующее за ним слово не слипаются. */
export function splitBrandText(text: string): BrandTextPart[] {
  const parts: BrandTextPart[] = [];
  let last = 0;

  for (const m of text.matchAll(MARKER_RE)) {
    const name = assertKnown(m[1]);
    if (m.index > last) parts.push({ kind: 'text', value: text.slice(last, m.index) });
    parts.push({ kind: 'mark', name });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });

  return parts;
}

/** Та же строка без маркеров — ровно то предложение, которое человек видит
 *  на странице, если мысленно убрать значки. Вместе с маркером снимается
 *  ОДИН следующий пробел: `{claude} Claude Code` без него дал бы двойной
 *  пробел, которого в утверждённом тексте нет. На это опирается сторож в
 *  `data/about.test.ts` — он сверяет результат с утверждённым предложением
 *  посимвольно. */
export function stripBrandMarkers(text: string): string {
  return text.replace(new RegExp(`${MARKER_RE.source} ?`, 'g'), (_full, name: string) => {
    assertKnown(name);
    return '';
  });
}

/** Только текстовые куски, без пустых, — для проверки собранной страницы:
 *  целиком строку с маркерами в `dist/index.html` не найти, значок разрывает
 *  её на части, и искать надо каждую часть. */
export function brandTextSegments(text: string): string[] {
  return splitBrandText(text)
    .filter((p): p is { kind: 'text'; value: string } => p.kind === 'text')
    .map((p) => p.value)
    .filter((v) => v.trim() !== '');
}
