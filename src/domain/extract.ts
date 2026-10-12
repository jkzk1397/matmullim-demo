// 파싱된 표(2차원 배열) → 점검용 데이터 모델.
// 표 머리글(첫 행)의 낱말로 칸의 뜻을 정한다. 형식은 docs/hwpx-template.md 참고.
import { extractCodes } from './standards';
import type {
  Assessment,
  CellRef,
  DocKind,
  Element,
  Extraction,
  ParsedDocument,
  ParsedTable,
  PlanStandard,
} from './types';

const norm = (s: string) => s.replace(/\s+/g, '').replace(/[()（）]/g, '');

/** 병합된 칸을 원래 값으로 채운 표 (추출 전용). */
export function fillMerged(t: ParsedTable): string[][] {
  const grid = t.rows.map((r) => [...r]);
  for (const s of t.spans) {
    const v = grid[s.row]?.[s.col] ?? '';
    for (let r = s.row; r < s.row + s.rowSpan; r++)
      for (let c = s.col; c < s.col + s.colSpan; c++) if (grid[r] && (r !== s.row || c !== s.col)) grid[r][c] = v;
  }
  return grid;
}

/** 병합으로 가려진 칸이면 그 병합의 시작 칸을 돌려준다 (원문 위치 표시용). */
function originOf(t: ParsedTable, row: number, col: number): { row: number; col: number } {
  for (const s of t.spans)
    if (row >= s.row && row < s.row + s.rowSpan && col >= s.col && col < s.col + s.colSpan) return { row: s.row, col: s.col };
  return { row, col };
}

function findCol(header: string[], ...keys: string[]): number {
  return header.findIndex((h) => keys.some((k) => norm(h).includes(k)));
}

/**
 * 단위를 보고 숫자를 읽는다. "만점 100점, 반영비율 30%"처럼 한 칸에 둘이 섞여 있어도
 * unit이 '점'이면 100, '%'이면 30을 돌려준다. 단위가 없는 숫자 하나뿐이면 그 숫자.
 */
export function parseNumber(text: string, unit: '점' | '%'): number | undefined {
  const t = text.replace(/,/g, '');
  const withUnit = t.match(unit === '%' ? /(\d+(?:\.\d+)?)\s*%/ : /(\d+(?:\.\d+)?)\s*점/);
  if (withUnit) return Number(withUnit[1]);
  const all = [...t.matchAll(/\d+(?:\.\d+)?/g)];
  const other = unit === '%' ? /점/ : /%/;
  if (all.length === 1 && !other.test(t)) return Number(all[0][0]);
  return undefined;
}

export function normalizeName(s: string): string {
  return s
    .replace(/^\s*[\d]+[.)]\s*/, '')
    .replace(/수행\s*평가|평가/g, '')
    .replace(/[\s·.,:()\-–—「」『』"'‘’“”]/g, '')
    .toLowerCase();
}

type Kind = 'standards' | 'overview' | 'elements' | 'rubric' | 'unknown';

function tableKind(doc: DocKind, header: string[]): Kind {
  const has = (k: string) => header.some((h) => norm(h).includes(k));
  if (doc === 'rubric' && has('평가요소') && has('채점기준')) return 'rubric';
  if (has('평가명') && has('평가요소')) return 'elements';
  if (has('평가명') && (has('반영') || has('만점'))) return 'overview';
  if (has('성취기준') && has('코드') && !has('평가명')) return 'standards';
  return 'unknown';
}

const ref = (doc: DocKind, table: number, row: number, col: number): CellRef => ({ doc, table, row, col });

export function extractPlan(doc: ParsedDocument): { assessments: Assessment[]; standards: PlanStandard[]; warnings: string[] } {
  const assessments: Assessment[] = [];
  const standards: PlanStandard[] = [];
  const warnings: string[] = [];
  const byName = new Map<string, Assessment>();

  const ensure = (name: string, at: CellRef) => {
    const k = normalizeName(name);
    let a = byName.get(k);
    if (!a) {
      a = { id: `plan-${assessments.length + 1}`, name: name.trim(), elements: [], source: at, refs: {} };
      assessments.push(a);
      byName.set(k, a);
    }
    return a;
  };

  const kinds = doc.tables.map((t) => tableKind('plan', t.rows[0] ?? []));
  // 개요 표를 먼저 읽어 평가 순서를 정한다.
  const order = kinds.map((k, i) => ({ k, i })).sort((a, b) => Number(b.k === 'overview') - Number(a.k === 'overview'));

  for (const { k, i } of order) {
    const t = doc.tables[i];
    const g = fillMerged(t);
    const h = g[0] ?? [];
    if (k === 'standards') {
      const cCode = findCol(h, '코드');
      const cText = h.findIndex((x, j) => j !== cCode && (norm(x).includes('성취기준') || norm(x).includes('내용')));
      for (let r = 1; r < g.length; r++) {
        const codes = extractCodes(g[r][cCode] ?? '');
        for (const code of codes)
          if (!standards.some((s) => s.code === code))
            standards.push({ code, text: cText >= 0 ? (g[r][cText] ?? '').trim() : '', ref: ref('plan', i, r, cCode) });
      }
    } else if (k === 'overview') {
      const cName = findCol(h, '평가명');
      const cMethod = findCol(h, '방법', '유형', '종류');
      const cWeight = findCol(h, '반영');
      const cMax = findCol(h, '만점');
      for (let r = 1; r < g.length; r++) {
        const name = (g[r][cName] ?? '').trim();
        if (!name || /^(합계|계|총계)$/.test(norm(name))) continue;
        const o = originOf(t, r, cName);
        const a = ensure(name, ref('plan', i, o.row, o.col));
        if (cMethod >= 0) {
          a.method = g[r][cMethod].trim();
          a.refs!.method = ref('plan', i, r, cMethod);
        }
        if (cWeight >= 0) {
          a.weightPercent = parseNumber(g[r][cWeight], '%');
          a.refs!.weightPercent = ref('plan', i, r, cWeight);
        }
        if (cMax >= 0) {
          a.maxScore = parseNumber(g[r][cMax], '점');
          a.refs!.maxScore = ref('plan', i, r, cMax);
        }
      }
    } else if (k === 'elements') {
      const cName = findCol(h, '평가명');
      const cEl = findCol(h, '평가요소');
      const cPts = findCol(h, '배점');
      const cStd = findCol(h, '성취기준');
      for (let r = 1; r < g.length; r++) {
        const name = (g[r][cName] ?? '').trim();
        const elName = (g[r][cEl] ?? '').trim();
        if (!name || !elName) continue;
        const o = originOf(t, r, cName);
        const a = ensure(name, ref('plan', i, o.row, o.col));
        const el: Element = { name: elName, standards: [], refs: { name: ref('plan', i, r, cEl) } };
        if (cPts >= 0) {
          el.points = parseNumber(g[r][cPts], '점');
          el.refs!.points = ref('plan', i, r, cPts);
        }
        if (cStd >= 0) {
          el.standards = extractCodes(g[r][cStd]);
          el.refs!.standards = ref('plan', i, r, cStd);
        }
        a.elements.push(el);
      }
    } else {
      warnings.push(`평가계획서 표${i + 1}「${t.title || '제목 없음'}」은 점검에 쓰는 머리글이 없어 건너뛰었어요.`);
    }
  }
  if (!assessments.length) warnings.push('평가계획서에서 평가명 칸을 찾지 못했어요. docs/hwpx-template.md의 머리글 형식을 확인하세요.');
  return { assessments, standards, warnings };
}

export function extractRubric(doc: ParsedDocument): { assessments: Assessment[]; warnings: string[] } {
  const assessments: Assessment[] = [];
  const warnings: string[] = [];
  const byName = new Map<string, Assessment>();

  doc.tables.forEach((t, i) => {
    const g = fillMerged(t);
    const h = g[0] ?? [];
    if (tableKind('rubric', h) !== 'rubric') {
      warnings.push(`채점기준표 표${i + 1}「${t.title || '제목 없음'}」은 점검에 쓰는 머리글이 없어 건너뛰었어요.`);
      return;
    }
    const cName = findCol(h, '평가명');
    const cEl = findCol(h, '평가요소');
    const cStd = findCol(h, '성취기준');
    const cCrit = findCol(h, '채점기준', '수행수준');
    const cPts = findCol(h, '배점');
    for (let r = 1; r < g.length; r++) {
      const name = (cName >= 0 ? g[r][cName] : t.title).trim();
      const elName = (g[r][cEl] ?? '').trim();
      if (!name || !elName) continue;
      const k = normalizeName(name);
      let a = byName.get(k);
      if (!a) {
        const o = cName >= 0 ? originOf(t, r, cName) : { row: 0, col: 0 };
        a = { id: `rubric-${assessments.length + 1}`, name: name.replace(/^\s*\d+[.)]\s*/, ''), elements: [], source: ref('rubric', i, o.row, o.col), refs: {} };
        assessments.push(a);
        byName.set(k, a);
      }
      const el: Element = { name: elName, standards: [], refs: { name: ref('rubric', i, r, cEl) } };
      if (cStd >= 0) {
        el.standards = extractCodes(g[r][cStd]);
        el.refs!.standards = ref('rubric', i, r, cStd);
      }
      if (cCrit >= 0) {
        el.rubricText = g[r][cCrit].trim();
        el.refs!.rubricText = ref('rubric', i, r, cCrit);
      }
      if (cPts >= 0) {
        el.points = parseNumber(g[r][cPts], '점');
        el.refs!.points = ref('rubric', i, r, cPts);
      }
      a.elements.push(el);
    }
  });
  for (const a of assessments) a.rubricText = a.elements.map((e) => e.rubricText ?? '').filter(Boolean).join('\n');
  if (!assessments.length) warnings.push('채점기준표에서 평가요소·채점기준 칸을 찾지 못했어요.');
  return { assessments, warnings };
}

export function extract(plan: ParsedDocument, rubric: ParsedDocument): Extraction {
  const p = extractPlan(plan);
  const r = extractRubric(rubric);
  return { plan: p.assessments, rubric: r.assessments, planStandards: p.standards, warnings: [...p.warnings, ...r.warnings] };
}

/** 이름으로 짝을 제안한다. 교사가 확인 화면에서 바꿀 수 있다. */
export function suggestPairs(plan: Assessment[], rubric: Assessment[]): Record<string, string | null> {
  const pairs: Record<string, string | null> = {};
  for (const r of rubric) {
    const rn = normalizeName(r.name);
    const exact = plan.find((p) => normalizeName(p.name) === rn);
    const loose = plan.find((p) => {
      const pn = normalizeName(p.name);
      return pn.length > 1 && rn.length > 1 && (pn.includes(rn) || rn.includes(pn));
    });
    pairs[r.id] = (exact ?? loose)?.id ?? null;
  }
  return pairs;
}
