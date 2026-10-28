import { describe, expect, it } from 'vitest';
import { extractPublic, isPublicFormat, readScoreCell, selectSubject, suggestPublicPairs } from './extract-public';
import { findDiscouraged, runChecks, similarity, typoOf } from './rules';
import type { ParsedDocument, ParsedTable } from './types';

const table = (title: string, rows: string[][], spans: ParsedTable['spans'] = []): ParsedTable => ({ title, rows, spans });

// 학교알리미 공시 양식을 흉내 낸 문서 (실제 학교 문서는 저장소에 넣지 않는다)
function publicDoc(opts: { ratio?: string; code?: string; altText?: string; crit?: string } = {}): ParsedDocument {
  const official = '[9정03-04] 사례를 중심으로 문제 해결에 적합한 전략을 선택하여 알고리즘을 설계한다.';
  return {
    doc: 'plan',
    fileName: '공시용.hwpx',
    title: '2026학년도 2학기 1학년 정보과 교수·학습 및 평가 운영 계획',
    tables: [
      table('', [['2026학년도 2학기 1학년 정보과 교수·학습 및 평가 운영 계획']]),
      table('1. 교수·학습 운영 계획', [['월', '주', '성취기준'], ['9', '1', official]]),
      table('4. 평가의 종류와 반영비율', [
        ['평가 종류', '수행평가', '수행평가', '수행평가', '합계'],
        ['영역', '알고리즘 설계하기', '프로그래밍', '인공지능 프로젝트', ''],
        ['영역 만점(반영비율)', '20점(20%)', opts.ratio ?? '30점(30%)', '50점(50%)', '100%'],
        ['성취기준', '[9정03-04]', opts.code ?? '[9정03-08]', '[9정04-04]', ''],
        ['평가 요소', '• 알고리즘 작성하기', '• 프로그램 작성하기', '• 문제 정의하기', ''],
      ]),
      table('6. 수행평가 세부기준', [['평가 영역명', '알고리즘 설계하기', '영역 만점', '20점'], ['성취기준', opts.altText ? `[9정03-04] ${opts.altText}` : official, '', '']]),
      table('', [
        ['평가요소', '수행 수준(채점 기준)', '배점'],
        ['알고리즘 작성', opts.crit ?? '문제 해결 전략을 선택해 알고리즘을 순서도로 정확히 표현함', '10'],
        ['기본점수', '수행평가에 참여한 학생', '10'],
      ]),
    ],
  };
}

const check = (doc: ParsedDocument) => {
  const ex = extractPublic(doc);
  return runChecks({ plan: ex.plan, rubric: ex.rubric, planStandards: ex.planStandards, codeTexts: ex.codeTexts, pairs: suggestPublicPairs(ex.plan, ex.rubric), links: [], format: 'public' });
};

describe('공시 양식 읽기', () => {
  it('첫 열 머리글 요약표를 평가 목록으로 읽는다', () => {
    const doc = publicDoc();
    expect(isPublicFormat(doc)).toBe(true);
    const ex = extractPublic(doc);
    expect(ex.plan.map((a) => [a.name, a.maxScore, a.weightPercent])).toEqual([
      ['알고리즘 설계하기', 20, 20],
      ['프로그래밍', 30, 30],
      ['인공지능 프로젝트', 50, 50],
    ]);
    expect(ex.rubric[0].name).toBe('알고리즘 설계하기');
    expect(ex.rubric[0].maxScore).toBe(20);
  });

  it('정상 문서에서는 빨강·주황이 없다', () => {
    const cards = check(publicDoc()).cards.filter((c) => c.severity === 'red' || c.severity === 'orange');
    expect(cards).toEqual([]);
  });

  it('안내 문구가 앞에 붙은 칸은 마지막 점(%)을 읽는다', () => {
    expect(readScoreCell('한 영역의 반영 비율이 30%를 초과할 수 없음! 20점(20%)')).toEqual({ max: 20, weight: 20 });
    expect(readScoreCell('90점 (36%)')).toEqual({ max: 90, weight: 36 });
  });

  it('여러 교과가 든 문서에서 정보과 부분만 고른다', () => {
    const doc = publicDoc();
    const multi: ParsedDocument = { ...doc, tables: [table('', [['2026학년도 2학기 1학년 국어과 교수·학습 및 평가 운영 계획']]), table('', [['영역 만점(반영비율)', '50점(50%)', '60점(60%)']]), ...doc.tables] };
    const { ranges } = selectSubject(multi, '정보');
    expect(ranges).toEqual([[2, multi.tables.length]]);
    expect(extractPublic(multi, '정보').plan).toHaveLength(3);
  });
});

describe('공시 양식 점검', () => {
  it('만점 30점인데 반영비율 20% → 반영비율 합계 90%와 비율 어긋남', () => {
    const keys = check(publicDoc({ ratio: '30점(20%)' })).cards.map((c) => c.key);
    expect(keys.some((k) => k.startsWith('J12-weight-sum'))).toBe(true);
    expect(keys).toContain('J12-public-ratio:프로그래밍');
  });

  it('코드 오타 [9장03-08]을 [9정03-08]로 짚는다', () => {
    expect(typoOf('[9장03-08]')).toBe('[9정03-08]');
    expect(typoOf('[09정02-01]')).toBe('[9정02-01]');
    expect(typoOf('[9국03-08]')).toBeNull();
    const card = check(publicDoc({ code: '[9장03-08]' })).cards.find((c) => c.key === 'J4-typo:[9장03-08]');
    expect(card?.severity).toBe('red');
  });

  it('같은 코드를 다른 문장으로도 적으면 J5', () => {
    const cards = check(publicDoc({ altText: '사용할 프로그래밍 언어의 개발 환경 및 특성을 이해한다.' })).cards;
    expect(cards.some((c) => c.key === 'J5:[9정03-04]')).toBe(true);
  });

  it('채점기준을 수행률(%)로 쓰면 J7, 문제 지문의 %나 프로그램 속 감점은 잡지 않는다', () => {
    expect(findDiscouraged('목적지에 80% 정도 도달함').map((h) => h.label)).toEqual(['과제 수행률']);
    expect(findDiscouraged('<조건> 65세 이상일 경우 성인요금에서 50% 할인')).toEqual([]);
    expect(findDiscouraged('충돌 시 점수 변수에서 5점 감점 알고리즘을 구현함')).toEqual([]);
    const cards = check(publicDoc({ crit: '결과물을 활동지에 80% 이상 작성함' })).cards;
    expect(cards.some((c) => c.rule === 'J7')).toBe(true);
  });

  it('문장 유사도', () => {
    expect(similarity('문제의 상태를 정의하고 수행 가능한 형태로 구조화한다.', '문제의 상태를 정의하고 수행 가능한 형태로 구조화한다')).toBeGreaterThan(0.95);
    expect(similarity('문제의 상태를 정의한다', '센서를 이용한 자료 처리')).toBeLessThan(0.3);
  });
});
