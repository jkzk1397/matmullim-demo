// HWPX 칸 고치기: 원본 zip을 그대로 두고, 지정한 표 칸 글자 안의 from을 to로 바꾼다.
// 표·칸 번호는 parseHwpx(hwpx.ts)와 똑같은 순회로 센다. 서식(hp:run, charPrIDRef 등)과 XML 구조는 건드리지 않고
// hp:t 안의 텍스트 노드 값만 바꾼다. 고친 section XML만 다시 직렬화하고, 나머지 파일은 원래 압축 바이트 그대로 둔다.
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export type CellEdit = { table: number; row: number; col: number; from: string; to: string };

export type PatchResult = {
  bytes: Uint8Array;
  applied: CellEdit[];
  skipped: { edit: CellEdit; reason: string }[];
};

// ---------- 최소 DOM 타입 (xmldom 노드) ----------

export type XNode = {
  nodeType: number;
  localName: string;
  childNodes: ArrayLike<XNode> & { length: number };
  parentNode: XNode | null;
  ownerDocument: XDoc;
  getAttribute(n: string): string | null;
  replaceChild(n: XNode, old: XNode): XNode;
  removeChild(old: XNode): XNode;
  data: string;
  nodeValue: string | null;
  length: number;
};
export type XDoc = { documentElement: XNode; createTextNode(s: string): XNode };

const ELEMENT = 1;
const TEXT = 3;
const CDATA = 4;
const ENTITY_REF = 5;

// ---------- hwpx.ts와 같은 순회 ----------

const kids = (e: XNode, name?: string): XNode[] =>
  Array.from(e.childNodes).filter((n) => n.nodeType === ELEMENT && (!name || n.localName === name));

function* walk(e: XNode, stopAt?: string): Generator<XNode> {
  for (const k of kids(e)) {
    yield k;
    if (k.localName !== stopAt) yield* walk(k, stopAt);
  }
}

const tablesIn = (p: XNode): XNode[] => [...walk(p, 'tbl')].filter((n) => n.localName === 'tbl');

/** textContent와 같은 순서로 글자를 이루는 노드 (텍스트·CDATA. 주석과 처리명령은 빠진다) */
function textNodes(e: XNode, out: XNode[] = []): XNode[] {
  for (const n of Array.from(e.childNodes)) {
    if (n.nodeType === TEXT || n.nodeType === CDATA) out.push(n);
    else if (n.nodeType === ELEMENT || n.nodeType === ENTITY_REF) textNodes(n, out);
  }
  return out;
}

type Seg = { node: XNode; start: number; end: number };
/** 문단 하나: paragraphText()가 trim하기 전의 원문(raw)과, 그 원문을 이루는 텍스트 노드 조각들 */
export type Para = { raw: string; segs: Seg[]; text: string };

export function paraOf(p: XNode): Para {
  const segs: Seg[] = [];
  let raw = '';
  for (const n of walk(p, 'tbl'))
    if (n.localName === 't')
      for (const node of textNodes(n)) {
        const v = node.nodeValue ?? '';
        segs.push({ node, start: raw.length, end: raw.length + v.length });
        raw += v;
      }
  return { raw, segs, text: raw.trim() };
}

const cellParas = (tc: XNode): Para[] => kids(kids(tc, 'subList')[0] ?? tc, 'p').map(paraOf);
const cellText = (paras: Para[]) => paras.map((p) => p.text).filter(Boolean).join('\n');

/** parseTable과 같은 규칙으로 (행,열) → hp:tc. 같은 칸에 두 tc가 오면 뒤의 것이 이긴다(파서도 덮어쓴다). */
function cellMap(tbl: XNode): Map<string, XNode> {
  const map = new Map<string, XNode>();
  const taken = new Set<string>();
  kids(tbl, 'tr').forEach((tr, ri) => {
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
      map.set(`${row},${col}`, tc);
    }
  });
  return map;
}

// ---------- 찾기 ----------

const WS = /\s/;
const stripWs = (s: string) => s.replace(/\s+/g, '');

type Hit = { para: Para; start: number; end: number } | { reason: string };

export function locate(paras: Para[], from: string): Hit {
  if (!from) return { reason: '바꿀 글자가 비어 있음' };
  const full = cellText(paras);
  // 1) 정확히 일치: 문단마다 trim된 범위 안에서 찾는다
  for (const para of paras) {
    if (!para.text) continue;
    const lead = para.raw.length - para.raw.trimStart().length;
    const tEnd = para.raw.trimEnd().length;
    const i = para.raw.indexOf(from, lead);
    if (i >= 0 && i + from.length <= tEnd) return { para, start: i, end: i + from.length };
  }
  if (full.includes(from)) return { reason: '여러 문단에 걸침' };
  // 2) 공백 무시 일치: 공백을 뺀 글자끼리 비교하고 원문 위치로 되돌린다
  const want = stripWs(from);
  if (!want) return { reason: '바꿀 글자가 공백뿐임' };
  for (const para of paras) {
    let ns = '';
    const pos: number[] = [];
    for (let i = 0; i < para.raw.length; i++)
      if (!WS.test(para.raw[i])) {
        ns += para.raw[i];
        pos.push(i);
      }
    const j = ns.indexOf(want);
    if (j >= 0) return { para, start: pos[j], end: pos[j + want.length - 1] + 1 };
  }
  if (stripWs(full).includes(want)) return { reason: '여러 문단에 걸침' };
  return { reason: '칸에서 바꿀 글자를 찾지 못함' };
}

// ---------- 바꾸기 ----------

function setText(node: XNode, v: string) {
  if (node.nodeType === CDATA) {
    // CDATA는 "]]>"가 들어가면 깨지므로 일반 텍스트 노드로 바꿔 넣는다 (직렬화 때 이스케이프된다)
    node.parentNode!.replaceChild(node.ownerDocument.createTextNode(v), node);
    return;
  }
  node.data = v;
  node.nodeValue = v;
  node.length = v.length;
}

/** 글자가 바뀐 문단(텍스트 노드에서 가장 가까운 hp:p)의 hp:linesegarray를 지운다.
 *  줄 배치 캐시라서 글자 길이가 바뀌면 낡은 값이 되고(줄 겹침), 없으면 한글이 다시 계산한다. */
function dropLineSegs(node: XNode) {
  let p = node.parentNode;
  while (p && !(p.nodeType === ELEMENT && p.localName === 'p')) p = p.parentNode;
  if (p) for (const ls of kids(p, 'linesegarray')) p.removeChild(ls);
}

/** [start,end) 범위를 to로 바꾼다. 처음 걸린 텍스트 노드에 to를 넣고, 뒤에 걸린 노드에서는 일치 부분만 지운다. */
export function replaceRange({ segs }: Para, start: number, end: number, to: string) {
  const hit = segs.filter((s) => s.end > start && s.start < end);
  hit.forEach((s, k) => {
    dropLineSegs(s.node);
    const v = s.node.nodeValue ?? '';
    const before = k === 0 ? v.slice(0, start - s.start) + to : '';
    const after = end < s.end ? v.slice(end - s.start) : '';
    setText(s.node, before + after);
  });
}

// ---------- zip ----------

const STORE_MAGIC = '\x00\x00';

/** 원래 압축 방식을 파일마다 지정해 두면 JSZip이 원래 압축 바이트를 그대로 다시 쓴다. */
export function originalCompression(f: JSZip.JSZipObject): 'STORE' | 'DEFLATE' | undefined {
  const magic = (f as unknown as { _data?: { compression?: { magic?: string } } })._data?.compression?.magic;
  if (magic === undefined) return undefined;
  return magic === STORE_MAGIC ? 'STORE' : 'DEFLATE';
}

/** 루트 요소 앞의 원문(XML 선언 등)을 그대로 둔다. xmldom은 선언의 공백 등을 바꿔 쓰기 때문. */
export function serialize(original: string, doc: XDoc): string {
  const i = original.search(/<[^?!]/);
  const prolog = i > 0 ? original.slice(0, i) : '';
  return prolog + new XMLSerializer().serializeToString(doc.documentElement as never);
}

export async function patchHwpx(data: ArrayBuffer | Uint8Array, edits: CellEdit[]): Promise<PatchResult> {
  const zip = await JSZip.loadAsync(data);
  const sections = Object.keys(zip.files)
    .filter((n) => /^Contents\/section\d+\.xml$/i.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/i)![1]) - Number(b.match(/(\d+)\.xml$/i)![1]));
  if (!sections.length) throw new Error('HWPX 안에서 Contents/section*.xml을 찾지 못했어요. 구형 HWP나 다른 형식일 수 있어요.');

  type Sec = { name: string; xml: string; doc: XDoc; dirty: boolean };
  const secs: Sec[] = [];
  const tables: { sec: Sec; tbl: XNode; cells?: Map<string, XNode> }[] = [];
  for (const name of sections) {
    const xml = await zip.file(name)!.async('string');
    const doc = new DOMParser().parseFromString(xml, 'text/xml') as unknown as XDoc;
    const sec: Sec = { name, xml, doc, dirty: false };
    secs.push(sec);
    for (const p of kids(doc.documentElement, 'p')) for (const tbl of tablesIn(p)) tables.push({ sec, tbl });
  }

  const applied: CellEdit[] = [];
  const skipped: { edit: CellEdit; reason: string }[] = [];
  for (const edit of edits) {
    const t = tables[edit.table];
    if (!t) {
      skipped.push({ edit, reason: `표 ${edit.table}이(가) 없음` });
      continue;
    }
    t.cells ??= cellMap(t.tbl);
    const tc = t.cells.get(`${edit.row},${edit.col}`);
    if (!tc) {
      skipped.push({ edit, reason: `칸 (${edit.row},${edit.col})이(가) 없음 (병합으로 가려졌거나 범위 밖)` });
      continue;
    }
    const hit = locate(cellParas(tc), edit.from);
    if ('reason' in hit) {
      skipped.push({ edit, reason: hit.reason });
      continue;
    }
    replaceRange(hit.para, hit.start, hit.end, edit.to);
    t.sec.dirty = true;
    applied.push(edit);
  }

  // 원래 압축 방식 유지 (안 고친 파일은 압축 바이트까지 그대로)
  for (const f of Object.values(zip.files)) {
    const c = originalCompression(f);
    if (c) f.options.compression = c;
  }
  for (const sec of secs) {
    if (!sec.dirty) continue;
    const old = zip.files[sec.name];
    zip.file(sec.name, serialize(sec.xml, sec.doc), {
      compression: originalCompression(old) ?? 'DEFLATE',
      createFolders: false,
      date: old.date,
      comment: old.comment || undefined,
      unixPermissions: old.unixPermissions ?? undefined,
      dosPermissions: old.dosPermissions ?? undefined,
    });
  }

  // OCF 관례: mimetype은 맨 앞, 압축하지 않음(STORE)
  const mime = zip.files['mimetype'];
  if (mime && !mime.dir) {
    mime.options.compression = 'STORE';
    const files = zip.files as Record<string, JSZip.JSZipObject>;
    if (Object.keys(files)[0] !== 'mimetype') {
      const rest = Object.entries(files).filter(([k]) => k !== 'mimetype');
      for (const k of Object.keys(files)) delete files[k];
      files['mimetype'] = mime;
      for (const [k, v] of rest) files[k] = v;
    }
  }

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return { bytes, applied, skipped };
}
