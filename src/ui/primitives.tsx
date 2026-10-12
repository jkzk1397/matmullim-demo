import type { ReactNode } from 'react';
import type { Severity, Strength } from '../domain/types';
import { SEVERITY, STRENGTH_BADGE, STRENGTH_HINT } from './helpers';

/** 카드 종류: 진한 색 점(10px) + 같은 색 글자 라벨 */
export function SeverityLabel({ s, className = '' }: { s: Severity; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-2 text-help font-bold ${SEVERITY[s].text} ${className}`}>
      <Dot s={s} />
      {SEVERITY[s].label}
    </span>
  );
}

export function Dot({ s }: { s: Severity }) {
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SEVERITY[s].dot}`} aria-hidden />;
}

/** 강도 배지 하나: "사실 확인" / "권고" / "제안" */
export function StrengthBadge({ s }: { s: Strength }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md border border-line px-2 text-help font-semibold text-ink-2" title={STRENGTH_HINT[s]}>
      {STRENGTH_BADGE[s]}
    </span>
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
  const base = `inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
    size === 'lg' ? 'h-12 px-6 text-body' : 'h-10 px-4 text-help'
  }`;
  const v = {
    primary: 'bg-brand-navy text-white hover:bg-brand-navy-2',
    secondary: 'bg-paper text-ink shadow-[inset_0_0_0_1px_#e3e7ed] hover:bg-canvas',
    quiet: 'px-1 text-brand-blue hover:underline underline-offset-4',
  }[variant];
  return (
    <button type="button" className={`${base} ${v} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl bg-paper shadow-card ${className}`}>{children}</section>;
}

/** 텍스트 안의 구절만 빨강 강조 */
export function Marked({ text, marks, className = 'font-bold text-sev-red' }: { text: string; marks?: string[]; className?: string }) {
  const list = (marks ?? []).filter(Boolean);
  if (!list.length) return <>{text}</>;
  const esc = list.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${esc.join('|')})`, 'g'));
  return (
    <>
      {parts.map((p, i) =>
        list.includes(p) ? (
          <strong key={i} className={className}>
            {p}
          </strong>
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
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  ),
  arrow: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  ),
  chevron: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8l4 4 4-4" />
    </svg>
  ),
  file: (c = 'h-5 w-5') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M5 2.5h6.5L15.5 6.5V17a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z" />
      <path d="M11.5 2.5V6.5H15.5" />
    </svg>
  ),
  upload: (c = 'h-6 w-6') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13V4M6 8l4-4 4 4M4 15.5h12" />
    </svg>
  ),
  pen: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13.5 3.5l3 3L7 16l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  help: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M8 8a2 2 0 1 1 2.6 1.9c-.4.1-.6.5-.6.9V12M10 14.5v.01" />
    </svg>
  ),
};
