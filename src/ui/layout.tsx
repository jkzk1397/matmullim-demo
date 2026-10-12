import type { ReactNode } from 'react';
import type { CellRef, ParsedTable } from '../domain/types';
import { refKey, sameRef } from './helpers';
import { Icon } from './primitives';

export type Step = 'upload' | 'confirm' | 'results' | 'map' | 'recheck';
export const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: '올리기' },
  { id: 'confirm', label: '확인' },
  { id: 'results', label: '결과' },
  { id: 'map', label: '정렬 맵' },
  { id: 'recheck', label: '재점검' },
];

/** 흑연색 상단바. 지금 단계는 형광펜 밑줄로 표시 */
export function Header({ step, enabled, onStep }: { step: Step; enabled: Record<Step, boolean>; onStep: (s: Step) => void }) {
  const idx = STEPS.findIndex((s) => s.id === step);
  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-graphite px-8 text-graphite-ink">
      <div className="flex w-[260px] items-baseline gap-3">
        <span className="text-[19px] font-bold tracking-[-0.02em] text-white">「맞물림」</span>
        <span className="text-meta">교·수·평 사전 점검</span>
      </div>
      <nav className="flex h-full items-stretch gap-1" aria-label="단계">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const done = i < idx;
          return (
            <button
              key={s.id}
              type="button"
              disabled={!enabled[s.id]}
              onClick={() => onStep(s.id)}
              aria-current={active ? 'step' : undefined}
              className={`group flex items-center gap-2 px-3.5 text-[14px] transition-colors duration-150 disabled:cursor-default disabled:opacity-50 ${
                active ? 'text-white' : 'enabled:hover:text-white'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                  active ? 'bg-white text-graphite' : done ? 'bg-graphite-2 text-white' : 'bg-graphite-2 text-graphite-ink'
                }`}
              >
                {done ? Icon.check('h-3 w-3') : i + 1}
              </span>
              <span className={`relative ${active ? 'font-semibold' : ''}`}>
                {s.label}
                {active && <span className="absolute -bottom-1.5 left-0 right-0 h-[2px] rounded-sm bg-white" aria-hidden />}
              </span>
            </button>
          );
        })}
      </nav>
      <div className="flex w-[260px] items-center justify-end gap-2 text-meta">
        {Icon.lock('h-4 w-4 text-white')}
        브라우저 안에서만 처리 · 서버 전송 없음
      </div>
    </header>
  );
}

export function PageHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-end justify-between gap-8 px-8 pb-4 pt-5">
      <div className="min-w-0">
        <h1 className="text-h1 font-bold tracking-[-0.025em] text-ink">{title}</h1>
        {sub && <p className="mt-1 text-body text-ink-3">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

/** 흰 종이 한 장 */
export function Paper({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl bg-paper shadow-paper ${className}`}>{children}</section>;
}

/** 원문 표 렌더링 (확인 화면). 인식한 칸은 볼펜 점선, 지금 칸은 볼펜 실선 */
export function DocTable({
  table,
  index,
  doc,
  highlight,
  recognized,
  onCell,
}: {
  table: ParsedTable;
  index: number;
  doc: 'plan' | 'rubric';
  highlight?: CellRef | null;
  recognized?: Set<string>;
  onCell?: (ref: CellRef) => void;
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
      <h3 className="mb-2 text-[14px] font-semibold text-ink-2">{table.title}</h3>
      <table className="w-full border-collapse text-[13px] leading-5">
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((text, c) => {
                if (covered.has(`${r},${c}`)) return null;
                const sp = spanAt.get(`${r},${c}`);
                const ref = { doc, table: index, row: r, col: c };
                const hi = sameRef(highlight, ref);
                const rec = recognized?.has(refKey(ref));
                const Tag = r === 0 ? 'th' : 'td';
                return (
                  <Tag
                    key={c}
                    id={`cell-${refKey(ref)}`}
                    rowSpan={sp?.rowSpan}
                    colSpan={sp?.colSpan}
                    onClick={rec && onCell ? () => onCell(ref) : undefined}
                    className={`relative border border-line px-2.5 py-1.5 text-left align-top ${r === 0 ? 'bg-desk-2 font-semibold text-ink-2' : 'text-ink'} ${
                      /^\[[^\]]+\]$/.test(text.trim()) ? 'whitespace-nowrap' : ''
                    } ${rec ? 'cursor-pointer hover:bg-pen-50' : ''} ${
                      hi ? 'bg-pen-50 outline outline-2 -outline-offset-2 outline-pen' : rec ? 'outline-dashed outline-1 -outline-offset-[3px] outline-pen/40' : ''
                    }`}
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
