import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { SAMPLES, type SampleId } from '../fixtures';
import { parseHwpx } from './hwpx';
import { writeHwpx } from './hwpx-writer';

describe('HWPX 파서', () => {
  for (const id of Object.keys(SAMPLES) as SampleId[])
    for (const kind of ['plan', 'rubric'] as const)
      it(`${SAMPLES[id].label} ${kind}: 작성한 HWPX를 다시 읽으면 fixture와 같다`, async () => {
        const doc = SAMPLES[id][kind];
        const parsed = await parseHwpx(await writeHwpx(doc), doc.fileName, kind);
        expect(parsed).toEqual(doc);
      });

  it('커밋된 public/samples HWPX 파일을 읽으면 fixture와 같다', async () => {
    const doc = SAMPLES.error.plan;
    const parsed = await parseHwpx(readFileSync(`public/samples/${doc.fileName}`), doc.fileName, 'plan');
    expect(parsed).toEqual(doc);
  });

  it('cellAddr가 없는 HWPX도 병합을 고려해 칸 위치를 정한다', async () => {
    const tc = (t: string, rs = 1) => `<hp:tc><hp:subList><hp:p><hp:run><hp:t>${t}</hp:t></hp:run></hp:p></hp:subList><hp:cellSpan colSpan="1" rowSpan="${rs}"/></hp:tc>`;
    const xml = `<hs:sec xmlns:hs="s" xmlns:hp="p"><hp:p><hp:run><hp:t>제목</hp:t></hp:run></hp:p><hp:p><hp:run><hp:tbl rowCnt="3" colCnt="2">
      <hp:tr>${tc('평가명')}${tc('평가요소')}</hp:tr><hp:tr>${tc('프로젝트', 2)}${tc('설계')}</hp:tr><hp:tr>${tc('구현')}</hp:tr></hp:tbl></hp:run></hp:p></hs:sec>`;
    const zip = new JSZip();
    zip.file('Contents/section0.xml', xml);
    const parsed = await parseHwpx(await zip.generateAsync({ type: 'uint8array' }), 'x.hwpx', 'plan');
    expect(parsed.tables[0].rows).toEqual([['평가명', '평가요소'], ['프로젝트', '설계'], ['', '구현']]);
    expect(parsed.tables[0].spans).toEqual([{ row: 1, col: 0, rowSpan: 2, colSpan: 1 }]);
    expect(parsed.tables[0].title).toBe('제목');
  });

  it('section XML이 없으면 알려 준다', async () => {
    const zip = new JSZip();
    zip.file('a.txt', 'x');
    await expect(parseHwpx(await zip.generateAsync({ type: 'uint8array' }), 'x', 'plan')).rejects.toThrow(/section/);
  });
});
