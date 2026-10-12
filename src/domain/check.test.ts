import { describe, expect, it } from 'vitest';
import { SAMPLES, type SampleId } from '../fixtures';
import { extract, parseNumber, suggestPairs } from './extract';
import { countBySeverity, diffRuns, findDiscouraged, runChecks, J7_SOURCE_TEXT } from './rules';
import { classifyCode } from './standards';
import type { Assessment, CheckInput } from './types';

const ref = { doc: 'plan' as const, table: 0, row: 0, col: 0 };

function inputFor(id: SampleId): CheckInput {
  const s = SAMPLES[id];
  const ex = extract(s.plan, s.rubric);
  return { plan: ex.plan, rubric: ex.rubric, planStandards: ex.planStandards, pairs: suggestPairs(ex.plan, ex.rubric), links: [] };
}
const keys = (id: SampleId) => runChecks(inputFor(id)).cards.map((c) => `${c.severity}:${c.key}`);

describe('만점·배점·반영비율을 섞지 않는다', () => {
  it('"만점 100점, 반영비율 30%"는 불일치로 잡지 않는다', () => {
    expect(parseNumber('만점 100점, 반영비율 30%', '점')).toBe(100);
    expect(parseNumber('만점 100점, 반영비율 30%', '%')).toBe(30);
    const plan: Assessment[] = [
      { id: 'p1', name: '데이터 분석 보고서', method: '수행', maxScore: 100, weightPercent: 30, elements: [{ name: 'A', points: 100, standards: [] }], source: ref },
      { id: 'p2', name: '지필', method: '지필', maxScore: 100, weightPercent: 70, elements: [], source: ref },
    ];
    const rubric: Assessment[] = [
      { id: 'r1', name: '데이터 분석 보고서', elements: [{ name: 'A', points: 60, standards: [] }, { name: 'B', points: 40, standards: [] }], source: { ...ref, doc: 'rubric' } },
    ];
    const { cards } = runChecks({ plan, rubric, planStandards: [], pairs: { r1: 'p1' }, links: [] });
    expect(cards.filter((c) => c.severity === 'red')).toEqual([]);
  });

  it('오류판에서도 반영비율 30%는 비교 대상이 아니다', () => {
    const ex = inputFor('error');
    const report = ex.plan.find((a) => a.name === '데이터 분석 보고서')!;
    expect(report.maxScore).toBe(100);
    expect(report.weightPercent).toBe(30);
    const { cards } = runChecks(ex);
    expect(cards.some((c) => c.severity === 'red' && c.title.includes('데이터 분석 보고서'))).toBe(false);
  });
});

describe('오류판', () => {
  it('기대한 카드가 정확히 나온다', () => {
    expect(keys('error')).toEqual([
      'red:J12-max:프로그래밍프로젝트',
      'red:J4-missing:[9정02-06]',
      'orange:J7:프로그래밍프로젝트:결과공유와개선',
      'gray:J12-elements:데이터분석보고서',
      'gray:J6:[9정05-03]',
      'yellow:S5-reflection',
    ]);
  });

  it('J12 빨강은 만점 30점과 배점 합계 25점을 근거로 든다', () => {
    const card = runChecks(inputFor('error')).cards[0];
    expect(card.title).toContain('30점');
    expect(card.title).toContain('25점');
    expect(card.compare?.filter((r) => r.differs).map((r) => r.label)).toEqual(['만점 / 배점 합계', '결과 공유와 개선']);
  });

  it('J7 주황은 원문 문장과 학교 규정 안내를 붙인다', () => {
    const card = runChecks(inputFor('error')).cards.find((c) => c.rule === 'J7')!;
    expect(card.basis.text).toBe(J7_SOURCE_TEXT);
    expect(card.highlights).toContain('A4 2쪽 이상');
    expect(card.note).toBe('학교 학업성적관리규정도 확인하세요.');
    expect(card.strength).toBe('권고');
  });

  it('정렬 맵에서 연결을 지정하면 J6 카드가 사라진다', () => {
    const input = inputFor('error');
    const project = input.plan.find((a) => a.name === '프로그래밍 프로젝트')!;
    const after = runChecks({ ...input, links: [{ code: '[9정05-03]', assessmentId: project.id }] });
    expect(after.cards.some((c) => c.key === 'J6:[9정05-03]')).toBe(false);
  });
});

describe('수정판', () => {
  it('J12 빨강이 해결됨으로 바뀐다', () => {
    const prev = runChecks(inputFor('error')).cards;
    const curr = runChecks(inputFor('fixed')).cards;
    const d = diffRuns(prev, curr);
    expect(d.resolved.map((c) => c.key)).toContain('J12-max:프로그래밍프로젝트');
    expect(curr.filter((c) => c.severity === 'red')).toEqual([]);
    expect(d.added).toEqual([]);
    expect(d.remaining.map((c) => c.key)).toEqual(['J12-elements:데이터분석보고서', 'S5-reflection']);
  });
});

describe('정상판', () => {
  it('빨강과 주황이 0개다', () => {
    const n = countBySeverity(runChecks(inputFor('normal')).cards);
    expect(n.red).toBe(0);
    expect(n.orange).toBe(0);
    expect(n.gray).toBe(0);
  });
});

describe('J4 코드 확인', () => {
  it('지원 범위 밖 코드는 빨강이 아니라 회색이다', () => {
    expect(classifyCode('[9수01-01]')).toBe('out-of-scope');
    expect(classifyCode('[12정01-01]')).toBe('out-of-scope');
    expect(classifyCode('[9정03-10]')).toBe('not-in-db');
    expect(classifyCode('[9정03-01]')).toBe('valid');
    const plan: Assessment[] = [
      { id: 'p1', name: 'X', elements: [{ name: 'e', points: 10, standards: ['[9수01-01]'] }], source: ref },
    ];
    const { cards } = runChecks({ plan, rubric: [], planStandards: [], pairs: {}, links: [] });
    const c = cards.find((x) => x.key === 'J4-scope:[9수01-01]')!;
    expect(c.severity).toBe('gray');
    expect(c.title).toContain('현재 지원 범위(2022 개정 중학교 정보)에서 확인 불가');
  });
});

describe('세분화된 평가요소', () => {
  it('빨강이 아니라 회색이다', () => {
    const plan: Assessment[] = [
      { id: 'p1', name: '보고서', method: '수행', maxScore: 100, elements: [{ name: '수집과 정리', points: 50, standards: ['[9정02-02]'] }, { name: '해석', points: 50, standards: ['[9정02-04]'] }], source: ref },
    ];
    const rubric: Assessment[] = [
      { id: 'r1', name: '보고서', elements: [{ name: '수집', points: 30, standards: ['[9정02-02]'] }, { name: '정리', points: 20, standards: [] }, { name: '해석', points: 50, standards: ['[9정02-04]'] }], source: { ...ref, doc: 'rubric' } },
    ];
    const { cards } = runChecks({ plan, rubric, planStandards: [], pairs: { r1: 'p1' }, links: [] });
    expect(cards.map((c) => `${c.severity}:${c.key}`).filter((k) => !k.startsWith('yellow'))).toEqual(['gray:J12-elements:보고서']);
  });
});

describe('J7 표현 패턴', () => {
  it('원문에 있는 표현만 잡고 "제출 여부"는 잡지 않는다', () => {
    expect(findDiscouraged('과제 제출 여부에 따라 점수를 줌')).toEqual([]);
    expect(findDiscouraged('A4 2쪽 이상 작성').map((h) => h.label)).toEqual(['분량']);
    expect(findDiscouraged('과제 수행률 80% 이상').map((h) => h.label)).toEqual(['과제 수행률']);
    expect(findDiscouraged('지각 시 1점 감점').map((h) => h.label)).toEqual(['감점']);
    expect(findDiscouraged('출석률 90%').map((h) => h.label)).toContain('출석률');
    expect(findDiscouraged('지적 3회 이상이면 하').map((h) => h.label)).toEqual(['지적 횟수']);
  });
});

describe('반영비율 합계', () => {
  it('100%가 아니면 빨강', () => {
    const plan: Assessment[] = [
      { id: 'p1', name: 'A', weightPercent: 40, elements: [], source: ref },
      { id: 'p2', name: 'B', weightPercent: 50, elements: [], source: ref },
    ];
    const { cards } = runChecks({ plan, rubric: [], planStandards: [], pairs: {}, links: [] });
    expect(cards.find((c) => c.key === 'J12-weight-sum')?.severity).toBe('red');
  });
});
