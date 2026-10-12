// fixture(JSON) → public/samples/*.hwpx. 예시 불러오기 버튼은 이 HWPX를 브라우저에서 실제로 파싱한다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { SAMPLES, type SampleId } from '../src/fixtures';
import { writeHwpx } from '../src/domain/hwpx-writer';

mkdirSync('public/samples', { recursive: true });
for (const id of Object.keys(SAMPLES) as SampleId[]) {
  for (const kind of ['plan', 'rubric'] as const) {
    const doc = SAMPLES[id][kind];
    const bytes = await writeHwpx(doc);
    writeFileSync(`public/samples/${doc.fileName}`, bytes);
    console.log(`public/samples/${doc.fileName}`, bytes.length, 'bytes');
  }
}
