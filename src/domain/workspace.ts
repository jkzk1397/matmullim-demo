// 앱이 다루는 단위: 올린 파일(Source) → 교과 구간마다 점검(Review). 바로 고치기와 직접 고치기는 Review의 문서 사본을 바꾸고 다시 점검한다.
import { splitSections, type SubjectSection } from './context';
import { extractPublic, suggestPublicPairs } from './extract-public';
import { countBySeverity, runChecks } from './rules';
import type { Card, CellRef, CheckInput, CheckResult, Extraction, ParsedDocument, Severity } from './types';

export type SourceKind = 'hwpx' | 'hwp' | 'pdf' | 'docx' | 'xlsx' | 'odt';
export const KIND_LABEL: Record<SourceKind, string> = { hwpx: 'HWPX', hwp: 'HWP', pdf: 'PDF', docx: 'Word', xlsx: 'Excel', odt: 'ODT' };
/** 고친 칸을 원본 서식 그대로 다시 쓸 수 있는 형식 */
export const PATCHABLE: SourceKind[] = ['hwpx', 'docx'];
export type Source = { id: string; name: string; kind: SourceKind; bytes: ArrayBuffer; doc: ParsedDocument };

export type CellEdit = { table: number; row: number; col: number; from: string; to: string; cardKey?: string; at: number };

export type Review = {
  id: string;
  source: Source;
  section: SubjectSection;
  /** 고친 내용이 반영된 문서 사본 */
  doc: ParsedDocument;
  ex: Extraction;
  input: CheckInput;
  result: CheckResult;
  edits: CellEdit[];
  /** 처음 점검했을 때의 카드 (고친 항목 표시용) */
  initial: Card[];
  memos: Record<string, string>;
  checkedAt: Date;
};

export function analyze(doc: ParsedDocument, section: SubjectSection): { ex: Extraction; input: CheckInput; result: CheckResult } {
  const ex = extractPublic(doc, section);
  const input: CheckInput = {
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
    malformed: ex.malformed,
    cells: (r) => doc.tables[r.table]?.rows[r.row]?.[r.col] ?? '',
  };
  return { ex, input, result: runChecks(input) };
}

export function reviewsFor(source: Source): Review[] {
  const sections = splitSections(source.doc);
  const list = sections.length ? sections : [{ subject: '', grades: [], from: 0, to: source.doc.tables.length, title: source.doc.title }];
  return list.map((section, i) => {
    const a = analyze(source.doc, section);
    return { id: `${source.id}#${i}`, source, section, doc: source.doc, ...a, edits: [], initial: a.result.cards, memos: {}, checkedAt: new Date() };
  });
}

const cloneDoc = (d: ParsedDocument): ParsedDocument => ({ ...d, tables: d.tables.map((t) => ({ ...t, rows: t.rows.map((r) => [...r]) })) });

/** 칸 글자 바꾸기 (원문 칸은 병합 시작 칸) → 다시 점검 */
export function editCells(review: Review, changes: { ref: CellRef; from: string; to: string }[], cardKey?: string): Review {
  const doc = cloneDoc(review.doc);
  const edits: CellEdit[] = [];
  for (const { ref, from, to } of changes) {
    const row = doc.tables[ref.table]?.rows[ref.row];
    if (!row || row[ref.col] === undefined) continue;
    const cell = row[ref.col];
    if (!cell.includes(from)) continue;
    row[ref.col] = cell.replace(from, to);
    edits.push({ table: ref.table, row: ref.row, col: ref.col, from, to, cardKey, at: Date.now() });
  }
  if (!edits.length) return review;
  const a = analyze(doc, review.section);
  return { ...review, doc, ...a, edits: [...review.edits, ...edits], checkedAt: new Date() };
}

/** 카드의 '바로 고치기': card.replace를 카드 위치 칸에 적용 */
export function applyQuickFix(review: Review, card: Card): Review {
  if (!card.replace) return review;
  const { from, to } = card.replace;
  const targets = (card.emphasis?.length ? card.emphasis : card.locations).filter((l) => (review.doc.tables[l.table]?.rows[l.row]?.[l.col] ?? '').includes(from));
  // 같은 코드가 다른 칸에도 있으면(J4 오자) 모두
  const all = card.rule === 'J4' ? card.locations.filter((l) => (review.doc.tables[l.table]?.rows[l.row]?.[l.col] ?? '').includes(from)) : targets;
  return editCells(review, all.map((ref) => ({ ref, from, to })), card.key);
}

/** 칸 전체를 새 글로: 앞뒤 같은 부분을 빼고 바뀐 가운데만 기록 (HWPX 패치가 문단 안에서 바꾸도록) */
export function setCellText(review: Review, ref: CellRef, next: string): Review {
  const cur = review.doc.tables[ref.table]?.rows[ref.row]?.[ref.col] ?? '';
  if (cur === next) return review;
  let a = 0;
  while (a < cur.length && a < next.length && cur[a] === next[a]) a++;
  let b = 0;
  while (b < cur.length - a && b < next.length - a && cur[cur.length - 1 - b] === next[next.length - 1 - b]) b++;
  // 바뀐 부분이 너무 짧으면 낱말 단위로 넓힌다
  while (a > 0 && !/[\s,.\]\[]/.test(cur[a - 1])) a--;
  while (b > 0 && !/[\s,.\]\[]/.test(cur[cur.length - b])) b--;
  const from = cur.slice(a, cur.length - b);
  const to = next.slice(a, next.length - b);
  if (!from) {
    // 순수 삽입: 앞 낱말을 붙잡아 바꾼다
    const anchor = cur.slice(Math.max(0, a - 6), a);
    return editCells(review, [{ ref, from: anchor + '', to: anchor + to }]);
  }
  return editCells(review, [{ ref, from, to }]);
}

export function counts(r: Review): Record<Severity, number> {
  return countBySeverity(r.result.cards);
}

/** 처음 점검 때 있었는데 지금 없는 카드 = 고친 항목 */
export function resolvedCards(r: Review): Card[] {
  const now = new Set(r.result.cards.map((c) => c.key));
  return r.initial.filter((c) => !now.has(c.key) && (c.severity === 'red' || c.severity === 'orange' || c.severity === 'gray'));
}

export function sectionLabel(r: Review): string {
  const c = r.ex.context;
  const g = c?.grades.length ? `${c.grades.join('·')}학년 ` : '';
  return `${g}${c?.subject || r.section.subject || '교과 미상'}`;
}
