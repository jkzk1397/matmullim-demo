// 점검 규칙. 모두 결정적 코드다 (LLM 호출 없음). 같은 입력이면 같은 결과.
import { normalizeName } from './extract';
import { classifyCode, curriculumFor, curriculumLabel, dbSource, lookupStandard, standardsFor, typoOf, type CodeContext, type Curriculum } from './standards';
import type { DocContext } from './context';
import { GG_AUDIT, packFor } from './rulepacks';
import type {
  Assessment,
  Card,
  CellRef,
  CheckInput,
  CheckResult,
  CompareRow,
  PassedCheck,
  Severity,
} from './types';

// ---------- 근거 원문 ----------

export const GG_2026 = '경기도교육청 「2026학년도 중등 학생평가 및 학업성적관리 이해하기」';
export const J7_SOURCE_TEXT =
  '수행 수준(채점기준)을 과제 수행률(%), 분량, 감점, 지적 횟수, 출석률 등으로 제시하는 것은 지양합니다.';
export const J7_PAGE = '인쇄 31쪽(중학교 예시) — 원문 대조 후 확정';
export const SCHOOL_RULE_NOTE = '학교 학업성적관리규정도 확인하세요.';
/** 문맥이 없으면(팀이 만든 예시 문서) 2022 개정 중학교 정보로 본다 */
const DEFAULT_CTX: DocContext = { subject: '정보', grades: [], curriculum: '2022', curriculumBasis: 'unknown' };
export const ctxOf = (input: CheckInput): DocContext => input.context ?? DEFAULT_CTX;
const codeCtx = (c: DocContext): CodeContext => ({ subject: c.subject, curriculum: c.curriculum });
const applied = (c: DocContext): Curriculum | undefined => (c.curriculum === '2015' || c.curriculum === '2022' ? c.curriculum : undefined);
const sourceOf = (c: DocContext) => dbSource(applied(c) ?? '2022', c.subject);
const gradeLabel = (c: DocContext, g?: number) => (c.year && (g || c.grades.length) ? `${c.year}학년도 ${g ?? c.grades.join('·')}학년` : '이 문서');
/** 이 칸이 속한 학년의 적용 교육과정 (학년도·학년을 확실히 알 때만) */
function curAt(c: DocContext, at?: CellRef): { cur?: Curriculum; grade?: number } {
  if (c.curriculumBasis !== 'year-grade' || !c.year) return { cur: applied(c) };
  const g = at && c.tableGrades ? c.tableGrades[at.table] : c.grades.length === 1 ? c.grades[0] : undefined;
  if (!g) return { cur: applied(c) };
  if (at && reliable && !reliable.has(at.table)) return { cur: undefined };
  return { cur: curriculumFor(c.year, g), grade: g };
}

/**
 * 학년 표지를 잘못 따라간 표를 걸러 낸다: 표 안의 성취기준 대부분이 그 학년의 적용 교육과정과 맞을 때만
 * 그 표에서 '다른 교육과정' 판정을 한다. 실제 실수는 대개 맞는 코드들 사이에 한두 개 섞여 있다.
 */
let reliable: Set<number> | null = null;
function computeReliable(input: CheckInput) {
  reliable = null;
  const c = ctxOf(input);
  if (c.curriculumBasis !== 'year-grade' || !c.year) return;
  const score = new Map<number, { ok: number; bad: number }>();
  const bump = (t: number, k: 'ok' | 'bad') => { const v = score.get(t) ?? { ok: 0, bad: 0 }; v[k]++; score.set(t, v); };
  const expected = (t: number) => {
    const g = c.tableGrades ? c.tableGrades[t] : c.grades.length === 1 ? c.grades[0] : undefined;
    return g ? curriculumFor(c.year!, g) : undefined;
  };
  for (const ct of input.codeTexts ?? []) {
    const cur = expected(ct.ref.table);
    if (!cur) continue;
    const here = lookupStandard(ct.code, cur), there = lookupStandard(ct.code, cur === '2022' ? '2015' : '2022');
    if (here && similarity(ct.text, here.text) >= 0.85) bump(ct.ref.table, 'ok');
    else if (there && similarity(ct.text, there.text) >= 0.85) bump(ct.ref.table, 'bad');
  }
  const codes: { code: string; ref: CellRef }[] = [...input.planStandards];
  for (const a of [...input.plan, ...input.rubric]) for (const e of a.elements) if (e.refs?.standards) for (const code of e.standards) codes.push({ code, ref: e.refs.standards });
  for (const { code, ref } of codes) {
    const cur = expected(ref.table);
    if (!cur) continue;
    const here = lookupStandard(code, cur), there = lookupStandard(code, cur === '2022' ? '2015' : '2022');
    if (here && !there) bump(ref.table, 'ok');
    else if (!here && there) bump(ref.table, 'bad');
  }
  if (!c.tableGrades) {
    // 한 학년 문서: 문서 전체가 대체로 맞으면 모든 표를 믿는다
    let ok = 0, bad = 0;
    score.forEach((v) => { ok += v.ok; bad += v.bad; });
    reliable = ok >= 3 && ok >= 3 * bad ? new Set(score.keys()) : new Set();
    // 코드가 없는 표(요약표 등)도 같은 학년
    if (ok >= 3 && ok >= 3 * bad) for (const a of [...input.plan, ...input.rubric]) reliable.add(a.source.table);
    return;
  }
  reliable = new Set([...score.entries()].filter(([, v]) => v.ok >= 2 && v.ok >= 3 * v.bad).map(([t]) => t));
}

// ---------- 정렬 맵 ----------

export type LinkVia = 'plan' | 'rubric' | 'manual' | null;
export type AlignmentRow = {
  code: string;
  text: string;
  inDb: boolean;
  ref: CellRef;
  cells: { assessmentId: string; via: LinkVia }[];
  linked: boolean;
};

export function buildAlignment(input: CheckInput): AlignmentRow[] {
  const { plan, rubric, planStandards, pairs, links } = input;
  return planStandards.map((s) => {
    const cells = plan.map((a) => {
      let via: LinkVia = null;
      if (a.elements.some((e) => e.standards.includes(s.code))) via = 'plan';
      else if (rubric.some((r) => pairs[r.id] === a.id && r.elements.some((e) => e.standards.includes(s.code)))) via = 'rubric';
      else if (links.some((l) => l.code === s.code && l.assessmentId === a.id)) via = 'manual';
      return { assessmentId: a.id, via };
    });
    const db = lookupStandard(s.code, applied(ctxOf(input))) ?? lookupStandard(s.code);
    return { code: s.code, text: db?.text ?? s.text, inDb: !!db, ref: s.ref, cells, linked: cells.some((c) => c.via) };
  });
}

// ---------- 규칙 ----------

const sum = (xs: (number | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const fmt = (n: number | undefined, unit: string) => (n === undefined ? '—' : `${n}${unit}`);
const isWritten = (a: Assessment) => /지필/.test(a.method ?? '');

function j12(input: CheckInput, cards: Card[], passed: PassedCheck[]) {
  const { plan, rubric, pairs } = input;

  // (1) 반영비율 합계 — 평가계획 안에서만 본다. 공시 양식은 요약표(학년·학기)마다 따로 본다.
  const groups = new Map<number | 'all', Assessment[]>();
  for (const a of plan) {
    const k = input.format === 'public' ? a.source.table : 'all';
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  for (const [gk, group] of groups) {
    const weighted = group.filter((a) => a.weightPercent !== undefined);
    if (!weighted.length) continue;
    // 공시 양식에서 반영비율이 빠진 칸(정기시험 비율을 다른 줄에 적은 표 등)이 있으면 합계를 판정하지 않는다.
    if (input.format === 'public' && (weighted.length !== group.length || weighted.length < 2 || group.some((a) => a.incomplete))) continue;
    const total = sum(weighted.map((a) => a.weightPercent));
    if (Math.abs(total - 100) > 1e-9) {
      cards.push({
        key: gk === 'all' ? 'J12-weight-sum' : `J12-weight-sum:${gk}`,
        rule: 'J12',
        severity: 'red',
        strength: '사실',
        title: `반영비율 합계가 ${total}%예요 (100%가 아님)`,
        locations: weighted.map((a) => a.refs?.weightPercent ?? a.source),
        quote: weighted.map((a) => `${a.name} ${fmt(a.weightPercent, '%')}`).join(' + ') + ` = ${total}%`,
        basis: { source: input.format === 'public' ? '같은 문서 안 대조 · 사실 확인' : '두 문서 대조 · 사실 확인', text: '평가계획의 학기 반영비율은 모두 더해 100%여야 합니다.' },
        actions: ['fix', 'memo'],
        fix: `반영비율을 더해 100%가 되게 고치세요. 지금은 ${total - 100 > 0 ? `${total - 100}%p 많아요` : `${100 - total}%p 모자라요`}.`,
      });
    } else passed.push({ rule: 'J12-weight', label: '반영비율 합계', detail: `${weighted.length}개 평가 합계 100%` });
  }

  if (input.format === 'public') return j12Public(input, cards, passed);

  // (2) 짝지은 평가: 만점 vs 채점기준표 배점 합계
  let okPairs = 0;
  for (const r of rubric) {
    const p = plan.find((x) => x.id === pairs[r.id]);
    if (!p) {
      cards.push({
        key: `J12-unpaired-rubric:${normalizeName(r.name)}`,
        rule: 'J12',
        severity: 'gray',
        strength: '사실',
        title: `채점기준표의 ‘${r.name}’과 짝을 이루는 평가를 찾지 못했어요`,
        locations: [r.source],
        quote: `채점기준표 평가명: ${r.name}`,
        basis: { source: '두 문서 대조 · 연결 확인', text: '이름이 달라 자동으로 짝짓지 못했어요. 확인 화면에서 같은 평가를 지정하면 배점을 비교합니다.' },
        actions: ['link', 'memo'],
        fix: '확인 화면의 ‘같은 평가 짝짓기’에서 평가계획의 평가를 골라 주세요.',
      });
      continue;
    }
    const rubricTotal = sum(r.elements.map((e) => e.points));
    const hasPoints = r.elements.some((e) => e.points !== undefined);
    const compare = compareRows(p, r);

    if (p.maxScore !== undefined && hasPoints && rubricTotal !== p.maxScore) {
      const diffEls = p.elements.flatMap((pe) => {
        const re = r.elements.find((x) => normalizeName(x.name) === normalizeName(pe.name));
        return re && re.points !== pe.points ? [{ pe, re }] : [];
      });
      const pts = (els: typeof p.elements) => els.map((e) => e.refs?.points).filter((x): x is CellRef => !!x);
      cards.push({
        key: `J12-max:${normalizeName(p.name)}`,
        rule: 'J12',
        severity: 'red',
        strength: '사실',
        title: `‘${p.name}’ 만점은 ${p.maxScore}점인데 채점기준표 배점 합계는 ${rubricTotal}점이에요`,
        locations: [p.refs?.maxScore ?? p.source, ...pts(p.elements), ...pts(r.elements)],
        emphasis: [p.refs?.maxScore ?? p.source, ...diffEls.flatMap(({ pe, re }) => [pe.refs?.points, re.refs?.points]).filter((x): x is CellRef => !!x)],
        fix:
          `채점기준표 배점을 더해 ${p.maxScore}점이 되게 하거나, 평가계획 만점을 ${rubricTotal}점으로 고치세요.` +
          diffEls.map(({ pe, re }) => ` ‘${pe.name}’ 배점이 평가계획 ${fmt(pe.points, '점')}, 채점기준표 ${fmt(re.points, '점')}로 달라요.`).join(''),
        quote: `평가계획서 만점 ${p.maxScore}점 · 채점기준표 배점 ${r.elements.map((e) => fmt(e.points, '')).join(' + ')} = ${rubricTotal}점`,
        basis: {
          source: '두 문서 대조 · 사실 확인',
          text: '교사가 같은 평가로 짝지은 두 문서에서, 평가계획의 만점과 채점기준표 배점의 합은 같아야 합니다. 반영비율(%)은 비교에 쓰지 않습니다.',
        },
        actions: ['fix', 'memo'],
        compare,
      });
    } else if (p.maxScore !== undefined && hasPoints) okPairs++;

    // (3) 평가요소 이름·개수 — 세분화 가능성이 있어 회색
    const pn = p.elements.map((e) => normalizeName(e.name)).sort();
    const rn = r.elements.map((e) => normalizeName(e.name)).sort();
    if (pn.join('|') !== rn.join('|')) {
      const finer = r.elements.length > p.elements.length ? '채점기준표가 더 잘게 나눴을 수 있어요.' : r.elements.length < p.elements.length ? '평가계획이 더 잘게 나눴을 수 있어요.' : '이름만 다를 수 있어요.';
      cards.push({
        key: `J12-elements:${normalizeName(p.name)}`,
        rule: 'J12',
        severity: 'gray',
        strength: '사실',
        title: `‘${p.name}’ 평가요소 구성이 달라요 (평가계획 ${p.elements.length}개 · 채점기준표 ${r.elements.length}개)`,
        locations: [...p.elements, ...r.elements].map((e) => e.refs?.name).filter((x): x is CellRef => !!x),
        quote: `평가계획: ${p.elements.map((e) => e.name).join(', ')}\n채점기준표: ${r.elements.map((e) => e.name).join(', ')}`,
        basis: { source: '두 문서 대조 · 연결 확인', text: `${finer} 오류로 단정하지 않고 두 문서가 같은 내용을 가리키는지 확인을 요청합니다.` },
        actions: ['memo', 'fix'],
        fix: '같은 내용을 나눈 것이라면 이유를 메모하고 넘기세요. 다른 내용이라면 두 문서의 평가요소를 맞추세요.',
        compare,
      });
    }

    // (4) 성취기준 목록 대응
    const ps = new Set(p.elements.flatMap((e) => e.standards));
    const rs = new Set(r.elements.flatMap((e) => e.standards));
    const onlyP = [...ps].filter((c) => !rs.has(c));
    const onlyR = [...rs].filter((c) => !ps.has(c));
    if (onlyP.length || onlyR.length) {
      cards.push({
        key: `J12-standards:${normalizeName(p.name)}`,
        rule: 'J12',
        severity: 'gray',
        strength: '사실',
        title: `‘${p.name}’ 성취기준 목록이 두 문서에서 서로 대응하지 않아요`,
        locations: [...p.elements, ...r.elements].map((e) => e.refs?.standards).filter((x): x is CellRef => !!x),
        quote: [onlyP.length ? `평가계획에만: ${onlyP.join(' ')}` : '', onlyR.length ? `채점기준표에만: ${onlyR.join(' ')}` : ''].filter(Boolean).join('\n'),
        basis: { source: '두 문서 대조 · 연결 확인', text: '같은 평가라면 두 문서의 성취기준 코드가 대응해야 합니다. 한쪽에서 일부만 적었을 수 있어 확인을 요청합니다.' },
        actions: ['fix', 'memo'],
        fix: `두 문서에 같은 성취기준 코드를 적으세요.${onlyP.length ? ` 채점기준표에 ${onlyP.join(' ')}이(가) 없어요.` : ''}${onlyR.length ? ` 평가계획에 ${onlyR.join(' ')}이(가) 없어요.` : ''}`,
        compare,
      });
    }
  }

  // (5) 평가계획의 수행평가 중 채점기준표에 짝이 없는 것 (지필은 제외)
  for (const p of plan) {
    if (isWritten(p)) continue;
    if (!/수행/.test(p.method ?? '수행')) continue;
    if (Object.values(pairs).includes(p.id)) continue;
    cards.push({
      key: `J12-unpaired-plan:${normalizeName(p.name)}`,
      rule: 'J12',
      severity: 'gray',
      strength: '사실',
      title: `평가계획의 ‘${p.name}’에 해당하는 채점기준표를 찾지 못했어요`,
      locations: [p.source],
      quote: `평가계획서 평가명: ${p.name} (${p.method ?? '수행'})`,
      basis: { source: '두 문서 대조 · 연결 확인', text: '수행평가는 채점기준표와 짝을 이뤄야 배점을 비교할 수 있습니다. 확인 화면에서 짝을 지정하세요.' },
      actions: ['link', 'memo'],
      fix: '채점기준표에 이 평가가 있다면 확인 화면에서 짝을 지정하고, 없다면 채점기준표를 함께 올려 주세요.',
    });
  }
  if (okPairs) passed.push({ rule: 'J12', label: '만점 = 배점 합계', detail: `짝지은 ${okPairs}개 평가 일치` });
}

/**
 * 공시 양식(한 파일): 요약표의 영역 만점과 수행평가 세부기준의 영역 만점을 대조한다.
 * 요약표에서 한 영역을 두 칸으로 나눈 경우(예: 프로그램 논술 20 + 프로그램 작성 20 = 40)는 이름이 같은 칸을 더한다.
 */
function j12Public(input: CheckInput, cards: Card[], passed: PassedCheck[]) {
  let ok = 0;
  const perf = input.plan.filter((a) => a.method !== '지필');
  for (const r of input.rubric) {
    if (r.maxScore === undefined || !r.name) continue;
    const rn = normalizeName(r.name);
    if (rn.length < 2) continue;
    const base = (n: string) => normalizeName(n.replace(/\s*\(\d+\)$/, ''));
    const exact = perf.filter((p) => base(p.name) === rn);
    const all = exact.length ? exact : perf.filter((p) => base(p.name).startsWith(rn));
    if (!all.length || all.some((p) => p.maxScore === undefined)) continue;
    // 학년별 요약표가 여러 개면 같은 이름이 표마다 있을 수 있다: 어느 한 표에서라도 맞으면 통과
    const byT = new Map<number, Assessment[]>();
    for (const p of all) byT.set(p.source.table, [...(byT.get(p.source.table) ?? []), p]);
    if ([...byT.values()].some((g) => sum(g.map((p) => p.maxScore)) === r.maxScore)) { ok++; continue; }
    const parts = [...byT.values()][0];
    // 요약표가 모든 영역을 100점 척도로 쓰고 반영비율로 환산하는 양식이면 비교하지 않는다
    if (parts.every((p) => p.maxScore === 100) && perf.filter((p) => p.source.table === parts[0].source.table).every((p) => p.maxScore === 100)) continue;
    const total = sum(parts.map((p) => p.maxScore));
    cards.push({
      key: `J12-public-max:${rn}`,
      rule: 'J12',
      severity: 'red',
      strength: '사실',
      title: `‘${r.name}’ 영역 만점이 요약표 ${total}점, 세부기준 ${r.maxScore}점으로 달라요`,
      locations: [...parts.map((p) => p.refs?.maxScore ?? p.source), r.refs?.maxScore ?? r.source],
      quote: `평가 요약표: ${parts.map((p) => `${p.name} ${fmt(p.maxScore, '점')}`).join(' + ')}\n수행평가 세부기준: ${r.name} 영역 만점 ${r.maxScore}점`,
      basis: { source: '같은 문서 안 대조 · 사실 확인', text: '한 계획서 안에서 같은 평가 영역의 만점은 요약표와 세부기준이 같아야 합니다.' },
      actions: ['fix', 'memo'],
      fix: `요약표와 세부기준 중 한쪽을 고쳐 ${r.name}의 만점을 맞추세요.`,
    });
  }
  // 만점과 반영비율이 1:1로 쓰인 표에서 한 칸만 어긋난 경우 (예: 30점(20%))
  const byTable = new Map<number, Assessment[]>();
  for (const a of input.plan) byTable.set(a.source.table, [...(byTable.get(a.source.table) ?? []), a]);
  for (const [, as] of byTable) {
    if (as.some((a) => a.incomplete)) continue;
    const both = as.filter((a) => a.method !== '지필' && a.maxScore !== undefined && a.weightPercent !== undefined);
    if (both.length < 3) continue;
    const same = both.filter((a) => a.maxScore === a.weightPercent);
    const off = both.filter((a) => a.maxScore !== a.weightPercent);
    if (off.length !== 1 || same.length < 2) continue;
    const a = off[0];
    cards.push({
      key: `J12-public-ratio:${normalizeName(a.name)}`,
      rule: 'J12',
      severity: 'red',
      strength: '사실',
      title: `‘${a.name}’만 만점 ${a.maxScore}점과 반영비율 ${a.weightPercent}%가 달라요`,
      locations: [a.refs?.maxScore ?? a.source],
      quote: both.map((x) => `${x.name} ${fmt(x.maxScore, '점')}(${fmt(x.weightPercent, '%')})`).join(' · '),
      basis: { source: '같은 문서 안 대조 · 사실 확인', text: '같은 표의 다른 영역은 모두 만점과 반영비율이 같게 적혀 있습니다. 한 칸만 다르면 숫자를 옮겨 적다 생긴 차이일 수 있습니다.' },
      actions: ['fix', 'memo'],
      fix: `${a.name}의 만점과 반영비율 중 맞는 값을 확인해 고치세요.`,
    });
  }
  if (ok) passed.push({ rule: 'J12', label: '요약표 만점 = 세부기준 만점', detail: `${ok}개 영역 일치` });
}

/** 두 문서를 나란히 비교할 줄. 다른 값만 differs=true. */
function compareRows(p: Assessment, r: Assessment): CompareRow[] {
  const rows: CompareRow[] = [];
  const rTotal = sum(r.elements.map((e) => e.points));
  rows.push({ label: '만점 / 배점 합계', plan: fmt(p.maxScore, '점'), rubric: `${rTotal}점`, differs: p.maxScore !== undefined && p.maxScore !== rTotal });
  const used = new Set<number>();
  for (const pe of p.elements) {
    const idx = r.elements.findIndex((re, i) => !used.has(i) && normalizeName(re.name) === normalizeName(pe.name));
    if (idx >= 0) {
      used.add(idx);
      const re = r.elements[idx];
      rows.push({ label: pe.name, plan: fmt(pe.points, '점'), rubric: fmt(re.points, '점'), differs: pe.points !== re.points });
    } else rows.push({ label: pe.name, plan: fmt(pe.points, '점'), rubric: undefined, differs: true });
  }
  r.elements.forEach((re, i) => {
    if (!used.has(i)) rows.push({ label: re.name, plan: undefined, rubric: fmt(re.points, '점'), differs: true });
  });
  rows.push({ label: '반영비율 (비교하지 않음)', plan: fmt(p.weightPercent, '%'), rubric: '—', differs: false });
  return rows;
}

export { typoOf } from './standards';

function j4(input: CheckInput, cards: Card[], passed: PassedCheck[]) {
  const ctx = ctxOf(input);
  const cc = codeCtx(ctx);
  const cur = applied(ctx);
  const where = new Map<string, CellRef[]>();
  const add = (code: string, at?: CellRef) => {
    if (!where.has(code)) where.set(code, []);
    if (at && !where.get(code)!.some((x) => x.table === at.table && x.row === at.row && x.col === at.col)) where.get(code)!.push(at);
  };
  input.planStandards.forEach((s) => add(s.code, s.ref));
  (input.codeTexts ?? []).forEach((s) => add(s.code, s.ref));
  for (const a of [...input.plan, ...input.rubric]) for (const e of a.elements) for (const c of e.standards) add(c, e.refs?.standards);

  let valid = 0;
  for (const [code, allLocs] of where) {
    // 학년별로 적용 교육과정이 다를 수 있어 칸마다 판정한다
    const per = allLocs.map((l) => ({ l, ...curAt(ctx, l) }));
    const bad = per.filter((p) => classifyCode(code, { subject: ctx.subject, curriculum: p.cur }) !== 'valid');
    if (!bad.length && allLocs.length) { valid++; continue; }
    const locs = bad.length ? bad.map((b) => b.l) : allLocs;
    const st = classifyCode(code, { subject: ctx.subject, curriculum: bad[0]?.cur ?? cc.curriculum });
    if (st === 'valid') { valid++; continue; }
    const grade = bad[0]?.grade;
    const curHere = bad[0]?.cur ?? cur;
    const typo = st === 'other-subject' ? null : typoOf(code, cc);
    if (typo) {
      const t = lookupStandard(typo, cur) ?? lookupStandard(typo)!;
      cards.push({
        key: `J4-typo:${code}`,
        rule: 'J4',
        severity: 'red',
        strength: '사실',
        title: `${code}는 ${typo}를 잘못 적은 것 같아요`,
        locations: locs,
        quote: `문서에 적힌 코드: ${code}\n가까운 코드: ${typo} ${t.text}`,
        basis: { source: dbSource(t.curriculum, t.subject), page: t.page ? `PDF ${t.page}쪽` : undefined, text: `${code}라는 코드는 없습니다. 한 글자만 다른 ${typo}가 ${curriculumLabel(t.curriculum)} 중학교 ${t.subject} 성취기준에 있습니다.` },
        actions: ['fix', 'memo'],
        fix: `${typo}로 고치세요.`,
        replace: { from: code, to: typo },
      });
      continue;
    }
    if (st === 'other-curriculum' && curHere) {
      const other = lookupStandard(code)!;
      const sure = ctx.curriculumBasis === 'year-grade' && !!grade;
      cards.push({
        key: `J4-curriculum:${code}`,
        rule: 'J4',
        severity: sure ? 'red' : 'gray',
        strength: '사실',
        title: `${code}는 ${curriculumLabel(other.curriculum)} 교육과정에만 있는 코드예요`,
        locations: locs,
        quote: `문서에 적힌 코드: ${code} (${curriculumLabel(other.curriculum)}: ${other.text})`,
        basis: {
          source: dbSource(curHere, ctx.subject),
          text: sure
            ? `${gradeLabel(ctx, grade)}은 ${curriculumLabel(curHere)} 교육과정을 적용합니다(중학교 2022 개정: 2025학년도 1학년부터 한 학년씩). ${curriculumLabel(curHere)} ${ctx.subject} 성취기준에는 이 코드가 없습니다.`
            : `이 문서의 다른 성취기준은 ${curriculumLabel(curHere)} 문장과 같은데, 이 코드는 ${curriculumLabel(other.curriculum)}에만 있습니다.`,
        },
        actions: ['fix', 'memo'],
        fix: `${curriculumLabel(curHere)} ${ctx.subject} 성취기준 코드로 고치세요.`,
      });
      continue;
    }
    if (st === 'not-in-db') {
      const pool = curHere ? standardsFor(ctx.subject ?? '', curHere) : [];
      const prefix = code.slice(0, code.length - 3);
      const siblings = pool.filter((s) => s.code.startsWith(prefix)).map((s) => s.code);
      const label = curHere ? `${curriculumLabel(curHere)} 중학교 ${ctx.subject}` : `중학교 ${ctx.subject ?? ''}`;
      cards.push({
        key: `J4-missing:${code}`,
        rule: 'J4',
        severity: 'red',
        strength: '사실',
        title: `${code}는 ${label} 성취기준에 없는 코드예요`,
        locations: locs,
        quote: `문서에 적힌 코드: ${code}`,
        basis: {
          source: sourceOf(ctx),
          text: siblings.length
            ? `같은 영역에는 ${siblings[0]}~${siblings[siblings.length - 1]}(${siblings.length}개)만 있습니다.`
            : `2015·2022 개정 중학교 성취기준 어디에도 이 코드가 없습니다.`,
        },
        actions: ['fix', 'memo'],
        fix: siblings.length ? `같은 영역 코드(${siblings[0]}~${siblings[siblings.length - 1]}) 중 이 평가가 다루는 코드로 고치세요.` : `${label} 성취기준 코드로 고치세요.`,
      });
      continue;
    }
    // 다른 교과 코드(융합 수업)나 고교·학교자율시간 과목 코드는 오류로 보지 않는다.
    if (input.format === 'public' || st === 'other-subject') continue;
    cards.push({
      key: `J4-scope:${code}`,
      rule: 'J4',
      severity: 'gray',
      strength: '사실',
      title: `${code}는 중학교 교과 성취기준 코드 모양이 아니에요`,
      locations: locs,
      quote: `문서에 적힌 코드: ${code}`,
      basis: { source: sourceOf(ctx), text: '고교 과목, 학교자율시간 과목 등 중학교 교과 DB 밖의 코드는 실재 여부를 판정하지 않습니다.' },
      actions: ['memo'],
      fix: '의도한 코드라면 메모하고 넘기세요.',
    });
  }
  if (valid && !cards.some((c) => c.rule === 'J4' && c.severity === 'red'))
    passed.push({ rule: 'J4', label: '성취기준 코드 실재', detail: `코드 ${valid}개 모두 ${cur ? curriculumLabel(cur) + ' ' : ''}${ctx.subject ?? ''} DB에 있음` });
}

const J7_PATTERNS: { label: string; re: RegExp }[] = [
  // 수행률: '수행률·완성률' 낱말이나, %가 도달·완성·작성 같은 수행 정도를 나타낼 때만 (문제 지문의 '50% 할인' 등은 제외)
  { label: '과제 수행률', re: /(?:수행률|완성률|달성률|과제\s*수행\s*정도|\d+(?:\.\d+)?\s*%\s*(?:이상|이하|미만|초과|정도|가량)?\s*(?:을|를|만큼)?\s*(?:도달|완성|수행|작성|해결|달성|구현|제출|정확))/ },
  { label: '분량', re: /(?:분량|(?:A4\s*)?\d+\s*(?:쪽|장|매|페이지|글자|자|줄|문단)\s*(?:이상|이내|이하|미만))/ },
  { label: '감점', re: /감점/ },
  { label: '지적 횟수', re: /(?:지적\s*(?:횟수|\d+\s*회)|\d+\s*회\s*(?:이상\s*)?지적)/ },
  { label: '출석률', re: /출석률|출석\s*(?:일수|횟수|여부)/ },
  { label: '제출 여부', re: /제출\s*(?:여부|만\s*(?:해도|하면|한\s*경우))|(?:기한\s*내\s*)?제출\s*시\s*\d+\s*점|제출한\s*경우\s*\d+\s*점/ },
];

/** 채점기준이 아니라 학생이 만들 프로그램·문제 지문을 설명하는 문장 (예: "점수 변수 감점 알고리즘을 구현") */
const TASK_CONTEXT = /(변수|연산|알고리즘|프로그램|코드|함수|조건문|반복문|게임|캐릭터|스프라이트|<조건>|할인|요금)/;

export function findDiscouraged(text: string): { label: string; match: string }[] {
  const out: { label: string; match: string }[] = [];
  for (const line of text.split('\n')) {
    for (const p of J7_PATTERNS) {
      const m = line.match(p.re);
      if (!m) continue;
      if ((p.label === '감점' || p.label === '과제 수행률') && TASK_CONTEXT.test(line) && !/(도달|완성|수행률|완성률|달성률)/.test(m[0])) continue;
      if (!out.some((o) => o.label === p.label)) out.push({ label: p.label, match: m[0].trim() });
    }
  }
  return out;
}

function j7(input: CheckInput, cards: Card[], passed: PassedCheck[]) {
  let checked = 0;
  for (const a of input.rubric)
    for (const e of a.elements) {
      if (!e.rubricText) continue;
      checked++;
      const hits = findDiscouraged(e.rubricText);
      if (!hits.length) continue;
      cards.push({
        key: `J7:${normalizeName(a.name)}:${normalizeName(e.name)}`,
        rule: 'J7',
        severity: 'orange',
        strength: '권고',
        title: `‘${e.name}’ 채점기준을 ${hits.map((h) => `${h.label}(‘${h.match}’)`).join(', ')}으로 제시했어요`,
        locations: e.refs?.rubricText ? [e.refs.rubricText] : [a.source],
        quote: e.rubricText,
        highlights: hits.map((h) => h.match),
        basis: hits.every((h) => h.label === '제출 여부')
          ? { source: GG_AUDIT.source, text: GG_AUDIT.submit, url: GG_AUDIT.url }
          : { source: GG_2026, page: J7_PAGE, text: J7_SOURCE_TEXT },
        actions: ['fix', 'memo'],
        note: SCHOOL_RULE_NOTE,
        fix: '분량·횟수 대신 성취기준의 핵심 행동이 드러나는 수준별 기술로 바꾸세요.',
      });
    }
  if (checked && !cards.some((c) => c.rule === 'J7'))
    passed.push({ rule: 'J7', label: '채점기준 표현', detail: `채점기준 ${checked}칸에서 지양 표현 없음` });
}

function j6(input: CheckInput, cards: Card[], passed: PassedCheck[]) {
  // 표를 읽지 못한 문서(PDF 등)는 평가 목록이 비어 있어 연결을 따질 수 없다
  if (input.format === 'public' && !input.plan.length) return;
  const rows = buildAlignment(input);
  for (const row of rows) {
    if (row.linked) continue;
    cards.push({
      key: `J6:${row.code}`,
      rule: 'J6',
      severity: 'gray',
      strength: '사실',
      title: `${row.code}가 어떤 평가와도 연결되지 않았어요`,
      locations: [row.ref],
      quote: `${row.code} ${row.text}`,
      basis: {
        source: '성취기준–평가 정렬 · Webb 범주 일치, UbD',
        text: '문서에서 연결을 찾지 못했다는 뜻이며, 실제로 가르치거나 평가하지 않았다는 뜻은 아닙니다. 교육적 타당성은 자동으로 판정하지 않습니다.',
      },
      actions: ['link', 'memo'],
      fix: '정렬 맵에서 이 성취기준을 다루는 평가 칸을 눌러 연결하거나, 평가 요소 표에 코드를 적으세요.',
    });
  }
  if (rows.length && rows.every((r) => r.linked))
    passed.push({ rule: 'J6', label: '성취기준–평가 연결', detail: `성취기준 ${rows.length}개 모두 평가와 연결` });
}

/** 두 문장이 얼마나 같은지 (글자 두 개씩 묶어 겹치는 비율, 0~1) */
export function similarity(a: string, b: string): number {
  const clean = (s: string) => s.replace(/[\s⋅·ㆍ‧∙・･․,.\-()「」'"]/g, '');
  const grams = (s: string) => { const g = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); g.set(k, (g.get(k) ?? 0) + 1); } return g; };
  const A = grams(clean(a)), B = grams(clean(b));
  let inter = 0, na = 0, nb = 0;
  A.forEach((v, k) => { na += v; inter += Math.min(v, B.get(k) ?? 0); });
  B.forEach((v) => { nb += v; });
  return na + nb ? (2 * inter) / (na + nb) : 0;
}

/**
 * J5 성취기준 문구.
 * (1) 적용 교육과정이 확실한데 문장이 다른 교육과정(예: 2015 개정) 고시 문장과 같으면 빨강 — 이전 교육과정 문구가 남은 것.
 * (2) 한 문서 안에서 같은 코드를 고시 원문과 다른 문장으로도 적었으면 회색.
 * 모든 곳이 원문과 다르면(재구성한 성취기준일 수 있음) 띄우지 않는다.
 */
function j5(input: CheckInput, cards: Card[], passed: PassedCheck[]) {
  const ctx = ctxOf(input);
  const by = new Map<string, { text: string; ref: CellRef; cur?: Curriculum; grade?: number }[]>();
  for (const ct of input.codeTexts ?? []) {
    const at = curAt(ctx, ct.ref);
    if (classifyCode(ct.code, { subject: ctx.subject, curriculum: at.cur }) !== 'valid') continue;
    by.set(ct.code, [...(by.get(ct.code) ?? []), { ...ct, ...at }]);
  }
  let checked = 0;
  for (const [code, items] of by) {
    checked++;
    // (1) 학년도·학년으로 적용 교육과정을 아는 칸에서, 문장이 다른 교육과정 원문과 같은 경우
    const old = items.filter((it) => {
      if (!it.grade || !it.cur) return false;
      const here = lookupStandard(code, it.cur), there = lookupStandard(code, it.cur === '2022' ? '2015' : '2022');
      return !!here && !!there && similarity(it.text, there.text) >= 0.9 && similarity(it.text, here.text) < 0.8;
    });
    if (old.length) {
      const here = lookupStandard(code, old[0].cur)!, there = lookupStandard(code, old[0].cur === '2022' ? '2015' : '2022')!;
      cards.push({
        key: `J5-old:${code}`,
        rule: 'J5',
        severity: 'red',
        strength: '사실',
        title: `${code} 문장이 ${curriculumLabel(there.curriculum)} 교육과정 문장이에요`,
        locations: old.map((o) => o.ref),
        quote: `문서: ${old[0].text}\n${curriculumLabel(here.curriculum)} 원문: ${here.text}`,
        basis: {
          source: dbSource(here.curriculum, here.subject),
          page: here.page ? `PDF ${here.page}쪽` : undefined,
          text: `${gradeLabel(ctx, old[0].grade)}은 ${curriculumLabel(here.curriculum)} 교육과정을 적용합니다. 같은 코드라도 두 교육과정의 성취기준 내용이 다릅니다.`,
        },
        actions: ['fix', 'memo'],
        fix: `${code} 문장을 ${curriculumLabel(here.curriculum)} 원문으로 바꾸고, 평가 요소가 새 성취기준과 맞는지 확인하세요.`,
        replace: { from: old[0].text, to: here.text },
      });
      continue;
    }
    // (2) 같은 문서 안 다른 문구 (같은 교육과정 칸끼리)
    const cur = items[0].cur ?? applied(ctx);
    const pick = (cur ? lookupStandard(code, cur) : undefined) ?? lookupStandard(code)!;
    const official = pick.text;
    const sims = items.map((it) => ({ ...it, sim: similarity(it.text, official), prefix: it.text.replace(/\s/g, '').startsWith(official.replace(/\s/g, '').slice(0, 25)) }));
    const match = sims.filter((x) => x.sim >= 0.92);
    const differ = sims.filter((x) => x.sim < 0.85 && !x.prefix && (!x.cur || x.cur === pick.curriculum));
    if (!match.length || !differ.length) continue;
    const variants = [...new Map(differ.map((d) => [d.text.replace(/\s/g, ''), d])).values()];
    cards.push({
      key: `J5:${code}`,
      rule: 'J5',
      severity: 'gray',
      strength: '사실',
      title: `${code}를 고시 원문과 다른 문장으로도 적었어요`,
      locations: [...match.map((m) => m.ref), ...variants.map((v) => v.ref)],
      emphasis: variants.map((v) => v.ref),
      quote: `고시 원문: ${official}\n다르게 적은 곳: ${variants.map((v) => v.text).join(' / ')}`,
      basis: { source: dbSource(pick.curriculum, pick.subject), text: '같은 문서 안에서 같은 코드가 서로 다른 문장으로 적혀 있습니다. 다른 코드의 문장을 옮겨 적었거나 성취기준을 재구성했을 수 있습니다.' },
      actions: ['fix', 'memo'],
      fix: `${code} 문장을 고시 원문으로 맞추세요. 의도한 재구성이라면 메모하고 넘기세요.`,
      replace: { from: variants[0].text, to: official },
    });
  }
  if (checked && !cards.some((c) => c.rule === 'J5')) passed.push({ rule: 'J5', label: '성취기준 문구', detail: `코드 ${checked}개 문구가 고시 원문과 일치` });
}

/** J13 반영비율 하한 (규칙팩: 수행평가·논술형) */
function j13(input: CheckInput, cards: Card[], passed: PassedCheck[]) {
  const ctx = ctxOf(input);
  const pack = packFor(ctx.year);
  if (!pack || input.format !== 'public') return;
  let checked = 0;
  // 논술형
  const arts = pack.essayMin.artsSubjects.includes(ctx.subject ?? '');
  const min = arts ? pack.essayMin.arts : pack.essayMin.value;
  for (const e of input.essay ?? []) {
    checked++;
    if (e.total + 1e-9 >= min) continue;
    cards.push({
      key: `J13-essay:${e.table}`,
      rule: 'J13',
      severity: 'orange',
      strength: '의무',
      title: `논술형 평가 반영비율이 ${e.total}%예요 (${min}% 이상이어야 해요)`,
      locations: [e.ref],
      quote: e.raw,
      basis: { source: pack.source, page: pack.essayMin.page, text: pack.essayMin.text + (arts ? ' (체육·예술 교과는 20%)' : ''), url: pack.url },
      actions: ['fix', 'memo'],
      note: SCHOOL_RULE_NOTE,
      fix: `논술형 평가 반영비율을 ${min}% 이상으로 맞추세요.`,
    });
  }
  // 수행평가 (요약표마다, 정기시험이 있는 표만)
  const byTable = new Map<number, Assessment[]>();
  for (const a of input.plan) byTable.set(a.source.table, [...(byTable.get(a.source.table) ?? []), a]);
  for (const [t, as] of byTable) {
    if (as.some((a) => a.incomplete) || as.some((a) => a.weightPercent === undefined)) continue;
    const written = as.filter((a) => /지필|정기/.test(a.method ?? ''));
    if (!written.length) continue;
    checked++;
    const perf = sum(as.filter((a) => !written.includes(a)).map((a) => a.weightPercent));
    const all = sum(as.map((a) => a.weightPercent));
    if (Math.abs(all - 100) > 0.6 || perf + 1e-9 >= pack.perfMin.value) continue;
    cards.push({
      key: `J13-perf:${t}`,
      rule: 'J13',
      severity: 'orange',
      strength: '의무',
      title: `수행평가 반영비율 합계가 ${perf}%예요 (${pack.perfMin.value}% 이상이어야 해요)`,
      locations: as.map((a) => a.refs?.weightPercent ?? a.source),
      quote: as.map((a) => `${a.name} ${fmt(a.weightPercent, '%')}`).join(' + '),
      basis: { source: pack.source, page: pack.perfMin.page, text: pack.perfMin.text, url: pack.url },
      actions: ['fix', 'memo'],
      fix: `수행평가 반영비율을 ${pack.perfMin.value}% 이상으로 맞추세요.`,
    });
  }
  if (checked && !cards.some((c) => c.rule === 'J13')) passed.push({ rule: 'J13', label: '반영비율 하한', detail: `${pack.name} 지침의 수행평가·논술형 하한 충족` });
}

/** J14 결시자 처리기준이 계획에 있는지 (규칙팩) */
function j14(input: CheckInput, cards: Card[], passed: PassedCheck[]) {
  const ctx = ctxOf(input);
  const pack = packFor(ctx.year);
  if (!pack || input.format !== 'public' || !input.absence || !input.plan.length) return;
  if (input.absence.found) {
    passed.push({ rule: 'J14', label: '결시자 처리기준', detail: '계획서에 결시·미응시 처리 내용이 있음' });
    return;
  }
  cards.push({
    key: 'J14-absence',
    rule: 'J14',
    severity: 'gray',
    strength: '의무',
    title: '결시자(미응시) 처리기준을 계획서에서 찾지 못했어요',
    locations: [input.plan[0].source],
    quote: '계획서 안에서 결시·미응시·인정점에 관한 문장을 찾지 못함',
    basis: { source: pack.source, page: pack.absence.page, text: pack.absence.text, url: pack.url },
    actions: ['memo'],
    note: SCHOOL_RULE_NOTE,
    fix: '수행평가 결시자 처리기준(인정점 등)을 평가 계획에 적으세요. 학교 규정을 따르는 경우 그 문장을 넣으세요.',
  });
}

/** 노랑 제안은 이번 데모에서 1개만: S5 학생 성찰 기회 */
function s5(input: CheckInput, cards: Card[]) {
  const perf = input.rubric;
  if (!perf.length) return;
  const text = perf.flatMap((a) => a.elements.map((e) => `${e.name} ${e.rubricText ?? ''}`)).join(' ');
  if (/(성찰|자기\s*평가|동료\s*평가|돌아보)/.test(text)) return;
  cards.push({
    key: 'S5-reflection',
    rule: 'S5',
    severity: 'yellow',
    strength: '제안',
    title: '학생이 자기 과정을 돌아보는 기회가 평가 안에 있나요?',
    locations: [perf[0].source],
    quote: `채점기준표 평가요소 ${perf.reduce((n, a) => n + a.elements.length, 0)}개 중 성찰·자기평가·동료평가 요소 없음`,
    basis: { source: '제안 · 2022 개정 교육과정 총론의 평가 방향', text: '판정이 아닌 질문입니다. 수업 중 다른 활동으로 다루고 있다면 넘겨도 됩니다.' },
    actions: ['memo'],
  });
}

const ORDER: Record<Severity, number> = { red: 0, orange: 1, gray: 2, yellow: 3 };
const RULE_ORDER = ['J12', 'J13', 'J4', 'J5', 'J7', 'J14', 'J6', 'S5'];

export function runChecks(input: CheckInput): CheckResult {
  const cards: Card[] = [];
  const passed: PassedCheck[] = [];
  computeReliable(input);
  j12(input, cards, passed);
  j13(input, cards, passed);
  j4(input, cards, passed);
  j5(input, cards, passed);
  j7(input, cards, passed);
  j14(input, cards, passed);
  j6(input, cards, passed);
  s5(input, cards);
  cards.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || RULE_ORDER.indexOf(a.rule) - RULE_ORDER.indexOf(b.rule));
  return { cards, passed };
}

export type Diff = { resolved: Card[]; remaining: Card[]; added: Card[] };

/** 이전 실행과 비교: 카드 key가 같으면 같은 지적으로 본다. */
export function diffRuns(prev: Card[], curr: Card[]): Diff {
  const pk = new Set(prev.map((c) => c.key));
  const ck = new Set(curr.map((c) => c.key));
  return {
    resolved: prev.filter((c) => !ck.has(c.key)),
    remaining: curr.filter((c) => pk.has(c.key)),
    added: curr.filter((c) => !pk.has(c.key)),
  };
}

export function countBySeverity(cards: Card[]): Record<Severity, number> {
  const out: Record<Severity, number> = { red: 0, orange: 0, gray: 0, yellow: 0 };
  for (const c of cards) out[c.severity]++;
  return out;
}
