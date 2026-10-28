// HWPX 파서: zip 안의 Contents/section*.xml에서 표(hp:tbl → hp:tr → hp:tc)를 2차원 배열로 뽑는다.
// 셀 병합은 최소한만 처리한다: 병합 시작 칸에만 글자를 두고 가려진 칸은 "", 병합 정보는 spans에 남긴다.
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import type { DocKind, ParsedDocument, ParsedTable, Span } from './types';

type El = {
  localName: string;
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

/** 문단 글자. 문단 안의 표 내부 글자는 넣지 않는다. */
function paragraphText(p: El): string {
  let s = '';
  for (const n of walk(p, 'tbl')) if (n.localName === 't') s += n.textContent ?? '';
  return s.trim();
}

/** 문단에 직접 들어 있는 표 (다른 표 안의 표는 제외) */
function tablesIn(p: El): El[] {
  return [...walk(p, 'tbl')].filter((n) => n.localName === 'tbl');
}

function cellText(tc: El): string {
  const sub = kids(tc, 'subList')[0] ?? tc;
  return kids(sub, 'p').map(paragraphText).filter(Boolean).join('\n');
}

function parseTable(tbl: El, title: string): ParsedTable {
  const rows: string[][] = [];
  const spans: Span[] = [];
  const taken = new Set<string>();
  const trs = kids(tbl, 'tr');
  const colCnt = Number(tbl.getAttribute('colCnt')) || 0;
  trs.forEach((tr, ri) => {
    let nextCol = 0;
    for (const tc of kids(tr, 'tc')) {
      const addr = kids(tc, 'cellAddr')[0];
      const span = kids(tc, 'cellSpan')[0];
      let row = ri;
      let col: number;
      if (addr) {
        row = Number(addr.getAttribute('rowAddr') ?? ri);
        col = Number(addr.getAttribute('colAddr') ?? 0);
      } else {
        while (taken.has(`${row},${nextCol}`)) nextCol++;
        col = nextCol;
      }
      const rs = Math.max(1, Number(span?.getAttribute('rowSpan') ?? 1));
      const cs = Math.max(1, Number(span?.getAttribute('colSpan') ?? 1));
      for (let r = row; r < row + rs; r++) for (let c = col; c < col + cs; c++) taken.add(`${r},${c}`);
      nextCol = col + cs;
      while (rows.length <= row + rs - 1) rows.push([]);
      rows[row][col] = cellText(tc);
      if (rs > 1 || cs > 1) spans.push({ row, col, rowSpan: rs, colSpan: cs });
    }
  });
  const width = Math.max(colCnt, ...rows.map((r) => r.length));
  return { title, rows: rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? '')), spans };
}

export async function parseHwpx(data: ArrayBuffer | Uint8Array, fileName: string, doc: DocKind): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(data);
  const sections = Object.keys(zip.files)
    .filter((n) => /^Contents\/section\d+\.xml$/i.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/i)![1]) - Number(b.match(/(\d+)\.xml$/i)![1]));
  if (!sections.length) throw new Error('HWPX 안에서 Contents/section*.xml을 찾지 못했어요. 구형 HWP나 다른 형식일 수 있어요.');

  const tables: ParsedTable[] = [];
  const paragraphs: { before: number; text: string }[] = [];
  let title = '';
  for (const name of sections) {
    const xml = await zip.file(name)!.async('string');
    const root = new DOMParser().parseFromString(xml, 'text/xml').documentElement as unknown as El;
    let lastText = '';
    for (const p of kids(root, 'p')) {
      const text = paragraphText(p);
      const tbls = tablesIn(p);
      if (!title && text && !tbls.length) title = text;
      if (text) paragraphs.push({ before: tables.length, text });
      for (const t of tbls) tables.push(parseTable(t, text || lastText));
      if (text) lastText = text;
    }
  }
  return { doc, fileName, title, tables, paragraphs };
}
