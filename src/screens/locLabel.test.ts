import { describe, expect, it } from 'vitest';
import type { ParsedDocument, ParsedTable } from '../domain/types';
import { balanceParens, locLabel } from './locLabel';

const doc = (...tables: ParsedTable[]): ParsedDocument => ({ doc: 'plan', fileName: 't.hwpx', title: '', tables });
const at = (table: number, row: number, col: number) => ({ doc: 'plan' as const, table, row, col });

describe('locLabel', () => {
  const weekly: ParsedTable = {
    title: '3. 교수·학습 운영 계획',
    rows: [
      ['월', '주', '단원', '성취기준'],
      ['10', '1 [10.5] 대체공휴일 [10.9] 공휴일', '자료와 정보', '[9정02-01] 자료를 수집한다'],
      ['10', '2주', '자료와 정보', '[9정02-02]'],
      ['11', '3~4', '알고리즘', '[9정03-01]'],
    ],
    spans: [],
  };

  it('주 칸에서 첫 숫자만 쓰고 "주"를 두 번 붙이지 않는다', () => {
    expect(locLabel(doc(weekly), at(0, 1, 3))).toBe('교수·학습 운영 계획 › 10월 1주 › 성취기준');
    expect(locLabel(doc(weekly), at(0, 2, 3))).toBe('교수·학습 운영 계획 › 10월 2주 › 성취기준');
    expect(locLabel(doc(weekly), at(0, 3, 2))).toBe('교수·학습 운영 계획 › 11월 3~4주 › 단원');
  });

  it('제목이 머리글 낱말("월")뿐이면 버린다', () => {
    const t = { ...weekly, title: '월' };
    expect(locLabel(doc(t), at(0, 1, 2))).toBe('교수·학습 운영 계획 › 10월 1주 › 단원');
  });

  it('머리글 행을 고치면 "표 머리글"', () => {
    expect(locLabel(doc(weekly), at(0, 0, 2))).toBe('교수·학습 운영 계획 표 머리글');
  });

  it('내용 칸(코드로 시작하거나 긴 문장)은 머리글로 쓰지 않는다', () => {
    const t: ParsedTable = {
      title: '2. 평가 기준',
      rows: [
        ['[9정01-01] 정보 기술이 발달하며 생겨난 사회 변화를 탐색한다', '상', '중'],
        ['[9정01-02]', '사회 변화를 구체적으로 설명할 수 있다', '설명할 수 있다'],
      ],
      spans: [],
    };
    expect(locLabel(doc(t), at(0, 1, 1))).toBe('평가 기준 › 상');
    expect(locLabel(doc(t), at(0, 1, 0))).toBe('평가 기준');
  });

  it('짝이 안 맞는 괄호를 정리한다', () => {
    const t: ParsedTable = {
      title: '1) 평가의 종류와 반영비율',
      rows: [
        ['구분', '영역 만점(반영비율'],
        ['프로그래밍)', '20(20%)'],
      ],
      spans: [],
    };
    expect(locLabel(doc(t), at(0, 1, 1))).toBe('평가의 종류와 반영비율 › 프로그래밍 › 영역 만점 반영비율');
    expect(balanceParens('만점(반영비율)')).toBe('만점(반영비율)');
    expect(balanceParens('(가) 나)')).toBe('(가) 나');
  });

  it('없는 표는 빈 글', () => {
    expect(locLabel(doc(), at(3, 1, 1))).toBe('');
  });
});
