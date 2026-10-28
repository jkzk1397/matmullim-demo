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
    <span className="inline-flex shrink-0 items-center rounded-md border border-line px-2 text-help font-bold text-ink-2" title={STRENGTH_HINT[s]}>
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
  download: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 3.5v9M6 9l4 4 4-4M4 16h12" />
    </svg>
  ),
  print: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d="M6 7V3h8v4M6 14H4V8h12v6h-2M6 11h8v6H6z" />
    </svg>
  ),
  wand: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 16.5l9-9M11 4l.6 1.4L13 6l-1.4.6L11 8l-.6-1.4L9 6l1.4-.6zM15.5 9l.4.9.9.4-.9.4-.4.9-.4-.9-.9-.4.9-.4z" />
    </svg>
  ),
  map: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M3 8h14M3 12.5h14M8 3v14M12.5 3v14" />
    </svg>
  ),
  link: (c = 'h-3.5 w-3.5') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 4h5v5M16 4l-7 7M14 11.5V16H4V6h4.5" />
    </svg>
  ),
  shield: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d="M10 2.5l6 2.2v4.6c0 3.8-2.6 6.6-6 8.2-3.4-1.6-6-4.4-6-8.2V4.7z" />
      <path d="M7.5 10l1.8 1.8L13 8" strokeLinecap="round" />
    </svg>
  ),
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
  gear: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
  doc: (c = 'h-6 w-6') => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" strokeLinecap="round" />
    </svg>
  ),
  help: (c = 'h-4 w-4') => (
    <svg className={c} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M8 8a2 2 0 1 1 2.6 1.9c-.4.1-.6.5-.6.9V12M10 14.5v.01" />
    </svg>
  ),
};
