// Word(.docx), Excel(.xlsx), 한컴·LibreOffice 등의 개방형 문서(.odt) 읽기.
// 셋 다 zip 안의 XML이라 HWPX와 같은 방식으로 표를 2차원 배열(ParsedDocument)로 바꾼다.
// 병합 규칙은 hwpx.ts와 같다: 병합 시작 칸에만 글자, 가려진 칸은 "", 병합 정보는 spans.
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import type { DocKind, ParsedDocument, ParsedTable, Span } from './types';

type El = {
  localName: string;
  nodeName: string;
  childNodes: ArrayLike<El> & { length: number };
  nodeType: number;
  textContent: string | null;
  getAttribute(n: string): string | null;
};

const kids = (e: El, name?: string): El[] =>
  Array.from(e.childNodes).filter((n) => n.nodeType === 1 && (!name || n.localName === name));

function* walk(e: El, stopAt?: string): Generator<El> {
  for (const k of kids(e)) {
    yield k;
    if (k.localName !== stopAt) yield* walk(k, stopAt);
  }
}

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml').documentElement as unknown as El;

export type OfficeKind = 'docx' | 'xlsx' | 'odt';

/** zip 안의 파일 이름으로 형식을 가린다 (확장자보다 내용이 우선) */
export async function zipKind(data: ArrayBuffer | Uint8Array): Promise<OfficeKind | 'hwpx' | null> {
  const zip = await JSZip.loadAsync(data);
  const names = Object.keys(zip.files);
  if (names.some((n) => /^Contents\/section\d+\.xml$/i.test(n))) return 'hwpx';
  if (zip.file('word/document.xml')) return 'docx';
  if (zip.file('xl/workbook.xml')) return 'xlsx';
  if (zip.file('content.xml')) {
    const mime = (await zip.file('mimetype')?.async('string')) ?? '';
    if (!mime || /opendocument\.text/.test(mime)) return 'odt';
  }
  return null;
}

/** 칸 정보를 받아 (행,열) 격자에 놓는다. 이미 병합으로 덮인 자리는 건너뛴다. */
class Grid {
  rows: string[][] = [];
  spans: Span[] = [];
  private taken = new Set<string>();
  isTaken = (r: number, c: number) => this.taken.has(`${r},${c}`);
  put(row: number, col: number, text: string, rs = 1, cs = 1) {
    for (let r = row; r < row + rs; r++) for (let c = col; c < col + cs; c++) this.taken.add(`${r},${c}`);
    while (this.rows.length <= row + rs - 1) this.rows.push([]);
    this.rows[row][col] = text;
    if (rs > 1 || cs > 1) this.spans.push({ row, col, rowSpan: rs, colSpan: cs });
  }
  table(title: string): ParsedTable {
    const width = Math.max(0, ...this.rows.map((r) => r.length));
    return { title, rows: this.rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? '')), spans: this.spans };
  }
}

// ---------------- Word (.docx) ----------------

/** 문단 글자 (문단 안 표 글자는 뺀다). 탭은 공백, 줄바꿈은 줄바꿈 */
function wParaText(p: El): string {
  let s = '';
  for (const n of walk(p, 'tbl')) {
    if (n.localName === 't') s += n.textContent ?? '';
    else if (n.localName === 'tab') s += ' ';
    else if (n.localName === 'br' || n.localName === 'cr') s += '\n';
  }
  return s.trim();
}

/** sdt(내용 컨트롤)처럼 감싸는 요소를 벗겨 본문 블록(문단·표)만 차례로 */
function* wBlocks(e: El): Generator<El> {
  for (const k of kids(e)) {
    if (k.localName === 'p' || k.localName === 'tbl') yield k;
    else if (k.localName === 'sdt') yield* wBlocks(kids(k, 'sdtContent')[0] ?? k);
    else if (k.localName === 'customXml' || k.localName === 'smartTag') yield* wBlocks(k);
  }
}

const wVal = (e: El | undefined) => e?.getAttribute('w:val') ?? e?.getAttribute('val') ?? null;

/** Word 표 → (행,열) 칸. 가로 병합은 gridSpan, 세로 병합은 vMerge(restart/이어짐) */
export function docxCells(tbl: El): { row: number; col: number; rs: number; cs: number; tc: El }[] {
  const out: { row: number; col: number; rs: number; cs: number; tc: El }[] = [];
  const open = new Map<number, { row: number; col: number; rs: number; cs: number; tc: El }>(); // 열 → 세로 병합 중인 칸
  kids(tbl, 'tr').forEach((tr, ri) => {
    const trPr = kids(tr, 'trPr')[0];
    let col = Number(wVal(trPr && kids(trPr, 'gridBefore')[0]) ?? 0) || 0;
    for (const tc of [...wBlocksTc(tr)]) {
      const pr = kids(tc, 'tcPr')[0];
      const cs = Math.max(1, Number(wVal(pr && kids(pr, 'gridSpan')[0]) ?? 1) || 1);
      const vm = pr && kids(pr, 'vMerge')[0];
      const vmVal = vm ? wVal(vm) ?? 'continue' : null;
      if (vmVal === 'continue' && open.has(col)) {
        open.get(col)!.rs++;
      } else {
        const cell = { row: ri, col, rs: 1, cs, tc };
        out.push(cell);
        if (vmVal === 'restart') open.set(col, cell);
        else open.delete(col);
      }
      col += cs;
    }
  });
  return out;
}

/** 행 안의 칸 (sdt로 감싼 칸 포함) */
function* wBlocksTc(tr: El): Generator<El> {
  for (const k of kids(tr)) {
    if (k.localName === 'tc') yield k;
    else if (k.localName === 'sdt') yield* wBlocksTc(kids(k, 'sdtContent')[0] ?? k);
    else if (k.localName === 'customXml') yield* wBlocksTc(k);
  }
}

const wCellText = (tc: El) => [...wBlocks(tc)].filter((b) => b.localName === 'p').map(wParaText).filter(Boolean).join('\n');

/** 본문 블록 순회: 표마다 직전 문단을 제목으로 */
export function docxTables(body: El): { tbl: El; title: string }[] {
  const out: { tbl: El; title: string }[] = [];
  let last = '';
  for (const b of wBlocks(body)) {
    if (b.localName === 'p') {
      const t = wParaText(b);
      if (t) last = t;
    } else out.push({ tbl: b, title: last });
  }
  return out;
}

export async function parseDocx(data: ArrayBuffer | Uint8Array, fileName: string, doc: DocKind): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('word/document.xml이 없어요');
  const body = kids(parseXml(xml), 'body')[0];
  if (!body) throw new Error('본문이 없어요');
  const tables: ParsedTable[] = [];
  const paragraphs: { before: number; text: string }[] = [];
  let title = '';
  let last = '';
  for (const b of wBlocks(body)) {
    if (b.localName === 'p') {
      const t = wParaText(b);
      if (!t) continue;
      if (!title) title = t;
      paragraphs.push({ before: tables.length, text: t });
      last = t;
      continue;
    }
    const g = new Grid();
    for (const c of docxCells(b)) g.put(c.row, c.col, wCellText(c.tc), c.rs, c.cs);
    tables.push(g.table(last));
  }
  return { doc, fileName, title, tables, paragraphs };
}

// ---------------- OpenDocument (.odt) ----------------

/** 문단 글자: text:s(공백 n개), text:tab, text:line-break를 되살린다 */
function odfText(p: El): string {
  let s = '';
  const go = (e: El) => {
    for (const n of Array.from(e.childNodes)) {
      if (n.nodeType === 3 || n.nodeType === 4) s += (n as unknown as { nodeValue: string }).nodeValue ?? '';
      else if (n.nodeType === 1) {
        if (n.localName === 's') s += ' '.repeat(Number(n.getAttribute('text:c') ?? 1) || 1);
        else if (n.localName === 'tab') s += ' ';
        else if (n.localName === 'line-break') s += '\n';
        else if (n.localName === 'note' || n.localName === 'table') continue;
        else go(n);
      }
    }
  };
  go(p);
  return s.trim();
}

/** 본문 블록 (문단·제목·표). 목록과 구역은 안으로 들어간다 */
function* odfBlocks(e: El): Generator<El> {
  for (const k of kids(e)) {
    if (k.localName === 'p' || k.localName === 'h' || k.localName === 'table') yield k;
    else if (['list', 'list-item', 'list-header', 'section', 'soft-page-break'].includes(k.localName)) yield* odfBlocks(k);
  }
}

/** 표의 행: 머리글 행·행 묶음 안까지. 반복 속성은 펼친다(빈 행 대량 반복은 잘라 낸다) */
function odfRows(tbl: El): El[] {
  const out: El[] = [];
  const go = (e: El) => {
    for (const k of kids(e)) {
      if (k.localName === 'table-row') {
        const rep = Math.min(Number(k.getAttribute('table:number-rows-repeated') ?? 1) || 1, 50);
        for (let i = 0; i < rep; i++) out.push(k);
      } else if (['table-header-rows', 'table-rows', 'table-row-group'].includes(k.localName)) go(k);
    }
  };
  go(tbl);
  return out;
}

function odfTable(tbl: El, title: string): ParsedTable {
  const g = new Grid();
  odfRows(tbl).forEach((tr, ri) => {
    let col = 0;
    for (const tc of kids(tr)) {
      if (tc.localName !== 'table-cell' && tc.localName !== 'covered-table-cell') continue;
      const rep = Math.min(Number(tc.getAttribute('table:number-columns-repeated') ?? 1) || 1, 64);
      // ODF는 가려진 자리까지 칸(covered-table-cell)을 하나씩 적으므로 열은 칸마다 1씩 나아간다
      for (let i = 0; i < rep; i++, col++) {
        if (tc.localName === 'covered-table-cell') continue;
        const cs = Math.max(1, Number(tc.getAttribute('table:number-columns-spanned') ?? 1) || 1);
        const rs = Math.max(1, Number(tc.getAttribute('table:number-rows-spanned') ?? 1) || 1);
        const text = [...odfBlocks(tc)].filter((b) => b.localName !== 'table').map(odfText).filter(Boolean).join('\n');
        g.put(ri, col, text, rs, cs);
      }
    }
  });
  const t = g.table(title);
  // 반복으로 생긴 끝쪽 빈 행·열 정리
  while (t.rows.length && t.rows[t.rows.length - 1].every((c) => !c)) t.rows.pop();
  let w = Math.max(0, ...t.rows.map((r) => r.length));
  while (w > 0 && t.rows.every((r) => !r[w - 1]) && !t.spans.some((s) => s.col + s.colSpan >= w)) w--;
  t.rows = t.rows.map((r) => r.slice(0, w));
  return t;
}

export async function parseOdt(data: ArrayBuffer | Uint8Array, fileName: string, doc: DocKind): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file('content.xml')?.async('string');
  if (!xml) throw new Error('content.xml이 없어요');
  const body = kids(parseXml(xml), 'body')[0];
  const text = body && kids(body, 'text')[0];
  if (!text) throw new Error('본문이 없어요');
  const tables: ParsedTable[] = [];
  const paragraphs: { before: number; text: string }[] = [];
  let title = '';
  let last = '';
  for (const b of odfBlocks(text)) {
    if (b.localName === 'table') {
      tables.push(odfTable(b, last));
      continue;
    }
    const t = odfText(b);
    if (!t) continue;
    if (!title) title = t;
    paragraphs.push({ before: tables.length, text: t });
    last = t;
  }
  return { doc, fileName, title, tables, paragraphs };
}

// ---------------- Excel (.xlsx) ----------------

/** "B12" → [11, 1] (0부터) */
function addr(ref: string): [number, number] {
  const m = /^([A-Z]+)(\d+)$/i.exec(ref.replace(/\$/g, ''));
  if (!m) return [0, 0];
  let c = 0;
  for (const ch of m[1].toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64);
  return [Number(m[2]) - 1, c - 1];
}

const PERCENT_BUILTIN = new Set([9, 10]);

/** 숫자 칸을 화면 글자로: 백분율 서식은 20%처럼, 나머지는 불필요한 소수 자리를 줄인다 */
function numText(v: string, percent: boolean): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  const r = (x: number) => String(Math.round(x * 1e6) / 1e6);
  return percent ? `${r(n * 100)}%` : r(n);
}

function relTarget(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

export async function parseXlsx(data: ArrayBuffer | Uint8Array, fileName: string, doc: DocKind): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(data);
  const read = async (n: string) => (await zip.file(n)?.async('string')) ?? '';
  const wb = parseXml(await read('xl/workbook.xml'));
  const rels = new Map<string, string>();
  const relXml = await read('xl/_rels/workbook.xml.rels');
  if (relXml) for (const r of kids(parseXml(relXml), 'Relationship')) rels.set(r.getAttribute('Id') ?? '', relTarget('xl/workbook.xml', r.getAttribute('Target') ?? ''));

  const shared: string[] = [];
  const ssXml = await read('xl/sharedStrings.xml');
  if (ssXml)
    for (const si of kids(parseXml(ssXml), 'si')) {
      let s = '';
      for (const n of walk(si, 'rPh')) if (n.localName === 't') s += n.textContent ?? '';
      shared.push(s);
    }

  // 셀 서식 번호 → 백분율 여부
  const percentXf: boolean[] = [];
  const stXml = await read('xl/styles.xml');
  if (stXml) {
    const st = parseXml(stXml);
    const custom = new Map<number, string>();
    for (const nf of [...walk(st)].filter((n) => n.localName === 'numFmt')) custom.set(Number(nf.getAttribute('numFmtId')), nf.getAttribute('formatCode') ?? '');
    const xfs = kids(st, 'cellXfs')[0];
    if (xfs)
      for (const xf of kids(xfs, 'xf')) {
        const id = Number(xf.getAttribute('numFmtId') ?? 0);
        percentXf.push(PERCENT_BUILTIN.has(id) || /%/.test((custom.get(id) ?? '').replace(/"[^"]*"/g, '')));
      }
  }

  const tables: ParsedTable[] = [];
  const sheetsEl = kids(wb, 'sheets')[0];
  for (const sh of sheetsEl ? kids(sheetsEl, 'sheet') : []) {
    if (sh.getAttribute('state') === 'hidden' || sh.getAttribute('state') === 'veryHidden') continue;
    const rid = sh.getAttribute('r:id') ?? '';
    const path = rels.get(rid);
    if (!path) continue;
    const ws = parseXml(await read(path));
    const cells = new Map<string, string>();
    let maxR = -1;
    let maxC = -1;
    const sd = kids(ws, 'sheetData')[0];
    for (const row of sd ? kids(sd, 'row') : []) {
      let nextC = 0;
      const rowIdx = Number(row.getAttribute('r') ?? 0) - 1;
      for (const c of kids(row, 'c')) {
        const ref = c.getAttribute('r');
        const [r, col] = ref ? addr(ref) : [rowIdx, nextC];
        nextC = col + 1;
        const t = c.getAttribute('t');
        const v = kids(c, 'v')[0]?.textContent ?? '';
        let text = '';
        if (t === 's') text = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') text = [...walk(kids(c, 'is')[0] ?? c)].filter((n) => n.localName === 't').map((n) => n.textContent ?? '').join('');
        else if (t === 'b') text = v === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'str' || t === 'e') text = v;
        else if (v !== '') text = numText(v, percentXf[Number(c.getAttribute('s') ?? 0)] ?? false);
        text = text.replace(/\r\n?/g, '\n').trim();
        if (!text) continue;
        cells.set(`${r},${col}`, text);
        maxR = Math.max(maxR, r);
        maxC = Math.max(maxC, col);
      }
    }
    if (maxR < 0) continue;
    const spans: Span[] = [];
    const mc = kids(ws, 'mergeCells')[0];
    for (const m of mc ? kids(mc, 'mergeCell') : []) {
      const [a, b] = (m.getAttribute('ref') ?? '').split(':');
      if (!a || !b) continue;
      const [r0, c0] = addr(a);
      const [r1, c1] = addr(b);
      if (r0 > maxR || c0 > maxC) continue;
      spans.push({ row: r0, col: c0, rowSpan: Math.min(r1, maxR) - r0 + 1, colSpan: Math.min(c1, maxC) - c0 + 1 });
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (r !== r0 || c !== c0) cells.delete(`${r},${c}`);
    }
    const rows = Array.from({ length: maxR + 1 }, (_, r) => Array.from({ length: maxC + 1 }, (_, c) => cells.get(`${r},${c}`) ?? ''));
    tables.push({ title: sh.getAttribute('name') ?? '', rows, spans: spans.filter((s) => s.rowSpan > 1 || s.colSpan > 1) });
  }
  const first = tables[0]?.rows.flat().find(Boolean) ?? '';
  return { doc, fileName, title: first, tables, paragraphs: [] };
}
