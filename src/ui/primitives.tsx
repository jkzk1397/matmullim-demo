import type { ReactNode } from 'react';
import type { Severity, Strength } from '../domain/types';
import { SEVERITY, STRENGTHS, STRENGTH_HINT } from './helpers';

/** 카드 종류 라벨: 짧은 형광펜 자국 + 글자 */
export function SeverityLabel({ s, className = '' }: { s: Severity; className?: string }) {
  const v = SEVERITY[s];
  return (
    <span className={`inline-flex shrink-0 items-center gap-2 text-meta font-semibold ${v.ink} ${className}`}>
      <Swatch s={s} />
      {v.label}
    </span>
  );
}

/** 형광펜으로 한 번 그은 자국 (회색은 연필 점선) */
export function Swatch({ s, size = 'sm' }: { s: Severity; size?: 'sm' | 'md' }) {
  const w = size === 'md' ? 'h-3.5 w-6' : 'h-3 w-4';
  if (s === 'gray')
    return (
      <svg className={`${w} shrink-0`} viewBox="0 0 24 14" aria-hidden>
        <rect x="0" y="1" width="24" height="10" rx="2" fill="#e1e4e9" />
        <line x1="1" y1="12.5" x2="23" y2="12.5" stroke="#6b7079" strokeWidth="2" strokeDasharray="2 2" />
      </svg>
    );
  return <span className={`${w} shrink-0 -skew-x-12 rounded-[3px] ${SEVERITY[s].swatch}`} aria-hidden />;
}

/** 번호 칩: 시트의 칠한 칸과 여백 카드를 잇는다 */
export function NumChip({ n, s }: { n: number; s: Severity }) {
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${SEVERITY[s].bg} ${SEVERITY[s].ink}`}>{n}</span>
  );
}

/** 근거의 강도: 사실 > 의무 > 권고 > 제안 순서의 눈금. 누르는 버튼이 아니다 */
export function StrengthScale({ s }: { s: Strength }) {
  const at = STRENGTHS.indexOf(s);
  return (
    <div className="w-[236px]" role="img" aria-label={`근거의 강도: ${s} (${STRENGTH_HINT[s]})`}>
      <div className="mb-2 text-meta text-ink-3">근거의 강도 · 강함 → 약함</div>
      <div className="relative h-2">
        <div className="absolute inset-x-[10%] top-[3px] h-0.5 rounded bg-line" />
        <div className="absolute top-[3px] h-0.5 rounded bg-graphite" style={{ left: '10%', width: `${(at / 3) * 80}%` }} />
        {STRENGTHS.map((x, i) => (
          <span
            key={x}
            className={`absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full ${i <= at ? 'bg-graphite' : 'bg-line'} ${i === at ? 'scale-150' : ''}`}
            style={{ left: `${10 + (i / 3) * 80}%` }}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 text-center text-meta">
        {STRENGTHS.map((x) => (
          <span key={x} className={x === s ? 'font-bold text-ink' : 'text-ink-3'}>
            {x}
          </span>
        ))}
      </div>
      <div className="mt-1 text-meta text-ink-2">{STRENGTH_HINT[s]}</div>
    </div>
  );
}

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  className?: string;
  size?: 'md' | 'lg';
};

export function Button({ children, onClick, variant = 'secondary', disabled, className = '', size = 'md' }: BtnProps) {
  const base = `inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
    size === 'lg' ? 'h-12 px-6 text-body' : 'h-10 px-4 text-[14px]'
  }`;
  const v = {
    primary: 'bg-graphite text-white hover:bg-graphite-2',
    secondary: 'bg-paper text-ink shadow-[inset_0_0_0_1px_#dcdfe4] hover:bg-desk-2',
    quiet: 'text-ink-2 underline decoration-line underline-offset-4 hover:text-ink hover:decoration-ink-3',
  }[variant];
  return (
    <button type="button" className={`${base} ${v} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/** 텍스트 안의 구절에 형광펜을 칠한다 */
export function Marked({ text, marks, s }: { text: string; marks?: string[]; s: Severity }) {
  const list = (marks ?? []).filter(Boolean);
  if (!list.length) return <>{text}</>;
  const esc = list.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${esc.join('|')})`, 'g'));
  return (
    <>
      {parts.map((p, i) =>
        list.includes(p) ? (
          <mark key={i} className={`mark ${SEVERITY[s].mark} bg-transparent font-semibold text-ink`}>
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export const Icon = {
  lock: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="4" y="9" width="12" height="8" rx="2" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  ),
  check: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  ),
  arrow: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  ),
  file: (c = 'h-5 w-5') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M5 2.5h6.5L15.5 6.5V17a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z" />
      <path d="M11.5 2.5V6.5H15.5" />
    </svg>
  ),
  upload: (c = 'h-5 w-5') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13V4M6 8l4-4 4 4M4 15.5h12" />
    </svg>
  ),
  pen: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13.5 3.5l3 3L7 16l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  swap: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h12M12 3l4 4-4 4M16 13H4M8 9l-4 4 4 4" />
    </svg>
  ),
};
