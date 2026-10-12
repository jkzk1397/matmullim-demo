import { fillMerged } from '../domain/extract';
import type { CellRef, CheckInput, ParsedDocument, Severity, Strength } from '../domain/types';

export type Docs = { plan: ParsedDocument; rubric: ParsedDocument };

export type Run = {
  id: number;
  label: string;
  at: Date;
  docs: Docs;
  input: CheckInput;
  confirmMs: number;
};

export const DOC_NAME = { plan: '평가계획서', rubric: '채점기준표' } as const;

export const SEVERITY: Record<Severity, { label: string; short: string; dot: string; bg: string; ink: string; border: string }> = {
  red: { label: '확인된 오류', short: '오류', dot: 'bg-sev-red', bg: 'bg-sev-red-bg', ink: 'text-sev-red-ink', border: 'border-sev-red' },
  orange: { label: '지침 권고와 다름', short: '권고', dot: 'bg-sev-orange', bg: 'bg-sev-orange-bg', ink: 'text-sev-orange-ink', border: 'border-sev-orange' },
  gray: { label: '연결 확인 필요', short: '확인', dot: 'bg-sev-gray', bg: 'bg-sev-gray-bg', ink: 'text-sev-gray-ink', border: 'border-sev-gray' },
  yellow: { label: '제안', short: '제안', dot: 'bg-sev-yellow', bg: 'bg-sev-yellow-bg', ink: 'text-sev-yellow-ink', border: 'border-sev-yellow' },
};

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

export function refLabel(docs: Docs, ref: CellRef): string {
  const t = docs[ref.doc].tables[ref.table];
  const header = t?.rows[0]?.[ref.col] ?? '';
  return `${DOC_NAME[ref.doc]} 표${ref.table + 1} · ${ref.row + 1}행 ${ref.col + 1}열${header ? ` (${header})` : ''}`;
}

export const sameRef = (a?: CellRef | null, b?: CellRef | null) =>
  !!a && !!b && a.doc === b.doc && a.table === b.table && a.row === b.row && a.col === b.col;

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`;
}

export const formatTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
