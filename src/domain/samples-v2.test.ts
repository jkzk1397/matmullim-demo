// public/samples/v2의 합성 예시 문서(가상의 ○○중학교)를 실제 HWPX로 읽어 점검했을 때,
// 심어 둔 오류만 빨강·주황으로 잡히는지 확인한다. 문서는 scripts/make-samples-v2.ts가 만든다.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseHwpx } from './hwpx';
import { splitSections } from './context';
import { extractPublic, suggestPublicPairs } from './extract-public';
import { runChecks } from './rules';
import type { Card } from './types';

const DIR = 'public/samples/v2';

async function check(file: string) {
  const doc = await parseHwpx(readFileSync(`${DIR}/${file}`), file, 'plan');
  const sections = splitSections(doc);
  return sections.map((section) => {
    const ex = extractPublic(doc, section);
    const { cards } = runChecks({
      plan: ex.plan,
      rubric: ex.rubric,
      planStandards: ex.planStandards,
      codeTexts: ex.codeTexts,
      pairs: suggestPublicPairs(ex.plan, ex.rubric),
      links: [],
      format: 'public',
      context: ex.context,
      essay: ex.essay,
      absence: ex.absence,
    });
    return { section, context: ex.context, cards, serious: cards.filter((c) => c.severity === 'red' || c.severity === 'orange') };
  });
}

const keys = (cs: Card[]) => cs.map((c) => c.key).sort();

describe('v2 예시: 정보 2학년 2학기 (점검 전)', () => {
  it('심은 오류 6가지만 빨강·주황으로 잡는다', async () => {
    const [s, ...rest] = await check('정보_2학년_2학기_점검전.hwpx');
    expect(rest).toHaveLength(0);
    expect(s.context).toMatchObject({ subject: '정보', grades: [2], year: 2026, curriculum: '2022' });
    const k = keys(s.serious);
    const has = (prefix: string) => k.filter((x) => x.startsWith(prefix));
    // (a) 코드 오타
    expect(has('J4-typo')).toEqual(['J4-typo:[9장03-03]']);
    // (b) 2015 개정 문장
    expect(has('J5-old')).toEqual(['J5-old:[9정02-01]']);
    // (c) 30점(20%) → 합계 90%
    expect(has('J12-weight-sum')).toHaveLength(1);
    expect(has('J12-public-ratio')).toEqual(['J12-public-ratio:데이터분석프로젝트']);
    // (d) 요약표 20점 ↔ 세부기준 25점
    expect(has('J12-public-max')).toEqual(['J12-public-max:인공지능윤리논술하기논술형']);
    // (e) 수행률(%)·분량 채점기준 두 칸
    expect(has('J7')).toHaveLength(2);
    // (f) 논술형 20%
    expect(has('J13-essay')).toHaveLength(1);
    expect(k).toHaveLength(8);
    expect(s.serious.find((c) => c.key.startsWith('J12-weight-sum'))?.title).toContain('90%');
    expect(s.serious.find((c) => c.key.startsWith('J13-essay'))?.title).toContain('20%');
    const j7 = s.serious.filter((c) => c.rule === 'J7').map((c) => c.highlights?.join(' ')).join(' | ');
    expect(j7).toMatch(/80% 이상 작성/);
    expect(j7).toMatch(/A4 2쪽 이상/);
  });
});

describe('v2 예시: 정보 2학년 2학기 (수정본)', () => {
  it('빨강·주황이 하나도 없다', async () => {
    const [s, ...rest] = await check('정보_2학년_2학기_수정본.hwpx');
    expect(rest).toHaveLength(0);
    expect(s.context.curriculum).toBe('2022');
    expect(s.serious).toEqual([]);
  });

  it('점검 전 문서의 빨강·주황 카드가 모두 해결된다', async () => {
    const [before] = await check('정보_2학년_2학기_점검전.hwpx');
    const [after] = await check('정보_2학년_2학기_수정본.hwpx');
    const now = new Set(after.cards.map((c) => c.key));
    expect(before.serious.filter((c) => now.has(c.key))).toEqual([]);
  });
});

describe('v2 예시: 전 교과 2학년 2학기', () => {
  const SUBJECTS = ['국어', '수학', '영어', '과학', '사회', '역사', '도덕', '기술·가정', '정보', '체육', '음악', '미술'];

  it('12개 교과 구간을 나누고 모두 2022 개정 2학년으로 본다', async () => {
    const res = await check('전과목_2학년_2학기.hwpx');
    expect(res.map((r) => r.section.subject)).toEqual(SUBJECTS);
    for (const r of res) {
      expect(r.context.subject).toBe(r.section.subject);
      expect(r.context.grades).toEqual([2]);
      expect(r.context.curriculum).toBe('2022');
    }
  });

  it('오류를 심은 4개 교과에만 빨강·주황이 있다', async () => {
    const res = await check('전과목_2학년_2학기.hwpx');
    const by = Object.fromEntries(res.map((r) => [r.section.subject, keys(r.serious)]));
    expect(by['수학']).toEqual(['J4-curriculum:[9수04-10]']);
    expect(by['영어']).toHaveLength(1);
    expect(by['영어'][0]).toMatch(/^J12-weight-sum/);
    expect(res.find((r) => r.section.subject === '영어')!.serious[0].title).toContain('110%');
    expect(by['과학']).toEqual(['J4-typo:[9고14-02]']);
    expect(by['사회']).toHaveLength(1);
    expect(by['사회'][0]).toMatch(/^J7:/);
    expect(res.find((r) => r.section.subject === '사회')!.serious[0].highlights).toContain('제출 여부');
    for (const s of SUBJECTS.filter((x) => !['수학', '영어', '과학', '사회'].includes(x))) expect(by[s], s).toEqual([]);
  });
});
