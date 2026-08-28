import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** ПЕРЕИМЕНОВАН из `lineBranch.weight.test.ts` `2026-08-28`: первый блок
 *  файла (сторож П-Я1, «два веса нити») проверял CSS-правило `.line-branch`,
 *  которое в этот же день снято целиком (`BackgroundLine.astro`) — прямое
 *  указание владельца, последний оставшийся отвод (`cases`) читался на
 *  снимке как случайная линейка. Предмет исчез — блок удалён вместе с ним,
 *  а не помечен `skip` (тот же приём, каким уже снят сторож проявления).
 *  Второй блок файла, про `.num::after` секции «Как я работаю», отвода не
 *  касается — своего предмета не терял, оставлен без изменений и дал файлу
 *  новое имя. */

/** ПРАВКА `2026-08-27` (`70-workshop/specs/site-v3/16-line-digits-and-
 *  finale-brief.md`, раздел 2.6): «Судьба `.num::after` — решена явно».
 *  Плашка-подчёркивание (2px CSS-фон, `var(--accent)` в чистую
 *  непрозрачность) НЕ возвращается ни в каком виде — это по-прежнему
 *  проверяется здесь. Но `.num::after` САМ возвращается — с другой
 *  работой: слоем зажигания цифры (дубликат глифа, `opacity` 0→1,
 *  `steps(1, jump-end)`, раздел 2.2 брифа `16-…`). Это не тот же
 *  инструмент в той же роли, а тот же селектор в новой — третьего
 *  инструмента на странице не появляется, поэтому предыдущая
 *  формулировка «`.num::after` отсутствует» заменяется на «`.num::after`,
 *  если есть, не несёт признаков старой плашки». */
describe('раздел 2.6 брифа `16-…`: `.num::after` — если есть, несёт зажигание, а не старую плашку', () => {
  const PROCESS_ASTRO = readFileSync(new URL('../components/home/Process.astro', import.meta.url), 'utf8');

  it('в исходнике нет ключевого кадра `process-num-underline`, оставшегося от снятой плашки', () => {
    expect(PROCESS_ASTRO.includes('process-num-underline')).toBe(false);
  });

  it('`.num::after`, если объявлен, не несёт `background` / `background-color` (признак плоской плашки)', () => {
    const match = /\.num::after\s*\{([^}]*)\}/s.exec(PROCESS_ASTRO);
    if (!match) return; // предмета нет — проверять нечего, тест проходит пусто
    expect(/\bbackground(-color)?\s*:/.test(match[1]), '`.num::after` несёт background — это и есть снятая плашка').toBe(false);
  });

  it('`.num::after`, если объявлен, анимирует `opacity`, не `color`/`background-color` (D-133 — некомпозитная перекраска)', () => {
    const match = /\.num::after\s*\{([^}]*)\}/s.exec(PROCESS_ASTRO);
    if (!match) return;
    expect(match[1], '`.num::after` обязан объявлять opacity: 0 в базовом состоянии слоя').toMatch(/opacity\s*:\s*0\b/);
  });

  it('в блоке `@keyframes`, управляющем `.num::after`, анимируется только `opacity`', () => {
    const kf = /@keyframes\s+num-ignite\s*\{([^]*?)\n\}/.exec(PROCESS_ASTRO);
    if (!kf) return; // предмета нет — проверять нечего
    expect(/\b(color|background-color)\s*:/.test(kf[1]), '@keyframes num-ignite анимирует color/background-color — запрещено D-133').toBe(false);
    expect(kf[1]).toMatch(/opacity\s*:/);
  });
});
