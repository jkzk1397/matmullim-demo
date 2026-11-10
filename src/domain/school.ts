// 학교 단위로 묶어 보기: 한 파일(전 교과 합본)이나 여러 파일의 같은 학년·학기 계획을 한 달력에,
// 여러 학교 파일(교육청)은 점검 항목별로 센다.
import { buildCalendar, parseWhen, weekIndex, type Calendar, type CalendarItem, type Week } from './schedule';
import { GG_2026_MIDDLE, GG_GUIDE_2026 } from './rulepacks';
import type { RuleId, Severity } from './types';
import type { Review } from './workspace';

export type SchoolCalendar = { id: string; title: string; fileName: string; grade?: number; semester?: number; subjects: string[]; items: CalendarItem[]; cal: Calendar };

const gradeOf = (r: Review) => (r.ex.context?.grades.length === 1 ? r.ex.context.grades[0] : r.section.grades.length === 1 ? r.section.grades[0] : undefined);

function itemsOf(r: Review): CalendarItem[] {
  const subject = r.ex.context?.subject || r.section.subject || '교과 미상';
  return r.ex.plan
    .filter((a) => a.when !== undefined && !/^(합|합계|계|총계|총점)$/.test(a.name.replace(/\s+/g, '')))
    .map((a) => ({ subject, name: a.name.replace(/\s+/g, ' ').trim(), written: a.method === '지필', when: parseWhen(a.when!), reviewId: r.id }));
}

/**
 * 달력 묶음. 파일 안에서 학년·학기가 같은 교과끼리. 교과 하나짜리 파일이 여럿이면(한 학교가 교과별로 따로 올린 경우)
 * 학년·학기가 같은 것끼리 '올린 파일 모두'로도 묶는다. 교과가 둘 이상이어야 달력을 만든다.
 */
export function calendarsFor(reviews: Review[]): SchoolCalendar[] {
  const out: SchoolCalendar[] = [];
  const byFile = new Map<string, Review[]>();
  for (const r of reviews) byFile.set(r.source.id, [...(byFile.get(r.source.id) ?? []), r]);
  const make = (id: string, title: string, fileName: string, rs: Review[], grade?: number, semester?: number) => {
    const items = rs.flatMap(itemsOf);
    const subjects = [...new Set(items.map((i) => i.subject))];
    if (subjects.length < 2) return;
    out.push({ id, title, fileName, grade, semester, subjects, items, cal: buildCalendar(items) });
  };
  for (const [fid, rs] of byFile) {
    const groups = new Map<string, Review[]>();
    for (const r of rs) {
      const k = `${gradeOf(r) ?? '?'}|${r.ex.context?.semester ?? '?'}`;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    for (const [k, g] of groups) {
      const [gr, sem] = k.split('|');
      const grade = gr === '?' ? undefined : Number(gr);
      const semester = sem === '?' ? undefined : Number(sem);
      make(`${fid}#${k}`, label(grade, semester), rs[0].source.name, g, grade, semester);
    }
  }
  // 교과 하나짜리 파일들 (같은 학년·학기). 파일이 너무 많으면 여러 학교일 수 있어 묶지 않는다
  const singles = [...byFile.values()].filter((rs) => rs.length === 1).map((rs) => rs[0]);
  if (singles.length >= 2 && byFile.size <= 20) {
    const groups = new Map<string, Review[]>();
    for (const r of singles) {
      const k = `${gradeOf(r) ?? '?'}|${r.ex.context?.semester ?? '?'}`;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    for (const [k, g] of groups) {
      if (g.length < 2) continue;
      const [gr, sem] = k.split('|');
      const grade = gr === '?' ? undefined : Number(gr);
      const semester = sem === '?' ? undefined : Number(sem);
      make(`singles#${k}`, `${label(grade, semester)} · 올린 파일 ${g.length}개`, '', g, grade, semester);
    }
  }
  return out.sort((a, b) => (b.cal.peak?.perf ?? 0) - (a.cal.peak?.perf ?? 0));
}

/** 달력 칸: 처음 주부터 마지막 주까지 빠짐없이. 5주는 그 달에 5주가 적힌 평가가 있을 때만 */
export function calendarColumns(sc: SchoolCalendar): Week[] {
  const placed = sc.items.flatMap((i) => (i.when.kind === 'week' || i.when.kind === 'range' ? i.when.weeks : []));
  if (!placed.length) return [];
  const idx = placed.map(weekIndex);
  const lo = Math.min(...idx), hi = Math.max(...idx);
  const five = new Set(placed.filter((w) => w.w === 5).map((w) => w.m));
  const out: Week[] = [];
  for (let m = Math.floor(lo / 10); m <= Math.floor(hi / 10); m++) {
    const month = m > 12 ? m - 12 : m;
    for (let w = 1; w <= (five.has(month) ? 5 : 4); w++) {
      const i = m * 10 + w;
      if (i >= lo && i <= hi) out.push({ m: month, w });
    }
  }
  return out;
}

const label = (grade?: number, semester?: number) => `${grade ? `${grade}학년` : '학년 미상'} ${semester ? `${semester}학기` : ''}`.trim();

/** 달력 카드의 근거 */
export const SPREAD_BASIS = {
  source: GG_2026_MIDDLE.source,
  url: GG_2026_MIDDLE.url,
  quotes: [GG_2026_MIDDLE.spread, GG_2026_MIDDLE.spreadPerf],
  guide: { source: GG_GUIDE_2026.source, url: GG_GUIDE_2026.url, ...GG_GUIDE_2026.spread },
};

// ---------- 점검 항목별 현황 (교육청·학교 전체) ----------

export type ItemRow = { id: string; label: string; checklist?: string; rules: (RuleId | 'J12-weight')[]; sections: number; flagged: number; bySev: Record<Severity, number> };

/** 경기도교육청 「평가 계획 수립 및 운영 자체점검표」(이해하기 40쪽) 번호와 맞물림 규칙 */
export const CHECK_ITEMS: { id: string; label: string; checklist?: string; rules: RuleId[] }[] = [
  { id: 'code', label: '성취기준 코드·문장이 고시와 맞는가', checklist: '4', rules: ['J4', 'J5'] },
  { id: 'link', label: '평가 요소가 성취기준에 근거하는가', checklist: '4', rules: ['J6'] },
  { id: 'perf', label: '수행평가·논술형 반영비율 30% 이상', checklist: '5·6', rules: ['J13'] },
  { id: 'sum', label: '반영비율 합계, 영역 만점 = 반영비율', checklist: '13', rules: ['J12'] },
  { id: 'exam', label: '정기시험 학기당 2회 이내, 1회면 50% 이하', rules: ['J18'] },
  { id: 'absence', label: '결시자 처리 기준', checklist: '7·17', rules: ['J14'] },
  { id: 'required', label: '정의적 능력 평가·학적변동자 등 계획에 넣을 내용', checklist: '7·8', rules: ['J17'] },
  { id: 'rubric', label: '채점기준에 수행률·분량·감점·출석률을 쓰지 않았는가', checklist: '18', rules: ['J7'] },
  { id: 'ai', label: 'AI 활용 수행평가에 기본 원칙을 넣었는가', checklist: '16', rules: ['J16'] },
  { id: 'timing', label: '평가 시기를 주 단위로 적었는가', rules: ['J15'] },
];

export function itemRows(reviews: Review[]): ItemRow[] {
  return CHECK_ITEMS.map((it) => {
    const bySev: Record<Severity, number> = { red: 0, orange: 0, gray: 0, yellow: 0 };
    let flagged = 0;
    for (const r of reviews) {
      const cs = r.result.cards.filter((c) => it.rules.includes(c.rule));
      if (cs.length) flagged++;
      for (const c of cs) bySev[c.severity]++;
    }
    return { ...it, sections: reviews.length, flagged, bySev };
  });
}

/** 모든 카드를 CSV로 (교육청이 학교별로 돌려주거나 모아 보는 용도) */
export function cardsCsv(reviews: Review[]): string {
  const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""').replace(/\s+/g, ' ').trim()}"`;
  const SEV: Record<Severity, string> = { red: '확인된 오류', orange: '지침과 다름', gray: '확인 필요', yellow: '제안' };
  const lines = [['파일', '교과', '학년', '학기', '규칙', '종류', '지적', '고치는 법', '근거', '쪽'].join(',')];
  for (const r of reviews) {
    const c0 = r.ex.context;
    for (const c of r.result.cards)
      lines.push([r.source.name, c0?.subject ?? r.section.subject, c0?.grades.join('·') ?? '', String(c0?.semester ?? ''), c.rule, SEV[c.severity], c.title, c.fix ?? '', c.basis.source, c.basis.page ?? ''].map((x) => esc(String(x))).join(','));
  }
  return '﻿' + lines.join('\r\n');
}
