import type { ReactNode } from 'react';
import type { CellRef, ParsedTable } from '../domain/types';
import { sameRef } from './helpers';
import { Icon } from './primitives';

export type Step = 'upload' | 'confirm' | 'results' | 'map' | 'recheck';
export const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: '올리기' },
  { id: 'confirm', label: '확인' },
  { id: 'results', label: '결과' },
  { id: 'map', label: '정렬 맵' },
  { id: 'recheck', label: '재점검' },
];

export function Header({ step, enabled, onStep }: { step: Step; enabled: Record<Step, boolean>; onStep: (s: Step) => void }) {
  const idx = STEPS.findIndex((s) => s.id === step);
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-white px-8">
      <div className="flex items-baseline gap-3">
        <span className="text-[20px] font-bold tracking-tight text-ink">「맞물림」</span>
        <span className="text-meta text-ink-3">교·수·평 정렬 사전 점검</span>
      </div>
      <nav className="flex items-center gap-1" aria-label="단계">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const done = i < idx;
          return (
            <div key={s.id} className="flex items-center">
              {i > 0 && <span className={`mx-1 h-px w-6 ${i <= idx ? 'bg-accent' : 'bg-line'}`} />}
              <button
                type="button"
                disabled={!enabled[s.id]}
                onClick={() => onStep(s.id)}
                aria-current={active ? 'step' : undefined}
                className={`flex h-9 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-[14px] transition-colors disabled:cursor-default ${
                  active ? 'bg-accent text-white' : done ? 'text-accent hover:bg-accent-50' : 'text-ink-3 enabled:hover:bg-canvas'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${
                    active ? 'bg-white text-accent' : done ? 'bg-accent-100 text-accent' : 'bg-canvas text-ink-3'
                  }`}
                >
                  {done ? Icon.check('h-3.5 w-3.5') : i + 1}
                </span>
                <span className={active ? 'font-semibold' : ''}>{s.label}</span>
              </button>
            </div>
          );
        })}
      </nav>
      <div className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-meta text-ink-2">
        {Icon.lock('h-4 w-4 text-accent')}
        모든 처리는 브라우저 안에서 · 서버로 보내지 않음
      </div>
    </header>
  );
}

export function PageHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-end justify-between gap-8 px-8 pb-5 pt-7">
      <div className="min-w-0">
        <h1 className="text-h1 font-bold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-1.5 text-body text-ink-3">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

/** 원문 표 렌더링. highlight 칸은 남색 테두리, marks 칸은 옅게 표시 */
export function DocTable({
  table,
  index,
  doc,
  highlight,
  marks = [],
  onCell,
  compact,
}: {
  table: ParsedTable;
  index: number;
  doc: 'plan' | 'rubric';
  highlight?: CellRef | null;
  marks?: CellRef[];
  onCell?: (ref: CellRef) => void;
  compact?: boolean;
}) {
  const covered = new Set<string>();
  const spanAt = new Map<string, { rowSpan: number; colSpan: number }>();
  for (const s of table.spans) {
    spanAt.set(`${s.row},${s.col}`, s);
    for (let r = s.row; r < s.row + s.rowSpan; r++)
      for (let c = s.col; c < s.col + s.colSpan; c++) if (r !== s.row || c !== s.col) covered.add(`${r},${c}`);
  }
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="rounded bg-canvas px-1.5 py-0.5 text-[12px] font-semibold text-ink-3">표{index + 1}</span>
        <span className="text-[14px] font-semibold text-ink-2">{table.title}</span>
      </div>
      <table className="w-full border-collapse text-[13px] leading-5">
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((text, c) => {
                if (covered.has(`${r},${c}`)) return null;
                const sp = spanAt.get(`${r},${c}`);
                const ref = { doc, table: index, row: r, col: c };
                const hi = sameRef(highlight, ref);
                const marked = marks.some((m) => sameRef(m, ref));
                const Tag = r === 0 ? 'th' : 'td';
                return (
                  <Tag
                    key={c}
                    id={`cell-${doc}-${index}-${r}-${c}`}
                    rowSpan={sp?.rowSpan}
                    colSpan={sp?.colSpan}
                    onClick={onCell ? () => onCell(ref) : undefined}
                    className={`border border-line ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} text-left align-top ${
                      r === 0 ? 'bg-canvas font-semibold text-ink-2' : 'text-ink'
                    } ${hi ? 'relative bg-accent-50 outline outline-2 -outline-offset-1 outline-accent' : marked ? 'bg-accent-50/60' : ''} ${
                      onCell ? 'cursor-pointer' : ''
                    } ${/^\[[^\]]+\]$/.test(text.trim()) ? 'whitespace-nowrap' : ''}`}
                  >
                    {text}
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
