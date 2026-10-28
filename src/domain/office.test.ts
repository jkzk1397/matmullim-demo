// Word·Excel·ODT 읽기: 예시 HWPX(가상의 ○○중학교)의 표를 각 형식으로 다시 써서 읽었을 때
// 표 내용과 점검 결과가 HWPX와 같아야 한다. Word는 고친 칸을 다시 써서 내려받는 것까지 본다.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { parseHwpx } from './hwpx';
import { parseDocx, parseOdt, parseXlsx, zipKind } from './office';
import { patchDocx } from './office-patch';
import { reviewsFor, type Source } from './workspace';
import type { ParsedDocument, ParsedTable } from './types';

const DIR = 'public/samples/v2';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 병합 정보: 시작 칸 → span, 가려진 칸 → 시작 칸 */
function spanInfo(t: ParsedTable) {
  const start = new Map<string, { rs: number; cs: number }>();
  const hidden = new Map<string, [number, number]>();
  for (const s of t.spans) {
    start.set(`${s.row},${s.col}`, { rs: s.rowSpan, cs: s.colSpan });
    for (let r = s.row; r < s.row + s.rowSpan; r++) for (let c = s.col; c < s.col + s.colSpan; c++) if (r !== s.row || c !== s.col) hidden.set(`${r},${c}`, [s.row, s.col]);
  }
  return { start, hidden };
}

async function toDocx(d: ParsedDocument): Promise<Uint8Array> {
  const p = (t: string) => t.split('\n').map((l) => `<w:p><w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`).join('') || '<w:p/>';
  let body = '';
  const paras = d.paragraphs ?? [];
  d.tables.forEach((t, ti) => {
    for (const x of paras.filter((q) => q.before === ti)) body += p(x.text);
    const { start, hidden } = spanInfo(t);
    body += '<w:tbl>';
    t.rows.forEach((row, r) => {
      body += '<w:tr>';
      for (let c = 0; c < row.length; ) {
        const h = hidden.get(`${r},${c}`);
        if (h && h[0] === r) { c++; continue; } // 가로 병합으로 가려진 칸은 gridSpan으로 처리됨
        const s = h ? start.get(`${h[0]},${h[1]}`)! : start.get(`${r},${c}`) ?? { rs: 1, cs: 1 };
        const cs = s.cs;
        const vm = h ? '<w:vMerge/>' : s.rs > 1 ? '<w:vMerge w:val="restart"/>' : '';
        body += `<w:tc><w:tcPr>${cs > 1 ? `<w:gridSpan w:val="${cs}"/>` : ''}${vm}</w:tcPr>${h ? '<w:p/>' : p(row[c])}</w:tc>`;
        c += cs;
      }
      body += '</w:tr>';
    });
    body += '</w:tbl>';
  });
  for (const x of paras.filter((q) => q.before >= d.tables.length)) body += p(x.text);
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: 'uint8array' });
}

async function toOdt(d: ParsedDocument): Promise<Uint8Array> {
  const p = (t: string) => t.split('\n').map((l) => `<text:p>${esc(l)}</text:p>`).join('');
  let body = '';
  const paras = d.paragraphs ?? [];
  d.tables.forEach((t, ti) => {
    for (const x of paras.filter((q) => q.before === ti)) body += p(x.text);
    const { start, hidden } = spanInfo(t);
    body += '<table:table>';
    t.rows.forEach((row, r) => {
      body += '<table:table-row>';
      row.forEach((v, c) => {
        if (hidden.has(`${r},${c}`)) body += '<table:covered-table-cell/>';
        else {
          const s = start.get(`${r},${c}`);
          body += `<table:table-cell${s ? ` table:number-rows-spanned="${s.rs}" table:number-columns-spanned="${s.cs}"` : ''}>${p(v)}</table:table-cell>`;
        }
      });
      body += '</table:table-row>';
    });
    body += '</table:table>';
  });
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text');
  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"><office:body><office:text>${body}</office:text></office:body></office:document-content>`);
  return zip.generateAsync({ type: 'uint8array' });
}

const colName = (c: number) => { let s = ''; c++; while (c) { s = String.fromCharCode(65 + ((c - 1) % 26)) + s; c = Math.floor((c - 1) / 26); } return s; };

/** 표 하나를 시트 하나로 (Excel 계획서처럼). 셀은 글자 그대로 */
async function toXlsx(d: ParsedDocument): Promise<Uint8Array> {
  const zip = new JSZip();
  const sheets = d.tables.map((t, i) => {
    let data = '';
    t.rows.forEach((row, r) => {
      data += `<row r="${r + 1}">`;
      row.forEach((v, c) => { if (v) data += `<c r="${colName(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`; });
      data += '</row>';
    });
    const merges = t.spans.map((s) => `<mergeCell ref="${colName(s.col)}${s.row + 1}:${colName(s.col + s.colSpan - 1)}${s.row + s.rowSpan}"/>`).join('');
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${data}</sheetData>${merges ? `<mergeCells>${merges}</mergeCells>` : ''}</worksheet>`);
    return `<sheet name="${esc(t.title.slice(0, 30) || `표${i + 1}`)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
  });
  zip.file('xl/workbook.xml', `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.join('')}</sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${d.tables.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`);
  return zip.generateAsync({ type: 'uint8array' });
}

const src = (doc: ParsedDocument, bytes: Uint8Array, kind: Source['kind']): Source => ({ id: kind, name: doc.fileName, kind, bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, doc });
const summary = (s: Source) => reviewsFor(s).map((r) => `${r.ex.context?.subject}:${r.result.cards.map((c) => `${c.rule}/${c.severity}`).sort().join(',')}`);

describe('Word·Excel·ODT 읽기', () => {
  for (const file of ['정보_2학년_2학기_점검전.hwpx', '전과목_2학년_2학기.hwpx']) {
    it(`${file}: Word·ODT로 바꿔도 표와 점검 결과가 같다`, async () => {
      const hwpx = await parseHwpx(readFileSync(`${DIR}/${file}`), file, 'plan');
      const base = summary(src(hwpx, new Uint8Array(), 'hwpx'));
      const docx = await toDocx(hwpx);
      expect(await zipKind(docx)).toBe('docx');
      const d = await parseDocx(docx, file, 'plan');
      expect(d.tables.map((t) => t.rows)).toEqual(hwpx.tables.map((t) => t.rows));
      expect(summary(src(d, docx, 'docx'))).toEqual(base);
      const odt = await toOdt(hwpx);
      expect(await zipKind(odt)).toBe('odt');
      const o = await parseOdt(odt, file, 'plan');
      expect(o.tables.map((t) => t.rows)).toEqual(hwpx.tables.map((t) => t.rows));
      expect(summary(src(o, odt, 'odt'))).toEqual(base);
    });
  }

  it('Excel: 시트마다 표 하나로 읽고 같은 오류를 찾는다', async () => {
    const file = '정보_2학년_2학기_점검전.hwpx';
    const hwpx = await parseHwpx(readFileSync(`${DIR}/${file}`), file, 'plan');
    const xlsx = await toXlsx(hwpx);
    expect(await zipKind(xlsx)).toBe('xlsx');
    const x = await parseXlsx(xlsx, file, 'plan');
    expect(x.tables.map((t) => t.rows)).toEqual(hwpx.tables.map((t) => t.rows));
    const cards = reviewsFor(src(x, xlsx, 'xlsx')).flatMap((r) => r.result.cards).filter((c) => c.severity === 'red');
    const base = reviewsFor(src(hwpx, new Uint8Array(), 'hwpx')).flatMap((r) => r.result.cards).filter((c) => c.severity === 'red');
    expect(cards.map((c) => c.rule).sort()).toEqual(base.map((c) => c.rule).sort());
  });

  it('Excel 백분율 서식 칸은 20%로 읽는다', async () => {
    const zip = new JSZip();
    zip.file('xl/workbook.xml', '<workbook xmlns:r="r"><sheets><sheet name="평가" sheetId="1" r:id="rId1"/></sheets></workbook>');
    zip.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
    zip.file('xl/styles.xml', '<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="9"/></cellXfs></styleSheet>');
    zip.file('xl/sharedStrings.xml', '<sst><si><t>반영비율</t></si></sst>');
    zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" s="1"><v>0.2</v></c><c r="C1"><v>30</v></c></row></sheetData></worksheet>');
    const x = await parseXlsx(await zip.generateAsync({ type: 'uint8array' }), 'x.xlsx', 'plan');
    expect(x.tables[0].rows).toEqual([['반영비율', '20%', '30']]);
  });

  it('Word: 바로 고친 칸만 바꾼 파일을 내려받고, 다시 읽으면 고친 값이다', async () => {
    const file = '정보_2학년_2학기_점검전.hwpx';
    const hwpx = await parseHwpx(readFileSync(`${DIR}/${file}`), file, 'plan');
    const docx = await toDocx(hwpx);
    const d = await parseDocx(docx, file, 'plan');
    // 반영비율 20%가 적힌 칸 하나를 30%로
    const t = d.tables.findIndex((x) => x.rows.some((r) => r.some((c) => c.includes('30점') && c.includes('(20%)'))));
    expect(t).toBeGreaterThanOrEqual(0);
    const row = d.tables[t].rows.findIndex((r) => r.some((c) => c.includes('30점') && c.includes('(20%)')));
    const col = d.tables[t].rows[row].findIndex((c) => c.includes('30점') && c.includes('(20%)'));
    const out = await patchDocx(docx, [{ table: t, row, col, from: '20%', to: '30%' }]);
    expect(out.applied).toHaveLength(1);
    const again = await parseDocx(out.bytes, file, 'plan');
    expect(again.tables[t].rows[row][col]).toContain('(30%)');
    expect(again.tables[t].rows[row][col]).not.toContain('(20%)');
  });
});
