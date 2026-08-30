/** Пиксельные размеры AVIF-файла, прочитанные из его собственных байтов —
 *  ловушка 42 (`50-code/CLAUDE.md`): `CaseGallery.astro` резервировал место
 *  под кадр одной вписанной руками парой чисел на всю галерею
 *  (`1586×992`/`780×1688`), и после обрезки одного файла до другой
 *  пропорции (`admin-knowledge-base.avif`, 1586×480) резервирование
 *  разошлось с настоящим файлом — раскладка дёргалась при подгрузке (CLS).
 *  Правило ловушки 15: список кадров и их пропорции обязаны ВЫВОДИТЬСЯ из
 *  источника, а не вписываться руками — иначе следующий добавленный или
 *  обрезанный кадр молча повторит тот же дефект. Эта функция читает
 *  реальные `width`/`height` из файла на диске при каждой сборке, так что
 *  число никогда не может разойтись с файлом: расходиться уже нечему.
 *
 *  AVIF — контейнер ISOBMFF (тот же род коробок, что и MP4/HEIF): размер
 *  первичного изображения лежит в свойстве `ispe` («Image Spatial
 *  Extents»), которое присоединено к ПЕРВИЧНОМУ элементу (`pitm`) через
 *  таблицу связей `ipma`. Файл может нести больше одного изображения
 *  (например, миниатюру для превью) — так что нельзя брать первый попавшийся
 *  `ispe` внутри `ipco`: он может принадлежать не первичному кадру.
 *  Проверено на всех 26 файлах `public/cases/**.avif` сверкой с `sips
 *  -g pixelWidth -g pixelHeight` (macOS) — совпадение полное. */

import { readFileSync } from 'node:fs';

interface Box {
  type: string;
  start: number;
  end: number;
  bodyStart: number;
}

function readBoxes(buf: Buffer, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1) {
      // Коробка шире 4 ГБ несёт 64-битный размер сразу после заголовка —
      // ни один файл сайта в такой размер не попадёт, но парсер не должен
      // молча читать мусор, если однажды попадёт.
      const high = buf.readUInt32BE(offset + 8);
      const low = buf.readUInt32BE(offset + 12);
      size = high * 2 ** 32 + low;
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize) break;
    boxes.push({ type, start: offset, end: offset + size, bodyStart: offset + headerSize });
    offset += size;
  }
  return boxes;
}

function findBox(boxes: Box[], type: string): Box | undefined {
  return boxes.find((b) => b.type === type);
}

/** Читает `width`/`height` первичного изображения AVIF-файла по пути
 *  `absPath` (абсолютный путь на диске). Кидает явную ошибку, если файл не
 *  AVIF/HEIF-контейнер ожидаемой формы — молчаливое `{width:0,height:0}`
 *  было бы хуже красной сборки (тот же довод, что уже несёт
 *  `lib/serviceHref.ts`). */
export function avifSize(absPath: string): { width: number; height: number } {
  const buf = readFileSync(absPath);
  const top = readBoxes(buf, 0, buf.length);
  const meta = findBox(top, 'meta');
  if (!meta) throw new Error(`lib/avifSize.ts: в «${absPath}» нет коробки meta — не AVIF/HEIF.`);
  // `meta` — FullBox: первые 4 байта тела — версия/флаги, дети начинаются после них.
  const metaChildren = readBoxes(buf, meta.bodyStart + 4, meta.end);

  const pitmBox = findBox(metaChildren, 'pitm');
  if (!pitmBox) throw new Error(`lib/avifSize.ts: в «${absPath}» нет коробки pitm (первичный элемент).`);
  const pitmVersion = buf.readUInt8(pitmBox.bodyStart);
  const primaryItemId = pitmVersion === 0
    ? buf.readUInt16BE(pitmBox.bodyStart + 4)
    : buf.readUInt32BE(pitmBox.bodyStart + 4);

  const iprp = findBox(metaChildren, 'iprp');
  if (!iprp) throw new Error(`lib/avifSize.ts: в «${absPath}» нет коробки iprp (свойства элементов).`);
  const iprpChildren = readBoxes(buf, iprp.bodyStart, iprp.end);
  const ipco = findBox(iprpChildren, 'ipco');
  const ipma = findBox(iprpChildren, 'ipma');
  if (!ipco || !ipma) throw new Error(`lib/avifSize.ts: в «${absPath}» нет ipco/ipma внутри iprp.`);
  const ipcoChildren = readBoxes(buf, ipco.bodyStart, ipco.end);

  // `ipma` — FullBox: связывает item_ID со списком индексов свойств в `ipco`
  // (индексация с единицы). Флаг младшего бита решает, 1 или 2 байта несёт
  // каждый индекс.
  const ipmaVersion = buf.readUInt8(ipma.bodyStart);
  const ipmaFlags = buf.readUIntBE(ipma.bodyStart + 1, 3);
  let p = ipma.bodyStart + 4;
  const entryCount = buf.readUInt32BE(p);
  p += 4;
  let primaryPropertyIndices: number[] | undefined;
  for (let i = 0; i < entryCount; i += 1) {
    let itemId: number;
    if (ipmaVersion < 1) {
      itemId = buf.readUInt16BE(p);
      p += 2;
    } else {
      itemId = buf.readUInt32BE(p);
      p += 4;
    }
    const assocCount = buf.readUInt8(p);
    p += 1;
    const indices: number[] = [];
    for (let a = 0; a < assocCount; a += 1) {
      if (ipmaFlags & 1) {
        const v = buf.readUInt16BE(p);
        p += 2;
        indices.push(v & 0x7fff);
      } else {
        const v = buf.readUInt8(p);
        p += 1;
        indices.push(v & 0x7f);
      }
    }
    if (itemId === primaryItemId) primaryPropertyIndices = indices;
  }
  if (!primaryPropertyIndices) {
    throw new Error(`lib/avifSize.ts: в «${absPath}» ipma не несёт записи для первичного элемента.`);
  }

  let ispeBox: Box | undefined;
  for (const idx of primaryPropertyIndices) {
    const candidate = ipcoChildren[idx - 1]; // индекс в ipma — с единицы
    if (candidate && candidate.type === 'ispe') {
      ispeBox = candidate;
      break;
    }
  }
  if (!ispeBox) {
    throw new Error(`lib/avifSize.ts: в «${absPath}» у первичного элемента нет свойства ispe.`);
  }
  // `ispe` — FullBox: 4 байта версии/флагов, затем width/height (uint32 BE).
  const width = buf.readUInt32BE(ispeBox.bodyStart + 4);
  const height = buf.readUInt32BE(ispeBox.bodyStart + 8);
  return { width, height };
}
