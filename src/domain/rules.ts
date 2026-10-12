// 점검 규칙. 모두 결정적 코드다 (LLM 호출 없음). 같은 입력이면 같은 결과.
import { normalizeName } from './extract';
import { STANDARDS_DB, classifyCode, lookupStandard } from './standards';
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
const DB_SOURCE = '2022 개정 교육과정 고시(교육부 고시 제2022-33호 [별책3]) 중학교 정보 성취기준 — DECK6 공개 정형 데이터(MIT)';

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
    const db = lookupStandard(s.code);
    return { code: s.code, text: db?.text ?? s.text, inDb: !!db, ref: s.ref, cells, linked: cells.some((c) => c.via) };
  });
}

// ---------- 규칙 ----------

const sum = (xs: (number | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const fmt = (n: number | undefined, unit: string) => (n === undefined ? '—' : `${n}${unit}`);
const isWritten = (a: Assessment) => /지필/.test(a.method ?? '');

function j12(input: CheckInput, cards: Card[], passed: PassedCheck[]) {
  const { plan, rubric, pairs } = input;

  // (1) 반영비율 합계 — 평가계획 안에서만 본다.
  const weighted = plan.filter((a) => a.weightPercent !== undefined);
  if (weighted.length) {
    const total = sum(weighted.map((a) => a.weightPercent));
    if (Math.abs(total - 100) > 1e-9) {
      cards.push({
        key: 'J12-weight-sum',
        rule: 'J12',
        severity: 'red',
        strength: '사실',
        title: `반영비율 합계가 ${total}%예요 (100%가 아님)`,
        locations: weighted.map((a) => a.refs?.weightPercent ?? a.source),
        quote: weighted.map((a) => `${a.name} ${fmt(a.weightPercent, '%')}`).join(' + ') + ` = ${total}%`,
        basis: { source: '맞물림 규칙 J12 (국가층 · 사실 확인)', text: '평가계획의 학기 반영비율은 모두 더해 100%여야 합니다.' },
        actions: ['fix', 'memo'],
        fix: `반영비율을 더해 100%가 되게 고치세요. 지금은 ${total - 100 > 0 ? `${total - 100}%p 많아요` : `${100 - total}%p 모자라요`}.`,
      });
    } else passed.push({ rule: 'J12-weight', label: '반영비율 합계', detail: `${weighted.length}개 평가 합계 100%` });
  }

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
        basis: { source: '맞물림 규칙 J12 (연결 확인)', text: '이름이 달라 자동으로 짝짓지 못했어요. 확인 화면에서 같은 평가를 지정하면 배점을 비교합니다.' },
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
          source: '맞물림 규칙 J12 (국가층 · 사실 확인)',
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
        basis: { source: '맞물림 규칙 J12 (연결 확인)', text: `${finer} 오류로 단정하지 않고 두 문서가 같은 내용을 가리키는지 확인을 요청합니다.` },
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
        basis: { source: '맞물림 규칙 J12 (연결 확인)', text: '같은 평가라면 두 문서의 성취기준 코드가 대응해야 합니다. 한쪽에서 일부만 적었을 수 있어 확인을 요청합니다.' },
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
      basis: { source: '맞물림 규칙 J12 (연결 확인)', text: '수행평가는 채점기준표와 짝을 이뤄야 배점을 비교할 수 있습니다. 확인 화면에서 짝을 지정하세요.' },
      actions: ['link', 'memo'],
      fix: '채점기준표에 이 평가가 있다면 확인 화면에서 짝을 지정하고, 없다면 채점기준표를 함께 올려 주세요.',
    });
  }
  if (okPairs) passed.push({ rule: 'J12', label: '만점 = 배점 합계', detail: `짝지은 ${okPairs}개 평가 일치` });
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

function j4(input: CheckInput, cards: Card[], passed: PassedCheck[]) {
  const where = new Map<string, CellRef[]>();
  const add = (code: string, at?: CellRef) => {
    if (!where.has(code)) where.set(code, []);
    if (at) where.get(code)!.push(at);
  };
  input.planStandards.forEach((s) => add(s.code, s.ref));
  for (const a of [...input.plan, ...input.rubric]) for (const e of a.elements) for (const c of e.standards) add(c, e.refs?.standards);

  let valid = 0;
  for (const [code, locs] of where) {
    const st = classifyCode(code);
    if (st === 'valid') {
      valid++;
      continue;
    }
    if (st === 'not-in-db') {
      const domainNo = code.slice(3, 5);
      const siblings = STANDARDS_DB.standards.filter((s) => s.code.startsWith(`[9정${domainNo}-`)).map((s) => s.code);
      cards.push({
        key: `J4-missing:${code}`,
        rule: 'J4',
        severity: 'red',
        strength: '사실',
        title: `${code}는 2022 개정 중학교 정보 성취기준에 없는 코드예요`,
        locations: locs,
        quote: `문서에 적힌 코드: ${code}`,
        basis: {
          source: DB_SOURCE,
          text: siblings.length
            ? `같은 영역에는 ${siblings[0]}~${siblings[siblings.length - 1]}(${siblings.length}개)만 있습니다.`
            : `중학교 정보 성취기준 ${STANDARDS_DB.standards.length}개 중 같은 영역 번호가 없습니다.`,
        },
        actions: ['fix', 'memo'],
        fix: siblings.length ? `같은 영역 코드(${siblings[0]}~${siblings[siblings.length - 1]}) 중 이 평가가 다루는 코드로 고치세요.` : '2022 개정 중학교 정보 성취기준 코드로 고치세요.',
      });
    } else {
      cards.push({
        key: `J4-scope:${code}`,
        rule: 'J4',
        severity: 'gray',
        strength: '사실',
        title: `${code}는 현재 지원 범위(2022 개정 중학교 정보)에서 확인 불가`,
        locations: locs,
        quote: `문서에 적힌 코드: ${code}`,
        basis: { source: DB_SOURCE, text: '다른 교과나 다른 교육과정의 코드는 이번 데모의 DB에 없어 실재 여부를 판정하지 않습니다.' },
        actions: ['memo'],
        fix: '의도한 다른 교과 코드라면 메모하고 넘기세요.',
      });
    }
  }
  if (valid && !cards.some((c) => c.rule === 'J4' && c.severity === 'red'))
    passed.push({ rule: 'J4', label: '성취기준 코드 실재', detail: `코드 ${valid}개 모두 DB에 있음` });
}

const J7_PATTERNS: { label: string; re: RegExp }[] = [
  { label: '과제 수행률', re: /(?:수행률|완성률|달성률|\d+(?:\.\d+)?\s*%\s*(?:이상|이하|미만|초과)?)/ },
  { label: '분량', re: /(?:분량|(?:A4\s*)?\d+\s*(?:쪽|장|매|페이지|글자|자|줄|문단)\s*(?:이상|이내|이하|미만)?)/ },
  { label: '감점', re: /감점/ },
  { label: '지적 횟수', re: /(?:지적\s*(?:횟수|\d+\s*회)|\d+\s*회\s*(?:이상\s*)?지적)/ },
  { label: '출석률', re: /출석(?:률)?/ },
];

export function findDiscouraged(text: string): { label: string; match: string }[] {
  const out: { label: string; match: string }[] = [];
  for (const p of J7_PATTERNS) {
    const m = text.match(p.re);
    if (m) out.push({ label: p.label, match: m[0].trim() });
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
        basis: { source: GG_2026, page: J7_PAGE, text: J7_SOURCE_TEXT },
        actions: ['fix', 'memo'],
        note: SCHOOL_RULE_NOTE,
        fix: '분량·횟수 대신 성취기준의 핵심 행동이 드러나는 수준별 기술로 바꾸세요.',
      });
    }
  if (checked && !cards.some((c) => c.rule === 'J7'))
    passed.push({ rule: 'J7', label: '채점기준 표현', detail: `채점기준 ${checked}칸에서 지양 표현 없음` });
}

function j6(input: CheckInput, cards: Card[], passed: PassedCheck[]) {
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
        source: '맞물림 규칙 J6 (연결 확인 · Webb 범주 일치, UbD)',
        text: '문서에서 연결을 찾지 못했다는 뜻이며, 실제로 가르치거나 평가하지 않았다는 뜻은 아닙니다. 교육적 타당성은 자동으로 판정하지 않습니다.',
      },
      actions: ['link', 'memo'],
      fix: '정렬 맵에서 이 성취기준을 다루는 평가 칸을 눌러 연결하거나, 평가 요소 표에 코드를 적으세요.',
    });
  }
  if (rows.length && rows.every((r) => r.linked))
    passed.push({ rule: 'J6', label: '성취기준–평가 연결', detail: `성취기준 ${rows.length}개 모두 평가와 연결` });
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
    basis: { source: '맞물림 제안 S5 (2022 개정 교육과정 총론의 평가 방향)', text: '판정이 아닌 질문입니다. 수업 중 다른 활동으로 다루고 있다면 넘겨도 됩니다.' },
    actions: ['memo'],
  });
}

const ORDER: Record<Severity, number> = { red: 0, orange: 1, gray: 2, yellow: 3 };
const RULE_ORDER = ['J12', 'J4', 'J7', 'J6', 'S5'];

export function runChecks(input: CheckInput): CheckResult {
  const cards: Card[] = [];
  const passed: PassedCheck[] = [];
  j12(input, cards, passed);
  j4(input, cards, passed);
  j7(input, cards, passed);
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
