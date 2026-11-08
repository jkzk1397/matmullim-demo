// 포스터 QR 바로가기(?try=)가 가리키는 예시 문서와 열리는 화면
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TRY_FILES, trySample } from './deeplink';
import { parseHwpx } from './domain/hwpx';
import { splitSections } from './domain/context';

const DIR = 'public/samples/v2';

describe('포스터 바로가기 (?try=)', () => {
  it('info는 정보 (점검 전), all은 전 교과 예시 문서', () => {
    expect(trySample('?try=info')).toBe('정보_2학년_2학기_점검전.hwpx');
    expect(trySample('?try=all')).toBe('전과목_2학년_2학기.hwpx');
    expect(trySample('?try=INFO')).toBe('정보_2학년_2학기_점검전.hwpx');
    expect(trySample('?utm_source=poster&try=all')).toBe('전과목_2학년_2학기.hwpx');
  });

  it('모르는 값이나 빈 값은 올리기 화면으로', () => {
    for (const s of ['', '?', '?try=', '?try=foo', '?try=toString', '?try=__proto__', '?other=info']) expect(trySample(s)).toBeNull();
  });

  it('가리키는 파일이 예시 목록에 있고, info는 교과 하나(점검 화면)·all은 여러 교과(전체 현황)', async () => {
    const index: { file: string }[] = JSON.parse(readFileSync(`${DIR}/index.json`, 'utf8'));
    for (const f of TRY_FILES) expect(index.map((s) => s.file)).toContain(f);
    const sections = async (f: string) => splitSections(await parseHwpx(readFileSync(`${DIR}/${f}`), f, 'plan')).length;
    expect(await sections(trySample('?try=info')!)).toBeLessThanOrEqual(1);
    expect(await sections(trySample('?try=all')!)).toBe(12);
  });
});
