import type { ReactNode } from 'react';
import type { Severity, Strength } from '../domain/types';
import { SEVERITY, STRENGTH_HINT } from './helpers';

export function SeverityBadge({ s, size = 'md' }: { s: Severity; size?: 'sm' | 'md' }) {
  const v = SEVERITY[s];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md ${v.bg} ${v.ink} font-semibold ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[12px] leading-4' : 'px-2 py-0.5 text-meta'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${v.dot}`} />
      {v.label}
    </span>
  );
}

export function StrengthTag({ s }: { s: Strength }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-meta text-ink-2" title={STRENGTH_HINT[s]}>
      강도 <b className="font-semibold text-ink">{s}</b>
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-md bg-canvas px-2 py-0.5 text-meta text-ink-2">{children}</span>;
}

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  className?: string;
  size?: 'md' | 'lg';
};

export function Button({ children, onClick, variant = 'secondary', disabled, className = '', size = 'md' }: BtnProps) {
  const base = `inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
    size === 'lg' ? 'h-12 px-6 text-body' : 'h-9 px-3.5 text-[14px]'
  }`;
  const v = {
    primary: 'bg-accent text-white hover:bg-accent-600',
    secondary: 'border border-line bg-white text-ink hover:bg-canvas',
    ghost: 'text-accent hover:bg-accent-50',
  }[variant];
  return (
    <button type="button" className={`${base} ${v} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/** 인용 박스: 왼쪽 굵은 선 + 옅은 배경 */
export function Quote({ label, children, tone = 'neutral' }: { label: ReactNode; children: ReactNode; tone?: 'neutral' | 'accent' }) {
  return (
    <figure className={`rounded-lg border-l-[3px] ${tone === 'accent' ? 'border-accent bg-accent-50/60' : 'border-ink-4 bg-canvas'} px-4 py-3`}>
      <figcaption className="mb-1 text-meta text-ink-3">{label}</figcaption>
      <div className="whitespace-pre-line text-body text-ink">{children}</div>
    </figure>
  );
}

/** 텍스트 안의 구절을 강조한다 */
export function Highlight({ text, marks }: { text: string; marks?: string[] }) {
  if (!marks?.length) return <>{text}</>;
  const esc = marks.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${esc.join('|')})`, 'g'));
  return (
    <>
      {parts.map((p, i) =>
        marks.includes(p) ? (
          <mark key={i} className="rounded bg-sev-orange-bg px-0.5 font-semibold text-sev-orange-ink underline decoration-sev-orange decoration-2 underline-offset-4">
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
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="9" width="12" height="8" rx="2" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  ),
  check: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  ),
  arrow: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  ),
  file: (c = 'h-5 w-5') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M5 2.5h6.5L15.5 6.5V17a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z" />
      <path d="M11.5 2.5V6.5H15.5" />
    </svg>
  ),
  upload: (c = 'h-5 w-5') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13V4M6 8l4-4 4 4M4 15.5h12" />
    </svg>
  ),
};
