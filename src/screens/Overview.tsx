import { curriculumLabel } from '../domain/standards';
import { counts, resolvedCards, sectionLabel, type Review } from '../domain/workspace';
import type { Severity } from '../domain/types';
import { SEVERITY } from '../ui/helpers';
import { Button, Dot, Icon } from '../ui/primitives';

type Props = { reviews: Review[]; onOpen: (id: string) => void; onReport: () => void; onAdd: () => void };

const SEVS: Severity[] = ['red', 'orange', 'gray'];

export default function Overview({ reviews, onOpen, onReport, onAdd }: Props) {
  const total = { red: 0, orange: 0, gray: 0, yellow: 0 } as Record<Severity, number>;
  for (const r of reviews) {
    const n = counts(r);
    (Object.keys(total) as Severity[]).forEach((k) => (total[k] += n[k]));
  }
  const needFix = reviews.filter((r) => counts(r).red > 0).length;
  const files = new Set(reviews.map((r) => r.source.id)).size;
  const sorted = [...reviews].sort((a, b) => score(b) - score(a));

  return (
    <div className="mx-auto flex w-[calc(100%-48px)] max-w-page flex-1 flex-col gap-5 py-6">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-title font-extrabold tracking-[-0.03em] text-ink">
            {reviews.length}개 교과 중 <span className="text-sev-red">{needFix}개 교과</span>에 확인된 오류가 있어요
          </h1>
          <p className="mt-1 text-body text-ink-3">
            파일 {files}개 · 교과 {reviews.length}개 · 확인된 오류 {total.red}건 · 지침과 다름 {total.orange}건 · 확인 필요 {total.gray}건
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
        <Stat label="확인된 오류" value={total.red} unit="건" tone="red" />
        <Stat label="지침과 다름" value={total.orange} unit="건" tone="orange" />
        <Stat label="오류 없는 교과" value={reviews.filter((r) => counts(r).red + counts(r).orange === 0).length} unit="개" tone="green" />
      </div>

      <section className="overflow-hidden rounded-xl bg-paper shadow-card">
        <table className="w-full border-collapse text-left">
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
          <tbody>
            {sorted.map((r) => {
              const n = counts(r);
              const fixed = resolvedCards(r).length;
              const c = r.ex.context;
              const status = n.red ? ['수정 필요', 'bg-[#fdecef] text-sev-red'] : n.orange ? ['지침 확인', 'bg-[#fff1e8] text-sev-orange'] : ['통과', 'bg-brand-green-50 text-brand-green'];
              return (
                <tr key={r.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-canvas" onClick={() => onOpen(r.id)}>
                  <td className="px-5 py-3">
                    <div className="text-body font-bold text-ink">{sectionLabel(r)}</div>
                    <div className="max-w-[280px] truncate text-help text-ink-3">{r.source.name}</div>
                  </td>
                  <td className="px-3 py-3 text-help font-bold text-ink-2">{c?.curriculum === 'mixed' ? '혼재' : c?.curriculum ? curriculumLabel(c.curriculum) : '—'}</td>
                  <td className="px-3 py-3 text-help text-ink-2">{r.ex.plan.length}개</td>
                  <td className="px-3 py-3 text-help text-ink-2">{r.ex.planStandards.length}개</td>
                  {SEVS.map((s) => (
                    <td key={s} className={`px-3 py-3 text-key font-extrabold ${n[s] ? SEVERITY[s].text : 'text-line'}`}>
                      {n[s]}
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    <span className={`rounded-md px-2 py-1 text-help font-bold ${status[1]}`}>{status[0]}</span>
                    {fixed > 0 && <span className="ml-2 text-help font-bold text-brand-green">고침 {fixed}</span>}
                  </td>
                  <td className="px-5 py-3 text-right text-help font-bold text-brand-blue">열기 →</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const score = (r: Review) => {
  const n = counts(r);
  return n.red * 100 + n.orange * 10 + n.gray;
};

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
