import { describe, expect, it } from 'vitest';
import { buildCalendar, busyWeeks, parseWhen, weekLabel, type CalendarItem } from './schedule';
import { runChecks } from './rules';
import type { Assessment, CheckInput } from './types';

const wk = (s: string) => parseWhen(s).weeks.map(weekLabel);

describe('평가 시기 읽기 (parseWhen)', () => {
  it('한 주, 범위, 여러 주를 읽는다', () => {
    expect(parseWhen('4월 2주')).toMatchObject({ kind: 'week' });
    expect(wk('4월 2주')).toEqual(['4월 2주']);
    expect(wk('3월 3~4주')).toEqual(['3월 3주', '3월 4주']);
    expect(wk('10월 1주 - 2주')).toEqual(['10월 1주', '10월 2주']);
    expect(wk('9월 4주~10월 1주')).toEqual(['9월 4주', '9월 5주', '10월 1주']);
    expect(wk('4월 첫째주/둘째주')).toEqual(['4월 1주', '4월 2주']);
    expect(wk('４월 다섯째주')).toEqual(['4월 5주']);
    expect(wk('6월 5주(7월 1주)')).toEqual(['6월 5주']);
    expect(wk('9월 2주, 9월 3주, 10월 4주')).toEqual(['9월 2주', '9월 3주', '10월 4주']);
  });
  it('학기 내내·상시·달만 적은 것·날짜는 주로 읽지 않는다', () => {
    expect(parseWhen('3월 2주 ~ 6월 3주').kind).toBe('long');
    expect(parseWhen('상시 (3월4주~6월4주)').kind).toBe('always');
    expect(parseWhen('수시').kind).toBe('always');
    expect(parseWhen('10월').kind).toBe('month');
    expect(parseWhen('').kind).toBe('blank');
    expect(parseWhen('-').kind).toBe('blank');
    expect(parseWhen('11월 23일').kind).toBe('month');
    expect(parseWhen('1차').kind).toBe('other');
  });
});

describe('학년 수행평가 달력 (buildCalendar)', () => {
  const it_ = (subject: string, when: string, written = false): CalendarItem => ({ subject, name: `${subject} 평가`, written, when: parseWhen(when), reviewId: subject });
  it('같은 주에 놓인 수행평가를 세고, 정기시험은 세지 않는다', () => {
    const cal = buildCalendar([it_('국어', '4월 1주'), it_('수학', '4월 1주'), it_('영어', '3월 4주~4월 1주'), it_('과학', '4월 1주', true), it_('미술', '상시')]);
    expect(cal.peak && weekLabel(cal.peak.week)).toBe('4월 1주');
    expect(cal.peak?.perf).toBe(3);
    expect(busyWeeks(cal, 3).map((w) => weekLabel(w.week))).toEqual(['4월 1주']);
    expect(cal.unplaced.map((u) => u.subject)).toEqual(['미술']);
  });
});

const A = (name: string, over: Partial<Assessment> = {}): Assessment => ({ id: name, name, elements: [], source: { doc: 'plan', table: 0, row: 0, col: 1 }, ...over });
const base = (over: Partial<CheckInput>): CheckInput => ({
  plan: [],
  rubric: [],
  planStandards: [],
  pairs: {},
  links: [],
  format: 'public',
  context: { subject: '정보', grades: [2], year: 2026, semester: 2, curriculum: '2022', curriculumBasis: 'year-grade' },
  ...over,
});
const keys = (input: CheckInput) => runChecks(input).cards.map((c) => c.key.split(':')[0]);

describe('새 규칙 J15~J18', () => {
  it('J15: 수행평가 시기를 달만 적으면 주황, 주 단위면 통과', () => {
    const plan = [A('보고서', { method: '수행평가', weightPercent: 50, when: '10월' }), A('발표', { method: '수행평가', weightPercent: 50, when: '11월 2주' })];
    const res = runChecks(base({ plan }));
    const c = res.cards.find((x) => x.rule === 'J15');
    expect(c?.severity).toBe('orange');
    expect(c?.title).toContain('1개');
    expect(c?.basis.text).toBe('평가 시기는 주 단위로 구체적으로 제시합니다.');
    const ok = runChecks(base({ plan: [plan[1]] }));
    expect(ok.passed.some((p) => p.rule === 'J15')).toBe(true);
  });
  it('J15: 포트폴리오를 학기 내내로 적은 것은 짚지 않는다', () => {
    const plan = [A('학습 포트폴리오', { method: '수행평가', weightPercent: 100, when: '3월 2주 ~ 6월 3주' })];
    expect(keys(base({ plan }))).not.toContain('J15-long');
  });
  it('J16: AI를 쓰는 수행평가에 기본 원칙이 빠지면 주황, 세 가지가 다 있으면 통과', () => {
    const ai = { uses: [{ text: '생성형 AI를 활용하여 디자인 아이디어 탐색하기', ref: { doc: 'plan' as const, table: 3, row: 2, col: 1 } }], principles: { assist: false, observe: false, forbid: true }, notices: { record: false, exclude: false } };
    const res = runChecks(base({ plan: [A('디자인', { method: '수행평가', weightPercent: 100 })], ai }));
    const c = res.cards.find((x) => x.rule === 'J16');
    expect(c?.severity).toBe('orange');
    expect(c?.title).toContain('2가지');
    expect(c?.insert?.example).toContain('독자적 사고');
    expect(c?.basis.page).toBe('32쪽 Ⅲ.4.9.나');
    // 사용 기록·채점 제외 문구가 없어도 기본 원칙이 다 있으면 통과 (운영 시 안내 예시라 판정에 쓰지 않음)
    const ok = runChecks(base({ plan: [A('디자인')], ai: { ...ai, principles: { assist: true, observe: true, forbid: true } } }));
    expect(ok.cards.some((x) => x.rule === 'J16')).toBe(false);
    expect(ok.passed.some((p) => p.rule === 'J16')).toBe(true);
  });
  it('J17: 지침이 정한 내용 중 찾지 못한 항목만 회색으로', () => {
    const required = [
      { key: 'purpose', label: '평가의 목적', found: true },
      { key: 'transfer', label: '학적변동자 처리 기준', found: false },
    ];
    const c = runChecks(base({ plan: [A('발표', { method: '수행평가' })], required })).cards.find((x) => x.rule === 'J17');
    expect(c?.severity).toBe('gray');
    expect(c?.title).toContain('학적변동자 처리 기준');
    expect(c?.basis.page).toBe('6~7쪽 Ⅲ.3.나 2)');
  });
  it('J18: 정기시험 1회 반영비율 50% 초과와 3회 이상을 짚는다', () => {
    const one = [A('2차(선택형)', { method: '지필', weightPercent: 42 }), A('2차(논술형)', { method: '지필', weightPercent: 18 }), A('보고서', { method: '수행평가', weightPercent: 40 })];
    expect(keys(base({ plan: one }))).toContain('J18-one');
    const ok = [A('2차(선택형)', { method: '지필', weightPercent: 35 }), A('2차(논술형)', { method: '지필', weightPercent: 15 }), A('보고서', { method: '수행평가', weightPercent: 50 })];
    expect(keys(base({ plan: ok }))).not.toContain('J18-one');
    const three = [A('1차', { method: '지필', weightPercent: 20 }), A('2차', { method: '지필', weightPercent: 20 }), A('3차', { method: '지필', weightPercent: 20 }), A('보고서', { method: '수행평가', weightPercent: 40 })];
    expect(keys(base({ plan: three }))).toContain('J18-count');
  });
});

describe('조사 로/으로', () => {
  it('받침 없음·ㄹ받침은 로, 나머지는 으로', async () => {
    const { euro } = await import('./rules');
    expect(euro('제출 여부')).toBe('로');
    expect(euro('과제 수행률')).toBe('로');
    expect(euro('분량')).toBe('으로');
    expect(euro('감점')).toBe('으로');
  });
});
