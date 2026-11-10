import { useMemo } from 'react';
import { cardsCsv, itemRows } from '../domain/school';
import type { Review } from '../domain/workspace';
import { Button, Icon } from '../ui/primitives';

/** 점검 항목별 현황: 여러 학교·교과 계획서를 한꺼번에 넣었을 때 (교육청 사전 점검, 학교 전체 검토) */
export default function Summary({ reviews, onDownload }: { reviews: Review[]; onDownload: (name: string, data: string) => void }) {
  const rows = useMemo(() => itemRows(reviews), [reviews]);
  const files = new Set(reviews.map((r) => r.source.id)).size;
  const read = reviews.filter((r) => r.ex.plan.length > 0).length;
  const max = Math.max(1, ...rows.map((r) => r.flagged));
  return (
    <section className="overflow-hidden rounded-xl bg-paper shadow-card">
      <div className="flex items-end justify-between gap-4 border-b border-line px-5 py-4 narrow:flex-col narrow:items-start narrow:px-4">
        <div>
          <h2 className="text-key font-extrabold text-ink">점검 항목별 현황</h2>
          <p className="mt-0.5 text-help text-ink-3">
            파일 {files}개 · 교과 {reviews.length}개 (평가표 읽음 {read}개) · 번호는 경기도교육청 「평가 계획 수립 및 운영 자체점검표」 항목
          </p>
        </div>
        <Button onClick={() => onDownload('맞물림_점검결과.csv', cardsCsv(reviews))}>{Icon.download('h-4 w-4')} 지적 전체 내려받기 (CSV)</Button>
      </div>
      <div className="narrow:overflow-x-auto">
      <table className="w-full border-collapse text-left narrow:w-[860px]">
        <thead>
          <tr className="border-b border-line bg-canvas text-help font-bold text-ink-3">
            <th className="w-[92px] whitespace-nowrap px-5 py-3">점검표</th>
            <th className="px-3 py-3">점검 항목</th>
            <th className="w-[300px] px-3 py-3">짚은 교과</th>
            <th className="w-[96px] px-3 py-3 text-sev-red">오류</th>
            <th className="w-[96px] px-3 py-3 text-sev-orange">지침과 다름</th>
            <th className="w-[96px] px-5 py-3 text-ink-3">확인 필요</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line">
              <td className="whitespace-nowrap px-5 py-3 text-help font-bold text-ink-3">{r.checklist ?? '—'}</td>
              <td className="px-3 py-3 text-body font-bold text-ink">{r.label}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 flex-1 rounded-full bg-line-2">
                    <div className={`h-2.5 rounded-full ${r.bySev.red ? 'bg-sev-red' : r.bySev.orange ? 'bg-sev-orange' : 'bg-sev-gray'}`} style={{ width: `${(r.flagged / max) * 100}%` }} />
                  </div>
                  <span className="w-[72px] text-right text-help font-bold tabular-nums text-ink">
                    {r.flagged} / {r.sections}
                  </span>
                </div>
              </td>
              <td className={`px-3 py-3 text-key font-extrabold tabular-nums ${r.bySev.red ? 'text-sev-red' : 'text-line'}`}>{r.bySev.red}</td>
              <td className={`px-3 py-3 text-key font-extrabold tabular-nums ${r.bySev.orange ? 'text-sev-orange' : 'text-line'}`}>{r.bySev.orange}</td>
              <td className={`px-5 py-3 text-key font-extrabold tabular-nums ${r.bySev.gray ? 'text-ink-2' : 'text-line'}`}>{r.bySev.gray}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  );
}
