import { fillMerged } from '../domain/extract';
import type { CellRef, CheckInput, Extraction, ParsedDocument, Severity, Strength } from '../domain/types';

export type Docs = { plan: ParsedDocument; rubric: ParsedDocument };

export type Run = {
  id: number;
  label: string;
  at: Date;
  docs: Docs;
  input: CheckInput;
  confirmMs: number;
  /** 교사가 확인 화면에서 고친 값의 원문 칸 */
  editedRefs: CellRef[];
};

export const DOC_NAME = { plan: '평가계획서', rubric: '채점기준표' } as const;

export const SEVERITY: Record<Severity, { label: string; dot: string; bg: string; ink: string; mark: string; swatch: string }> = {
  red: { label: '확인된 오류', dot: 'bg-sev-red', bg: 'bg-sev-red-bg', ink: 'text-sev-red-ink', mark: 'mark-red', swatch: 'bg-sev-red-mark' },
  orange: { label: '지침 권고와 다름', dot: 'bg-sev-orange', bg: 'bg-sev-orange-bg', ink: 'text-sev-orange-ink', mark: 'mark-orange', swatch: 'bg-sev-orange-mark' },
  gray: { label: '연결 확인 필요', dot: 'bg-sev-gray', bg: 'bg-sev-gray-bg', ink: 'text-sev-gray-ink', mark: 'mark-gray', swatch: 'bg-sev-gray-mark' },
  yellow: { label: '제안', dot: 'bg-sev-yellow', bg: 'bg-sev-yellow-bg', ink: 'text-sev-yellow-ink', mark: 'mark-yellow', swatch: 'bg-sev-yellow-mark' },
};

export const STRENGTHS: Strength[] = ['사실', '의무', '권고', '제안'];
export const STRENGTH_HINT: Record<Strength, string> = {
  사실: '문서 값으로 확인되는 사실',
  의무: '원문이 의무로 쓴 사항',
  권고: '원문이 권고로 쓴 사항',
  제안: '판정하지 않는 질문',
};

export function cellAt(docs: Docs, ref: CellRef): string {
  const t = docs[ref.doc].tables[ref.table];
  if (!t) return '';
  return fillMerged(t)[ref.row]?.[ref.col] ?? '';
}

const cleanHeader = (h: string) => h.replace(/\s*\((점|%)\)\s*/g, '').trim();
export const cleanTitle = (t: string) => t.replace(/^\s*\d+[.)]\s*/, '').trim();

/** 교사가 읽는 위치: "평가계획서 › 평가 개요 › 프로그래밍 프로젝트 › 만점" */
export function refPath(docs: Docs, ref: CellRef): string {
  const t = docs[ref.doc].tables[ref.table];
  if (!t) return DOC_NAME[ref.doc];
  const g = fillMerged(t);
  const header = g[0] ?? [];
  const row = g[ref.row] ?? [];
  const parts: string[] = [DOC_NAME[ref.doc], cleanTitle(t.title) || `표${ref.table + 1}`];
  const codeCol = header.findIndex((h) => /코드/.test(h));
  const elCol = header.findIndex((h) => /평가요소/.test(h));
  if (ref.row > 0) {
    if (codeCol >= 0 && elCol < 0 && !/평가명/.test(header[0] ?? '')) parts.push(row[codeCol]);
    else {
      if (ref.col !== 0 && row[0]) parts.push(row[0]);
      if (elCol > 0 && ref.col !== elCol && row[elCol]) parts.push(row[elCol]);
    }
  }
  parts.push(cleanHeader(header[ref.col] ?? ''));
  return parts.filter(Boolean).join(' › ');
}

export const sameRef = (a?: CellRef | null, b?: CellRef | null) =>
  !!a && !!b && a.doc === b.doc && a.table === b.table && a.row === b.row && a.col === b.col;

export const refKey = (r: CellRef) => `${r.doc}-${r.table}-${r.row}-${r.col}`;

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`;
}

export const formatTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** 교사가 확인 화면에서 바꾼 값들의 원문 칸 */
export function editedRefs(orig: Extraction, ex: Extraction): CellRef[] {
  const out: CellRef[] = [];
  const cmp = (a: unknown, b: unknown, ref?: CellRef) => {
    if (ref && JSON.stringify(a) !== JSON.stringify(b)) out.push(ref);
  };
  for (const kind of ['plan', 'rubric'] as const)
    ex[kind].forEach((a, i) => {
      const o = orig[kind][i];
      if (!o) return;
      cmp(o.name, a.name, a.source);
      cmp(o.weightPercent, a.weightPercent, a.refs?.weightPercent);
      cmp(o.maxScore, a.maxScore, a.refs?.maxScore);
      a.elements.forEach((e, j) => {
        const oe = o.elements[j];
        if (!oe) return;
        cmp(oe.name, e.name, e.refs?.name);
        cmp(oe.points, e.points, e.refs?.points);
        cmp(oe.standards, e.standards, e.refs?.standards);
        cmp(oe.rubricText, e.rubricText, e.refs?.rubricText);
      });
    });
  return out;
}
