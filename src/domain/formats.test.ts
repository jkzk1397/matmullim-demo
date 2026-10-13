import { describe, expect, it } from 'vitest';
import * as CFB from 'cfb';
import { deflateSync } from 'fflate';
import { isHwp5, parseHwp5 } from './hwp5';
import { cleanPdfText, pdfPagesToDoc } from './pdf-text';
import { extractPublic } from './extract-public';

// 최소 HWP 5 문서를 직접 만든다: 문단 하나 안에 1×2 표 (실제 학교 문서는 저장소에 넣지 않는다)
function rec(tag: number, level: number, data: Uint8Array) {
  const h = new Uint8Array(4 + data.length);
  new DataView(h.buffer).setUint32(0, tag | (level << 10) | (data.length << 20), true);
  h.set(data, 4);
  return h;
}
const u16 = (s: string) => { const b = new Uint8Array(s.length * 2); const dv = new DataView(b.buffer); [...s].forEach((c, i) => dv.setUint16(i * 2, c.charCodeAt(0), true)); return b; };
function cellHeader(col: number, row: number) {
  const b = new Uint8Array(32); const dv = new DataView(b.buffer);
  dv.setInt16(0, 1, true); dv.setUint16(8, col, true); dv.setUint16(10, row, true); dv.setUint16(12, 1, true); dv.setUint16(14, 1, true);
  return b;
}
function tinyHwp(): Uint8Array {
  const tbl = new Uint8Array(8); new DataView(tbl.buffer).setUint16(4, 1, true); new DataView(tbl.buffer).setUint16(6, 2, true);
  const parts = [
    rec(66, 0, new Uint8Array(22)), rec(67, 1, u16('평가 요약')),
    rec(71, 1, new Uint8Array([0x20, 0x6c, 0x62, 0x74])), rec(77, 2, tbl),
    rec(72, 2, cellHeader(0, 0)), rec(66, 2, new Uint8Array(22)), rec(67, 3, u16('영역만점')),
    rec(72, 2, cellHeader(1, 0)), rec(66, 2, new Uint8Array(22)), rec(67, 3, u16('20점(20%)')),
  ];
  const body = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { body.set(p, o); o += p.length; }
  const cfb = CFB.utils.cfb_new();
  const header = new Uint8Array(256); header.set(new TextEncoder().encode('HWP Document File')); header[36] = 1;
  CFB.utils.cfb_add(cfb, '/FileHeader', header);
  CFB.utils.cfb_add(cfb, '/BodyText/Section0', deflateSync(body, { level: 6 }));
  return new Uint8Array(CFB.write(cfb, { type: 'array' }) as number[]);
}

describe('구형 HWP 읽기', () => {
  it('OLE 안 BodyText의 표를 2차원 배열로 읽는다', () => {
    const buf = tinyHwp();
    expect(isHwp5(buf)).toBe(true);
    const doc = parseHwp5(buf, 'x.hwp', 'plan');
    expect(doc.tables).toHaveLength(1);
    expect(doc.tables[0].rows).toEqual([['영역만점', '20점(20%)']]);
    expect(doc.tables[0].title).toBe('평가 요약');
  });
});

describe('PDF 글자 읽기', () => {
  it('조각 사이 공백을 지우고 코드 모양을 되살린다', () => {
    expect(cleanPdfText('컴퓨팅   시스템   [9 정 01-01]   컴퓨팅   시스템의   구성요소와')).toBe('컴퓨팅 시스템 [9정01-01] 컴퓨팅 시스템의 구성요소와');
  });
  it('PDF 글자에서도 코드 오타·문장을 모은다', () => {
    const doc = pdfPagesToDoc(['성취기준 \n[9 정 03-01]   문제의   상태를   정의하고   수행   가능한   형태로   구조화한다 . \n'], 'x.pdf', 'plan');
    const ex = extractPublic(doc);
    expect(ex.codeTexts?.some((c) => c.code === '[9정03-01]')).toBe(true);
  });
});
