// 구형 한글 문서(HWP 5.x, .hwp) 파서: OLE 복합 문서 안의 BodyText/Section* 레코드에서 표를 2차원 배열로 뽑는다.
// HWPX 파서(hwpx.ts)와 같은 ParsedDocument를 돌려주므로 추출·점검 코드는 그대로 쓴다.
// 참고: 한글과컴퓨터 「한글 문서 파일 형식 5.0」 공개 문서. 배포용(암호화) 문서는 읽지 못한다.
import * as CFB from 'cfb';
import { inflateSync } from 'fflate';
import type { DocKind, ParsedDocument, ParsedTable, Span } from './types';

const TAG = { PARA_HEADER: 66, PARA_TEXT: 67, CTRL_HEADER: 71, LIST_HEADER: 72, TABLE: 77 };
type Rec = { tag: number; level: number; data: Uint8Array };

function records(buf: Uint8Array): Rec[] {
  const out: Rec[] = [];
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let p = 0;
  while (p + 4 <= buf.length) {
    const h = dv.getUint32(p, true);
    p += 4;
    let size = h >>> 20;
    if (size === 0xfff) {
      size = dv.getUint32(p, true);
      p += 4;
    }
    out.push({ tag: h & 0x3ff, level: (h >>> 10) & 0x3ff, data: buf.subarray(p, p + size) });
    p += size;
  }
  return out;
}

/** PARA_TEXT(UTF-16LE) → 글자. 확장·인라인 컨트롤은 8글자 폭이라 건너뛴다. */
function paraText(d: Uint8Array): string {
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  let s = '';
  for (let i = 0; i + 1 < d.length; ) {
    const c = dv.getUint16(i, true);
    if (c < 32) {
      if (c === 10) s += '\n';
      else if (c === 9) s += '\t';
      if ((c >= 1 && c <= 9) || c === 11 || c === 12 || (c >= 14 && c <= 23)) i += 16;
      else i += 2;
      continue;
    }
    s += String.fromCharCode(c);
    i += 2;
  }
  return s;
}

// 브라우저에서 cfb는 스트림 내용을 일반 배열로 줄 때가 있다
const bytes = (c: unknown) => (c instanceof Uint8Array ? c : Uint8Array.from(c as ArrayLike<number>));

const ctrlId = (d: Uint8Array) => String.fromCharCode(d[3], d[2], d[1], d[0]);

type Para = { text: string; tables: { rows: string[][]; spans: Span[] }[] };

function readPara(rs: Rec[], i: number): { para: Para; next: number } {
  const L = rs[i].level;
  const para: Para = { text: '', tables: [] };
  let j = i + 1;
  while (j < rs.length && rs[j].level > L) {
    const r = rs[j];
    if (r.tag === TAG.PARA_TEXT && r.level === L + 1) para.text += paraText(r.data);
    if (r.tag === TAG.CTRL_HEADER && r.level === L + 1 && ctrlId(r.data) === 'tbl ') {
      const t = readTable(rs, j);
      para.tables.push(t.table);
      j = t.next;
      continue;
    }
    j++;
  }
  return { para, next: j };
}

function readTable(rs: Rec[], j: number): { table: { rows: string[][]; spans: Span[] }; next: number } {
  const C = rs[j].level;
  let k = j + 1;
  let nRows = 0, nCols = 0;
  const cells: { row: number; col: number; rs: number; cs: number; text: string }[] = [];
  while (k < rs.length && rs[k].level > C) {
    const r = rs[k];
    if (r.tag === TAG.TABLE && r.level === C + 1 && r.data.length >= 8) {
      const dv = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength);
      nRows = dv.getUint16(4, true);
      nCols = dv.getUint16(6, true);
      k++;
      continue;
    }
    if (r.tag === TAG.LIST_HEADER && r.level === C + 1 && r.data.length >= 16) {
      const dv = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength);
      const nParas = dv.getInt16(0, true);
      const cell = { col: dv.getUint16(8, true), row: dv.getUint16(10, true), cs: dv.getUint16(12, true) || 1, rs: dv.getUint16(14, true) || 1, text: '' };
      k++;
      const texts: string[] = [];
      for (let n = 0; n < nParas && k < rs.length; n++) {
        if (rs[k].tag !== TAG.PARA_HEADER) break;
        const p = readPara(rs, k);
        texts.push(p.para.text.trim());
        k = p.next;
      }
      cell.text = texts.filter(Boolean).join('\n');
      cells.push(cell);
      continue;
    }
    k++;
  }
  const rows: string[][] = Array.from({ length: nRows || Math.max(0, ...cells.map((c) => c.row + c.rs)) }, () => []);
  const spans: Span[] = [];
  for (const c of cells) {
    if (!rows[c.row]) rows[c.row] = [];
    rows[c.row][c.col] = c.text;
    if (c.rs > 1 || c.cs > 1) spans.push({ row: c.row, col: c.col, rowSpan: c.rs, colSpan: c.cs });
  }
  const width = Math.max(nCols, ...Array.from(rows, (r) => r?.length ?? 0));
  return { table: { rows: Array.from(rows, (r) => Array.from({ length: width }, (_, i) => r?.[i] ?? '')), spans }, next: k };
}

export function isHwp5(data: ArrayBuffer | Uint8Array): boolean {
  const u = data instanceof Uint8Array ? data : new Uint8Array(data);
  return u[0] === 0xd0 && u[1] === 0xcf && u[2] === 0x11 && u[3] === 0xe0;
}

export function parseHwp5(data: ArrayBuffer | Uint8Array, fileName: string, doc: DocKind): ParsedDocument {
  const u = data instanceof Uint8Array ? data : new Uint8Array(data);
  const cfb = CFB.read(u, { type: 'array' });
  const header = CFB.find(cfb, 'FileHeader');
  if (!header?.content) throw new Error('HWP 파일 머리(FileHeader)를 찾지 못했어요.');
  const hd = bytes(header.content);
  const flags = hd[36] | (hd[37] << 8) | (hd[38] << 16) | (hd[39] << 24);
  const compressed = (flags & 1) === 1;
  if (flags & 2) throw new Error('암호가 걸린 한글 문서는 읽을 수 없어요.');
  if (flags & 4) throw new Error('배포용 한글 문서는 읽을 수 없어요. 한글에서 일반 문서로 저장해 주세요.');
  const sections = cfb.FileIndex.map((e, i) => ({ e, path: cfb.FullPaths[i] }))
    .filter(({ path }) => /BodyText\/Section\d+$/i.test(path))
    .sort((a, b) => Number(a.path.match(/(\d+)$/)![1]) - Number(b.path.match(/(\d+)$/)![1]));
  const tables: ParsedTable[] = [];
  let title = '';
  for (const { e } of sections) {
    const raw = bytes(e.content);
    const body = compressed ? inflateSync(raw) : raw;
    const rs = records(body);
    let lastText = '';
    for (let i = 0; i < rs.length; ) {
      if (rs[i].tag !== TAG.PARA_HEADER || rs[i].level !== 0) { i++; continue; }
      const { para, next } = readPara(rs, i);
      const text = para.text.replace(/\s+/g, ' ').trim();
      if (!title && text && !para.tables.length) title = text;
      for (const t of para.tables) tables.push({ title: text || lastText, rows: t.rows, spans: t.spans });
      if (text) lastText = text;
      i = next;
    }
  }
  return { doc, fileName, title, tables };
}
