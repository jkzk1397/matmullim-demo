import type { ReactNode } from 'react';
import type { CellRef, ParsedTable } from '../domain/types';
import { refKey, sameRef } from './helpers';
import { Icon } from './primitives';

export type Step = 'upload' | 'overview' | 'review' | 'map' | 'report';
export const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: '올리기' },
  { id: 'overview', label: '전체 현황' },
  { id: 'review', label: '점검' },
  { id: 'map', label: '정렬 맵' },
  { id: 'report', label: '보고서' },
];

const LOGO = `${import.meta.env.BASE_URL}brand/logo-mark.png`;

/** 흰 상단바 + 아래 1px 선 */
export function Header({ step, enabled, onStep }: { step: Step; enabled: Record<Step, boolean>; onStep: (s: Step) => void }) {
  const idx = STEPS.findIndex((s) => s.id === step);
  return (
    <header className="shrink-0 border-b border-line bg-paper">
      <div className="mx-auto flex h-14 w-[calc(100%-48px)] max-w-page items-center justify-between">
        <div className="flex w-[260px] items-center gap-2">
          <img src={LOGO} alt="" className="h-8 w-8" />
          <span className="text-key font-extrabold tracking-[-0.03em] text-brand-navy">맞물림</span>
        </div>
        <nav className="flex h-full items-stretch" aria-label="단계">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const done = i < idx && enabled[s.id];
            return (
              <button
                key={s.id}
                type="button"
                disabled={!enabled[s.id]}
                onClick={() => onStep(s.id)}
                aria-current={active ? 'step' : undefined}
                className={`relative flex items-center gap-2 px-4 text-help transition-colors duration-150 disabled:cursor-default ${
                  active ? 'font-bold text-brand-navy' : done ? 'font-bold text-ink-2 hover:text-brand-navy' : 'text-ink-3 enabled:hover:text-ink'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-help font-bold ${
                    active ? 'bg-brand-navy text-white' : done ? 'bg-brand-green-50 text-brand-green' : 'bg-canvas text-ink-3'
                  }`}
                >
                  {done ? Icon.check('h-3.5 w-3.5') : i + 1}
                </span>
                {s.label}
                {active && <span className="absolute bottom-0 left-3 right-3 h-[3px] rounded-t bg-brand-navy" aria-hidden />}
              </button>
            );
          })}
        </nav>
        <div className="flex w-[260px] items-center justify-end gap-2">
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-2 hover:bg-canvas" aria-label="도움말">
            {Icon.help('h-5 w-5')}
          </button>
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-2 hover:bg-canvas" aria-label="설정">
            {Icon.gear('h-5 w-5')}
          </button>
          <button type="button" className="ml-2 flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-canvas" aria-label="내 계정">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-navy text-help font-bold text-white">정</span>
            <span className="text-help font-bold text-ink">○○중 정보과</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/** 화면 폭: 최대 1240px 가운데 */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto flex min-h-0 w-[calc(100%-48px)] max-w-page flex-1 flex-col ${className}`}>{children}</div>;
}

export function PageHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-end justify-between gap-8 pb-4 pt-4">
      <div className="min-w-0">
        <h1 className="text-title font-extrabold tracking-[-0.03em] text-ink">{title}</h1>
        {sub && <p className="mt-1 text-body text-ink-3">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

/** 원문 표 (확인 화면). 선택한 칸에만 점선 테두리 */
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
      <h3 className="mb-2 text-help font-bold text-ink-2">{table.title}</h3>
      <table className="w-full border-collapse text-help">
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
                    className={`border border-line px-2 py-2 text-left align-top ${r === 0 ? 'bg-canvas font-bold text-ink-2' : 'text-ink'} ${
                      /^\[[^\]]+\]$/.test(text.trim()) ? 'whitespace-nowrap' : ''
                    } ${rec ? 'cursor-pointer hover:bg-brand-blue-50' : ''} ${
                      hi ? 'bg-brand-blue-50 font-bold outline-dashed outline-2 -outline-offset-[3px] outline-brand-blue' : ''
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
