import { useMemo, useState } from 'react';
import type { LoadNotice, LoadStats } from '../App';
import { curriculumLabel } from '../domain/standards';
import { counts, resolvedCards, sectionLabel, type Review } from '../domain/workspace';
import type { Severity } from '../domain/types';
import { SEVERITY } from '../ui/helpers';
import { Button, Dot, Icon } from '../ui/primitives';

type Props = {
  reviews: Review[];
  order: string[];
  stats: LoadStats | null;
  notice: LoadNotice | null;
  onDismissNotice: () => void;
  onOpen: (id: string) => void;
  onReport: () => void;
  onAdd: () => void;
};

const SEVS: Severity[] = ['red', 'orange', 'gray'];

export type StatusId = 'fix' | 'guide' | 'check' | 'pass' | 'noplan';
export const STATUS_LABEL: Record<StatusId, string> = { fix: '수정 필요', guide: '지침 확인', check: '확인 필요', pass: '통과', noplan: '평가표 못 읽음' };
const STATUS_TONE: Record<StatusId, string> = {
  fix: 'bg-[#fdecef] text-sev-red',
  guide: 'bg-[#fff1e8] text-sev-orange',
  check: 'bg-[#f1f3f5] text-ink-2',
  pass: 'bg-brand-green-50 text-brand-green',
  noplan: 'bg-[#f4f1e8] text-[#7a5d00] shadow-[inset_0_0_0_1px_#e6dcbf]',
};
const STATUS_RANK: Record<StatusId, number> = { fix: 5, noplan: 4, guide: 3, check: 2, pass: 1 };

export const unreadable = (r: Review) => r.ex.plan.length === 0;

/** 교과 하나의 상태. 빨강이 있으면 '수정 필요'가 먼저, 평가표를 못 읽었으면 통과로 보이지 않게 */
export function statusOf(r: Review): StatusId {
  const n = counts(r);
  if (n.red) return 'fix';
  if (unreadable(r)) return 'noplan';
  if (n.orange) return 'guide';
  if (n.gray) return 'check';
  return 'pass';
}

export function StatusBadge({ r }: { r: Review }) {
  const s = statusOf(r);
  const label = s === 'check' ? `확인 ${counts(r).gray}건` : STATUS_LABEL[s];
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2 py-1 text-help font-bold ${STATUS_TONE[s]}`}>{label}</span>;
}

type FilterId = 'all' | StatusId;
const FILTERS: FilterId[] = ['all', 'fix', 'guide', 'check', 'pass', 'noplan'];

export default function Overview({ reviews, order, stats, notice, onDismissNotice, onOpen, onReport, onAdd }: Props) {
  const [filter, setFilter] = useState<FilterId>('all');
  const [q, setQ] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const total = { red: 0, orange: 0, gray: 0, yellow: 0 } as Record<Severity, number>;
  for (const r of reviews) {
    const n = counts(r);
    (Object.keys(total) as Severity[]).forEach((k) => (total[k] += n[k]));
  }
  const needFix = reviews.filter((r) => counts(r).red > 0).length;
  const noPlan = reviews.filter(unreadable).length;
  const clean = reviews.filter((r) => !unreadable(r) && counts(r).red + counts(r).orange === 0).length;
  const files = new Set(reviews.map((r) => r.source.id)).size;

  // 처음 읽을 때 정한 순서 그대로 (고쳐도 줄이 움직이지 않게)
  const ordered = useMemo(() => {
    const pos = new Map(order.map((id, i) => [id, i]));
    return [...reviews].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
  }, [reviews, order]);

  const matches = (r: Review) => {
    if (filter !== 'all') {
      const s = statusOf(r);
      if (filter === 'noplan' ? !unreadable(r) : s !== filter) return false;
    }
    const k = q.trim().toLowerCase();
    if (k && !`${sectionLabel(r)} ${r.ex.context?.subject ?? ''} ${r.source.name}`.toLowerCase().includes(k)) return false;
    return true;
  };

  const groups: { id: string; name: string; all: Review[]; shown: Review[] }[] = [];
  for (const r of ordered) {
    let g = groups.find((x) => x.id === r.source.id);
    if (!g) groups.push((g = { id: r.source.id, name: r.source.name, all: [], shown: [] }));
    g.all.push(r);
    if (matches(r)) g.shown.push(r);
  }
  const visibleGroups = groups.filter((g) => g.shown.length);
  const countFor = (f: FilterId) => (f === 'all' ? reviews.length : reviews.filter((r) => (f === 'noplan' ? unreadable(r) : statusOf(r) === f)).length);

  const toggle = (id: string) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="min-h-0 flex-1 overflow-auto">
    <div className="mx-auto flex w-[calc(100%-48px)] max-w-page flex-col gap-5 py-6">
      {notice && (notice.failures.length > 0 || notice.duplicates.length > 0) && (
        <div role="status" className="flex items-start gap-3 rounded-xl bg-[#fff8e6] px-5 py-3 text-body text-ink shadow-[inset_0_0_0_1px_#f0dca8]">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-sev-orange" aria-hidden />
          <div className="min-w-0 flex-1">
            <b className="font-bold">
              {notice.tried}개 중 {notice.read}개 읽음
              {notice.failures.length > 0 && ` · ${notice.failures.length}개 읽지 못함`}
              {notice.duplicates.length > 0 && ` · 같은 파일 ${notice.duplicates.length}개 건너뜀`}
            </b>
            <ul className="mt-0.5 text-help text-ink-2">
              {notice.failures.map((f, i) => (
                <li key={`f${i}`}>
                  {f.name} ({f.reason})
                </li>
              ))}
              {notice.duplicates.map((d, i) => (
                <li key={`d${i}`}>{d} (이미 올린 파일과 같아요)</li>
              ))}
            </ul>
          </div>
          <button type="button" onClick={onDismissNotice} className="shrink-0 rounded-lg px-2 py-1 text-help font-bold text-ink-2 hover:bg-[#f6ecd0]" aria-label="알림 닫기">
            닫기
          </button>
        </div>
      )}

      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-title font-extrabold tracking-[-0.03em] text-ink">
            {needFix > 0 ? (
              <>
                {reviews.length}개 교과 중 <span className="text-sev-red">{needFix}개 교과</span>에 확인된 오류가 있어요
              </>
            ) : noPlan === reviews.length ? (
              <>평가표를 읽지 못해 숫자 점검을 못 했어요</>
            ) : (
              <>
                {noPlan > 0 ? '평가표를 읽은 ' : ''}
                {reviews.length - noPlan}개 교과{reviews.length - noPlan > 1 ? ' 모두' : '에'} <span className="text-brand-green">확인된 오류가 없어요</span>
              </>
            )}
          </h1>
          <p className="mt-1 text-body text-ink-3">
            파일 {stats?.files ?? files}개 · 교과 {stats?.sections ?? reviews.length}개{stats ? ` · ${(stats.ms / 1000).toFixed(1)}초` : ''}
            {noPlan > 0 && ` · 평가표 못 읽음 ${noPlan}개`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onAdd}>{Icon.upload('h-4 w-4')} 파일 더 올리기</Button>
          <Button variant="primary" onClick={onReport}>
            {Icon.print()} 전체 보고서
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="점검한 교과" value={reviews.length} unit="개" />
        <Stat label="확인된 오류" value={total.red} unit="건" tone={total.red ? 'red' : undefined} />
        <Stat label="지침과 다름" value={total.orange} unit="건" tone={total.orange ? 'orange' : undefined} />
        <Stat label="오류 없는 교과" value={clean} unit="개" tone="green" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const n = countFor(f);
          const on = filter === f;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f)}
              disabled={f !== 'all' && n === 0}
              className={`rounded-full px-3.5 py-1.5 text-help font-bold transition-colors disabled:cursor-default disabled:opacity-40 ${
                on ? 'bg-brand-navy text-white' : 'bg-paper text-ink-2 shadow-[inset_0_0_0_1px_#e3e7ed] enabled:hover:bg-canvas'
              }`}
            >
              {f === 'all' ? '전체' : STATUS_LABEL[f]} <span className={on ? 'text-white/80' : 'text-ink-3'}>{n}</span>
            </button>
          );
        })}
        <label className="ml-auto flex h-10 w-[280px] items-center gap-2 rounded-lg bg-paper px-3 shadow-[inset_0_0_0_1px_#e3e7ed] focus-within:shadow-[inset_0_0_0_1.5px_#0b5cad]">
          <svg className="h-4 w-4 shrink-0 text-ink-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13.5 13.5L17 17" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="교과·파일 이름 찾기" className="min-w-0 flex-1 bg-transparent text-help outline-none placeholder:text-ink-3" />
          {q && (
            <button type="button" onClick={() => setQ('')} className="text-help font-bold text-ink-3 hover:text-ink" aria-label="지우기">
              ×
            </button>
          )}
        </label>
      </div>

      <section className="overflow-hidden rounded-xl bg-paper shadow-card">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col />
            <col className="w-[120px]" />
            <col className="w-[96px]" />
            <col className="w-[100px]" />
            <col className="w-[130px]" />
            <col className="w-[130px]" />
            <col className="w-[120px]" />
            <col className="w-[190px]" />
            <col className="w-[96px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-line bg-canvas text-help font-bold text-ink-3">
              <th className="px-5 py-3">교과</th>
              <th className="px-3 py-3">교육과정</th>
              <th className="px-3 py-3">평가</th>
              <th className="px-3 py-3">성취기준</th>
              {SEVS.map((s) => (
                <th key={s} className={`px-3 py-3 ${SEVERITY[s].text}`}>
                  <span className="inline-flex items-center gap-1.5">
                    <Dot s={s} />
                    {SEVERITY[s].label}
                  </span>
                </th>
              ))}
              <th className="px-3 py-3">상태</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          {visibleGroups.map((g) => {
            const open = !closed.has(g.id);
            const sum = g.all.reduce((a, r) => {
              const n = counts(r);
              return { red: a.red + n.red, orange: a.orange + n.orange, gray: a.gray + n.gray };
            }, { red: 0, orange: 0, gray: 0 });
            const worst = g.all.reduce((w, r) => (STATUS_RANK[statusOf(r)] > STATUS_RANK[statusOf(w)] ? r : w), g.all[0]);
            const showHead = groups.length > 1 || g.all.length > 1;
            return (
              <tbody key={g.id}>
                {showHead && (
                  <tr className="cursor-pointer border-b border-line bg-[#f9fafb] hover:bg-canvas" onClick={() => toggle(g.id)} aria-expanded={open}>
                    <td colSpan={4} className="py-2.5 pl-5 pr-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`text-ink-3 transition-transform ${open ? '' : '-rotate-90'}`}>{Icon.chevron('h-4 w-4')}</span>
                        <span className="text-brand-blue">{Icon.file('h-4 w-4')}</span>
                        <span className="truncate text-help font-bold text-ink">{g.name}</span>
                        <span className="shrink-0 text-help text-ink-3">
                          교과 {g.all.length}개{g.shown.length !== g.all.length ? ` 중 ${g.shown.length}개 보임` : ''}
                        </span>
                      </span>
                    </td>
                    {SEVS.map((s) => (
                      <td key={s} className={`px-3 py-2.5 text-help font-extrabold ${sum[s as 'red'] ? SEVERITY[s].text : 'text-line'}`}>
                        {sum[s as 'red']}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      <StatusBadge r={worst} />
                    </td>
                    <td className="px-5 py-2.5 text-right text-help font-bold text-ink-3">{open ? '접기' : '펼치기'}</td>
                  </tr>
                )}
                {open &&
                  g.shown.map((r) => {
                    const n = counts(r);
                    const fixed = resolvedCards(r).length;
                    const c = r.ex.context;
                    return (
                      <tr key={r.id} className="cursor-pointer border-b border-line hover:bg-canvas" onClick={() => onOpen(r.id)}>
                        <td className={`py-3 pr-3 ${showHead ? 'pl-12' : 'pl-5'}`}>
                          <div className="text-body font-bold text-ink">{sectionLabel(r)}</div>
                          {!showHead && <div className="max-w-[280px] truncate text-help text-ink-3">{r.source.name}</div>}
                        </td>
                        <td className="px-3 py-3 text-help font-bold text-ink-2">{c?.curriculum === 'mixed' ? '혼재' : c?.curriculum ? curriculumLabel(c.curriculum) : '—'}</td>
                        <td className={`px-3 py-3 text-help ${unreadable(r) ? 'font-bold text-[#7a5d00]' : 'text-ink-2'}`}>{unreadable(r) ? '못 읽음' : `${r.ex.plan.length}개`}</td>
                        <td className="px-3 py-3 text-help text-ink-2">{r.ex.planStandards.length}개</td>
                        {SEVS.map((s) => (
                          <td key={s} className={`px-3 py-3 text-key font-extrabold ${n[s] ? SEVERITY[s].text : 'text-line'}`}>
                            {n[s]}
                          </td>
                        ))}
                        <td className="px-3 py-3">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <StatusBadge r={r} />
                            {n.red > 0 && unreadable(r) && <span className="text-help font-bold text-[#7a5d00]">평가표 못 읽음</span>}
                            {fixed > 0 && <span className="text-help font-bold text-brand-green">고침 {fixed}</span>}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-help font-bold text-brand-blue">열기 →</td>
                      </tr>
                    );
                  })}
              </tbody>
            );
          })}
          {!visibleGroups.length && (
            <tbody>
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-body text-ink-3">
                  조건에 맞는 교과가 없어요
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </section>
    </div>
    </div>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: number; unit: string; tone?: 'red' | 'orange' | 'green' }) {
  const color = tone === 'red' ? 'text-sev-red' : tone === 'orange' ? 'text-sev-orange' : tone === 'green' ? 'text-brand-green' : 'text-ink';
  return (
    <div className="rounded-xl bg-paper px-5 py-4 shadow-card">
      <div className="text-help font-bold text-ink-3">{label}</div>
      <div className={`mt-1 text-[34px] font-extrabold leading-none tracking-[-0.03em] ${color}`}>
        {value}
        <span className="ml-1 text-body font-bold">{unit}</span>
      </div>
    </div>
  );
}
