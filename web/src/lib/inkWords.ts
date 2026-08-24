/** Разбивает текст для Ф-4 только по обычным пробелам. Неразрывные пробелы
 * остаются внутри токена, чтобы связанные ими группы не распадались. */
export function inkWords(text: string): string[] {
  if (/\d/.test(text)) {
    throw new Error(
      'lib/inkWords: в тексте есть цифра — пословное проявление не применяется. ' +
        'Цены и числовые группы нельзя переразмечать. Текст: ' + JSON.stringify(text),
    );
  }
  const words = text.split(' ').filter((word) => word !== '');
  if (words.length === 0) {
    throw new Error('lib/inkWords: пустой текст — обёртывать нечего.');
  }
  return words;
}

export function inkWordCount(text: string): number {
  return inkWords(text).length;
}
