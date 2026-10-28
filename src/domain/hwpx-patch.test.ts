import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { SAMPLES } from '../fixtures';
import { parseHwpx } from './hwpx';
import { writeHwpx } from './hwpx-writer';
import { patchHwpx, type CellEdit } from './hwpx-patch';
import type { ParsedDocument } from './types';

/** 바꾼 칸 말고는 모두 같은지 본다. expected: "표,행,열" → 기대 글자 */
function expectOnlyChanged(before: ParsedDocument, after: ParsedDocument, expected: Map<string, string>) {
  expect(after.tables.length).toBe(before.tables.length);
  expect(after.title).toBe(before.title);
  expect(after.paragraphs).toEqual(before.paragraphs);
  before.tables.forEach((t, ti) => {
    const u = after.tables[ti];
    expect(u.title).toBe(t.title);
    expect(u.spans).toEqual(t.spans);
    expect(u.rows.length).toBe(t.rows.length);
    t.rows.forEach((row, ri) =>
      row.forEach((cell, ci) => {
        const want = expected.get(`${ti},${ri},${ci}`);
        expect(u.rows[ri][ci], `표 ${ti} (${ri},${ci})`).toBe(want ?? cell);
      }),
    );
  });
}

/** zip 첫 항목이 mimetype이고 STORE(압축 방식 0)인지 로컬 헤더에서 직접 읽는다 */
function expectMimetypeFirstStored(bytes: Uint8Array) {
  expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  expect(bytes[8] | (bytes[9] << 8)).toBe(0);
  const nameLen = bytes[26] | (bytes[27] << 8);
  expect(new TextDecoder().decode(bytes.slice(30, 30 + nameLen))).toBe('mimetype');
}

async function sectionXml(bytes: Uint8Array, name = 'Contents/section0.xml') {
  return (await JSZip.loadAsync(bytes)).file(name)!.async('string');
}

async function zipOf(sectionXml: string) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
  zip.file('Contents/section0.xml', sectionXml);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

describe('HWPX 칸 고치기 (patchHwpx)', () => {
  it('작성한 예시 HWPX의 칸 하나를 고치면 그 칸만 바뀐다', async () => {
    const doc = SAMPLES.error.plan;
    const src = await writeHwpx(doc);
    const before = await parseHwpx(src, doc.fileName, 'plan');
    // 글자가 4자 이상인 칸 둘을 골라 가운데 일부를 바꾼다
    const picks: CellEdit[] = [];
    before.tables.forEach((t, ti) =>
      t.rows.forEach((row, ri) =>
        row.forEach((cell, ci) => {
          if (picks.length < 2 && cell.length >= 4 && !cell.includes('\n') && (picks.length === 0 || picks[0].table !== ti))
            picks.push({ table: ti, row: ri, col: ci, from: cell.slice(1, 3), to: '<바뀜&>' });
        }),
      ),
    );
    expect(picks.length).toBe(2);
    const { bytes, applied, skipped } = await patchHwpx(src, picks);
    expect(skipped).toEqual([]);
    expect(applied).toEqual(picks);
    const after = await parseHwpx(bytes, doc.fileName, 'plan');
    const expected = new Map(picks.map((e) => [`${e.table},${e.row},${e.col}`, before.tables[e.table].rows[e.row][e.col].replace(e.from, e.to)]));
    expectOnlyChanged(before, after, expected);
    expectMimetypeFirstStored(bytes);
    // 다른 파일은 내용이 그대로
    const [a, b] = await Promise.all([JSZip.loadAsync(src), JSZip.loadAsync(bytes)]);
    expect(Object.keys(b.files)).toEqual(Object.keys(a.files));
    for (const name of Object.keys(a.files))
      if (name !== 'Contents/section0.xml' && !a.files[name].dir) expect(await b.file(name)!.async('string')).toBe(await a.file(name)!.async('string'));
    // 특수문자는 이스케이프된다
    expect(await sectionXml(bytes)).toMatch(/&lt;바뀜&amp;(>|&gt;)/);
  });

  const cell = (paras: string) =>
    `<hp:tc><hp:subList>${paras}</hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/></hp:tc>`;
  const sec = (tcs: string) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec xmlns:hs="s" xmlns:hp="p"><hp:p><hp:run><hp:t>제목</hp:t></hp:run></hp:p>` +
    `<hp:p><hp:run><hp:tbl rowCnt="1" colCnt="1"><hp:tr>${tcs}</hp:tr></hp:tbl></hp:run></hp:p></hs:sec>`;
  const twoRuns =
    '<hp:p><hp:run charPrIDRef="1"><hp:t>성취기준 [9정</hp:t></hp:run><hp:run charPrIDRef="2"><hp:t>03-01] 설명</hp:t></hp:run>' +
    '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" horzsize="100" flags="1"/></hp:linesegarray></hp:p>';
  const untouched =
    '<hp:p><hp:run charPrIDRef="3"><hp:t>다른 문단</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="999" horzsize="100" flags="1"/></hp:linesegarray></hp:p>';

  it('서식이 다른 두 run에 걸친 글자를 바꾸면 첫 hp:t에 넣고 뒤 hp:t에서는 지운다', async () => {
    const src = await zipOf(sec(cell(twoRuns + untouched)));
    const { bytes, applied } = await patchHwpx(src, [{ table: 0, row: 0, col: 0, from: '[9정03-01]', to: '[9정03-02]' }]);
    expect(applied.length).toBe(1);
    const xml = await sectionXml(bytes);
    expect(xml).toContain('<hp:run charPrIDRef="1"><hp:t>성취기준 [9정03-02]</hp:t></hp:run><hp:run charPrIDRef="2"><hp:t> 설명</hp:t></hp:run>');
    // XML 선언은 원문 그대로
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec')).toBe(true);
    // 고친 문단은 줄 배치 캐시(hp:linesegarray)를 지우고, 안 고친 문단은 그대로 둔다
    expect(xml).toContain('<hp:t> 설명</hp:t></hp:run></hp:p>');
    expect(xml).toContain(untouched);
    expect(xml.match(/<hp:linesegarray>/g)?.length).toBe(1);
    expect((await parseHwpx(bytes, 'x', 'plan')).tables[0].rows[0][0]).toBe('성취기준 [9정03-02] 설명\n다른 문단');
  });

  it('정확히 맞지 않으면 공백을 무시하고 찾는다', async () => {
    const src = await zipOf(sec(cell(twoRuns)));
    const { bytes, applied } = await patchHwpx(src, [{ table: 0, row: 0, col: 0, from: '[9정 03 - 01]', to: 'X' }]);
    expect(applied.length).toBe(1);
    expect((await parseHwpx(bytes, 'x', 'plan')).tables[0].rows[0][0]).toBe('성취기준 X 설명');
  });

  it('hp:t 안의 hp:tab 등 자식 요소는 그대로 두고 텍스트 노드만 고친다', async () => {
    const p = '<hp:p><hp:run><hp:t>가나<hp:tab width="100"/>다라</hp:t></hp:run></hp:p>';
    const src = await zipOf(sec(cell(p)));
    expect((await parseHwpx(src, 'x', 'plan')).tables[0].rows[0][0]).toBe('가나다라');
    const { bytes } = await patchHwpx(src, [{ table: 0, row: 0, col: 0, from: '나다', to: '1' }]);
    expect(await sectionXml(bytes)).toContain('<hp:t>가1<hp:tab width="100"/>라</hp:t>');
  });

  it('여러 문단에 걸치거나 없으면 건너뛴다', async () => {
    const paras = '<hp:p><hp:run><hp:t>첫 문단</hp:t></hp:run></hp:p><hp:p><hp:run><hp:t>둘째 문단</hp:t></hp:run></hp:p>';
    const src = await zipOf(sec(cell(paras)));
    const edits: CellEdit[] = [
      { table: 0, row: 0, col: 0, from: '문단\n둘째', to: 'x' },
      { table: 0, row: 0, col: 0, from: '문단둘째', to: 'x' },
      { table: 0, row: 0, col: 0, from: '셋째', to: 'x' },
      { table: 0, row: 5, col: 0, from: '첫', to: 'x' },
      { table: 3, row: 0, col: 0, from: '첫', to: 'x' },
    ];
    const { bytes, applied, skipped } = await patchHwpx(src, edits);
    expect(applied).toEqual([]);
    expect(skipped.map((s) => s.reason)).toEqual(['여러 문단에 걸침', '여러 문단에 걸침', '칸에서 바꿀 글자를 찾지 못함', expect.stringContaining('칸'), expect.stringContaining('표')]);
    expect(await sectionXml(bytes)).toBe(await sectionXml(src));
  });

  // ---------- 실제 파일 (저장소에 넣지 않는다. 없으면 건너뛴다) ----------
  const CORPUS = '/tmp/claude-0/-home-claude/977ce681-30da-5839-b528-d65fa467d36b/scratchpad/corpus';
  for (const f of ['S2_05', 'S1_47', 'S1_56', 'S2_17', 'S2_00', 'S1_77']) {
    const path = `${CORPUS}/${f}.hwpx`;
    it.skipIf(!existsSync(path))(`실제 파일 ${f}: "[9정" 코드가 든 칸 5개를 고치면 그 칸만 바뀐다`, async () => {
      const src = readFileSync(path);
      const before = await parseHwpx(src, f, 'plan');
      const cells: { t: number; r: number; c: number; text: string }[] = [];
      before.tables.forEach((t, ti) => t.rows.forEach((row, ri) => row.forEach((text, ci) => /\[9정[^\]\n]*\]/.test(text) && cells.push({ t: ti, r: ri, c: ci, text }))));
      expect(cells.length).toBeGreaterThan(0);
      const step = Math.max(1, Math.floor(cells.length / 5));
      const picks = cells.filter((_, i) => i % step === 0).slice(0, 5);
      const edits: CellEdit[] = picks.map(({ t, r, c, text }) => {
        const from = text.match(/\[9정[^\]\n]*\]/)![0];
        return { table: t, row: r, col: c, from, to: from.replace('[9정', '[9수') + '※' };
      });
      const { bytes, applied, skipped } = await patchHwpx(src, edits);
      expect(skipped).toEqual([]);
      expect(applied.length).toBe(edits.length);
      const after = await parseHwpx(bytes, f, 'plan');
      const expected = new Map(edits.map((e, i) => [`${e.table},${e.row},${e.col}`, picks[i].text.replace(e.from, e.to)]));
      expectOnlyChanged(before, after, expected);
      expectMimetypeFirstStored(bytes);
      const [a, b] = await Promise.all([JSZip.loadAsync(src), JSZip.loadAsync(bytes)]);
      expect(Object.keys(b.files)).toEqual(Object.keys(a.files));
      for (const name of Object.keys(a.files))
        if (!/^Contents\/section\d+\.xml$/i.test(name) && !a.files[name].dir)
          expect(await b.file(name)!.async('uint8array')).toEqual(await a.file(name)!.async('uint8array'));
    });
  }
});
