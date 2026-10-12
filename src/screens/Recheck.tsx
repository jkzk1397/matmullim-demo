import { buildAlignment, diffRuns, runChecks } from '../domain/rules';
import { extractCodes } from '../domain/standards';
import type { Card as CardT } from '../domain/types';
import { cellAt, refPath, type Run } from '../ui/helpers';
import { Page, PageHead } from '../ui/layout';
import { Button, Card, Icon, SeverityLabel } from '../ui/primitives';

type Props = { prev?: Run; curr?: Run; onUpload: () => void; onResults: () => void };
type Status = 'resolved' | 'remaining' | 'added';
type Change = { context: string; label: string; from: string; to: string } | null;

const unitOf = (label: string) => (/\(점\)/.test(label) ? '점' : /\(%\)/.test(label) ? '%' : '');

/** 해결된 지적이 문서의 어느 칸에서 어떻게 바뀌었는지 (단위 포함) */
function changeOf(card: CardT, prev: Run, curr: Run): Change {
  if (card.rule === 'J6') {
    const code = card.key.split(':')[1];
    const row = buildAlignment(curr.input).find((r) => r.code === code);
    const names = row?.cells.filter((c) => c.via).map((c) => curr.input.plan.find((p) => p.id === c.assessmentId)?.name);
    if (names?.length) return { context: code, label: '연결', from: '없음', to: names.join(', ') };
  }
  for (const loc of card.emphasis ?? card.locations) {
    const a = cellAt(prev.docs, loc);
    const b = cellAt(curr.docs, loc);
    if (a === b) continue;
    const header = curr.docs[loc.doc].tables[loc.table]?.rows[0]?.[loc.col] ?? '';
    const parts = refPath(curr.docs, loc).split(' › ');
    const context = parts[parts.length - 2] ?? '';
    const label = header.replace(/\s*\((점|%)\)\s*/g, '').trim();
    const ca = extractCodes(a);
    const cb = extractCodes(b);
    if (ca.length || cb.length)
      return { context, label, from: ca.filter((x) => !cb.includes(x)).join(', ') || '—', to: cb.filter((x) => !ca.includes(x)).join(', ') || '삭제' };
    const phrase = card.highlights?.find((h) => a.includes(h));
    if (phrase) return { context, label, from: `‘${phrase}’`, to: b.includes(phrase) ? `‘${phrase}’` : '표현을 바꿈' };
    const u = unitOf(header);
    const fmt = (v: string) => (u && /^\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()}${u}` : v.trim());
    if (a.length > 24 || b.length > 24) return { context, label, from: '이전 문장', to: '고친 문장' };
    return { context, label, from: fmt(a), to: fmt(b) };
  }
  return null;
}

export default function Recheck({ prev, curr, onUpload, onResults }: Props) {
  if (!prev || !curr)
    return (
      <Page>
        <PageHead title="고친 문서를 다시 올리면 지난 점검과 비교해 드려요" sub="해결된 것, 남은 것, 새로 생긴 것을 한 목록에서 보여 줘요." />
        <div>
          <Button variant="primary" size="lg" onClick={onUpload}>
            고친 문서 다시 올리기
          </Button>
        </div>
      </Page>
    );

  const pc = runChecks(prev.input).cards;
  const cc = runChecks(curr.input).cards;
  const d = diffRuns(pc, cc);
  const rows: { s: Status; c: CardT }[] = [
    ...d.resolved.map((c) => ({ s: 'resolved' as const, c })),
    ...d.remaining.map((c) => ({ s: 'remaining' as const, c })),
    ...d.added.map((c) => ({ s: 'added' as const, c })),
  ];
  const pct = pc.length ? Math.round((d.resolved.length / pc.length) * 100) : 0;
  const resolvedRed = d.resolved.filter((c) => c.severity === 'red').length;

  return (
    <Page>
      <PageHead
        title={resolvedRed ? `확인된 오류 ${resolvedRed}건이 모두 해결됐어요` : '지난 점검과 비교했어요'}
        sub={`${prev.label} → ${curr.label}`}
        right={
          <>
            <Button onClick={onResults}>지금 결과 보기</Button>
            <Button variant="primary" onClick={onUpload}>
              다시 올리기
            </Button>
          </>
        }
      />

      <Card className="flex shrink-0 items-center gap-8 px-6 py-4">
        <div className="shrink-0">
          <div className="text-title font-extrabold text-ink">
            {pc.length}건 중 <span className="text-brand-green">{d.resolved.length}건 해결</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="h-3 overflow-hidden rounded-full bg-line-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand-green" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex gap-4 text-help text-ink-2">
            <span>
              해결됨 <b className="font-bold text-ink">{d.resolved.length}</b>
            </span>
            <span>
              남음 <b className="font-bold text-ink">{d.remaining.length}</b>
            </span>
            <span>
              새로 생김 <b className="font-bold text-ink">{d.added.length}</b>
            </span>
          </div>
        </div>
      </Card>

      <div className="min-h-0 flex-1 pb-6 pt-4">
        <Card className="max-h-full overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-paper">
              <tr className="text-left text-help text-ink-3">
                <th className="w-[120px] border-b border-line py-2 pl-6 pr-4 font-bold">상태</th>
                <th className="w-[168px] border-b border-line px-4 py-2 font-bold">종류</th>
                <th className="border-b border-line px-4 py-2 font-bold">지적</th>
                <th className="w-[500px] border-b border-line px-6 py-2 font-bold">바뀐 값</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, c }) => {
                const ch = s === 'resolved' ? changeOf(c, prev, curr) : null;
                return (
                  <tr key={c.key} className="border-b border-line-2 last:border-0">
                    <td className="py-2 pl-6 pr-4 align-top">
                      <StatusBadge s={s} />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <SeverityLabel s={c.severity} className={s === 'resolved' ? 'opacity-70' : ''} />
                    </td>
                    <td className={`px-4 py-2 align-top text-body ${s === 'resolved' ? 'text-ink-3' : 'font-bold text-ink'}`}>
                      <span className="line-clamp-2">{c.title}</span>
                    </td>
                    <td className="px-6 py-2 align-top text-body">
                      {ch ? (
                        <div className="flex items-baseline gap-x-2 whitespace-nowrap">
                          <span className="text-help text-ink-3">{ch.context}</span>
                          <span className="text-ink-2">{ch.label}</span>
                          <span className="text-ink-3 line-through">{ch.from}</span>
                          <span className="text-ink-3">→</span>
                          <b className="font-bold text-ink">{ch.to}</b>
                        </div>
                      ) : (
                        <span className="text-help text-ink-3">{s === 'remaining' ? '그대로예요' : s === 'added' ? '이번에 처음 나왔어요' : '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </Page>
  );
}

const STATUS: Record<Status, { label: string; cls: string }> = {
  resolved: { label: '해결됨', cls: 'bg-brand-green text-white' },
  remaining: { label: '남음', cls: 'bg-sev-gray text-white' },
  added: { label: '새로 생김', cls: 'bg-sev-red text-white' },
};

function StatusBadge({ s }: { s: Status }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-help font-bold ${STATUS[s].cls}`}>
      {s === 'resolved' && Icon.check('h-3.5 w-3.5')}
      {STATUS[s].label}
    </span>
  );
}
