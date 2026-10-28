// Word(.docx) 칸 고치기: hwpx-patch와 같은 방식. 원본 zip을 그대로 두고 word/document.xml의
// 지정한 표 칸 안 w:t 글자만 바꾼다. 서식(w:rPr)과 구조는 건드리지 않는다.
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { locate, originalCompression, paraOf, replaceRange, serialize, type CellEdit, type PatchResult, type XDoc, type XNode } from './hwpx-patch';
import { docxCells, docxTables } from './office';

type El = Parameters<typeof docxCells>[0];

const kids = (e: XNode, name?: string): XNode[] =>
  Array.from(e.childNodes).filter((n) => n.nodeType === 1 && (!name || n.localName === name));

function* paras(e: XNode): Generator<XNode> {
  for (const k of kids(e)) {
    if (k.localName === 'p') yield k;
    else if (k.localName === 'sdt') yield* paras(kids(k, 'sdtContent')[0] ?? k);
    else if (k.localName === 'customXml' || k.localName === 'smartTag') yield* paras(k);
  }
}

export async function patchDocx(data: ArrayBuffer | Uint8Array, edits: CellEdit[]): Promise<PatchResult> {
  const zip = await JSZip.loadAsync(data);
  const name = 'word/document.xml';
  const xml = await zip.file(name)!.async('string');
  const doc = new DOMParser().parseFromString(xml, 'text/xml') as unknown as XDoc;
  const body = kids(doc.documentElement, 'body')[0];
  const tables = docxTables(body as unknown as El);
  const maps: (Map<string, XNode> | undefined)[] = [];
  const applied: CellEdit[] = [];
  const skipped: { edit: CellEdit; reason: string }[] = [];
  for (const edit of edits) {
    const t = tables[edit.table];
    if (!t) {
      skipped.push({ edit, reason: `표 ${edit.table}이(가) 없음` });
      continue;
    }
    maps[edit.table] ??= new Map(docxCells(t.tbl).map((c) => [`${c.row},${c.col}`, c.tc as unknown as XNode]));
    const tc = maps[edit.table]!.get(`${edit.row},${edit.col}`);
    if (!tc) {
      skipped.push({ edit, reason: `칸 (${edit.row},${edit.col})이(가) 없음` });
      continue;
    }
    const hit = locate([...paras(tc)].map(paraOf), edit.from);
    if ('reason' in hit) {
      skipped.push({ edit, reason: hit.reason });
      continue;
    }
    replaceRange(hit.para, hit.start, hit.end, edit.to);
    applied.push(edit);
  }
  for (const f of Object.values(zip.files)) {
    const c = originalCompression(f);
    if (c) f.options.compression = c;
  }
  if (applied.length) {
    const old = zip.files[name];
    zip.file(name, serialize(xml, doc), { compression: originalCompression(old) ?? 'DEFLATE', createFolders: false, date: old.date });
  }
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return { bytes, applied, skipped };
}
