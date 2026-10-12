import { buildAlignment, countBySeverity, diffRuns, runChecks } from '../domain/rules';
import type { Card, Severity } from '../domain/types';
import { SEVERITY, cellAt, formatTime, refPath, type Run } from '../ui/helpers';
import { PageHead, Paper } from '../ui/layout';
import { Button, Icon, SeverityLabel, Swatch } from '../ui/primitives';

type Props = { prev?: Run; curr?: Run; onUpload: () => void; onResults: () => void };
type Status = 'resolved' | 'remaining' | 'added';
type Change = { where: string; from: string; to: string } | null;

/** 해결된 지적이 문서의 어느 칸에서 어떻게 바뀌었는지 */
function changeOf(card: Card, prev: Run, curr: Run): Change {
  if (card.rule === 'J6') {
    const code = card.key.split(':')[1];
    const row = buildAlignment(curr.input).find((r) => r.code === code);
    const names = row?.cells.filter((c) => c.via).map((c) => curr.input.plan.find((p) => p.id === c.assessmentId)?.name);
    if (names?.length) return { where: '정렬 맵 · 평가 요소 표에 코드가 들어감', from: '연결 없음', to: names.join(', ') };
  }
  for (const loc of card.emphasis ?? card.locations) {
    const a = cellAt(prev.docs, loc);
    const b = cellAt(curr.docs, loc);
    if (a === b) continue;
    const phrase = card.highlights?.find((h) => a.includes(h));
    if (phrase) return { where: refPath(curr.docs, loc), from: phrase, to: b.includes(phrase) ? phrase : '표현을 바꿈' };
    if (a.length > 28 || b.length > 28) return { where: refPath(curr.docs, loc), from: '이전 문장', to: '고친 문장' };
    return { where: refPath(curr.docs, loc), from: a, to: b };
  }
  return null;
}

export default function Recheck({ prev, curr, onUpload, onResults }: Props) {
  if (!prev || !curr)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHead title="고친 문서를 다시 올리면 이전 점검과 비교해 보여 드려요" sub="해결된 것, 남은 것, 새로 생긴 것을 한 목록에서 보여 줘요." />
        <div className="px-8">
          <Button variant="primary" size="lg" onClick={onUpload}>
            고친 문서 다시 올리기
          </Button>
        </div>
      </div>
    );

  const pc = runChecks(prev.input).cards;
  const cc = runChecks(curr.input).cards;
  const d = diffRuns(pc, cc);
  const resolvedRed = d.resolved.filter((c) => c.severity === 'red').length;
  const rows: { s: Status; c: Card }[] = [
    ...d.resolved.map((c) => ({ s: 'resolved' as const, c })),
    ...d.remaining.map((c) => ({ s: 'remaining' as const, c })),
    ...d.added.map((c) => ({ s: 'added' as const, c })),
  ];
  const title = d.resolved.length ? `지난 점검의 ${pc.length}건 중 ${d.resolved.length}건이 해결됐어요` : '지난 점검과 비교해 해결된 지적이 없어요';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHead
        title={title}
        sub={`확인된 오류 ${resolvedRed}건을 포함해 ${d.resolved.length}건이 문서에서 고쳐졌어요. 남은 ${d.remaining.length}건${
          d.remaining.length ? `은 ${[...new Set(d.remaining.map((c) => SEVERITY[c.severity].label))].join('·')} 카드예요` : '이 없어요'
        }. 새로 생긴 지적 ${d.added.length}건.`}
        right={
          <>
            <Button onClick={onResults}>지금 결과 보기</Button>
            <Button variant="primary" onClick={onUpload}>
              다시 올리기
            </Button>
          </>
        }
      />

      <div className="mx-8 flex shrink-0 items-stretch gap-3">
        <RunBox run={prev} cards={pc} tag="지난 점검" />
        <div className="flex items-center text-ink-3">{Icon.arrow('h-5 w-5')}</div>
        <RunBox run={curr} cards={cc} tag="이번 점검" now />
        <div className="ml-3 flex items-center gap-2">
          <StatusPill s="resolved" n={d.resolved.length} />
          <StatusPill s="remaining" n={d.remaining.length} />
          <StatusPill s="added" n={d.added.length} />
        </div>
      </div>

      <div className="min-h-0 flex-1 px-8 pb-8 pt-5">
        <Paper className="max-h-full overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-paper">
              <tr className="text-left text-meta text-ink-3">
                <th className="w-[124px] border-b border-line px-5 py-2.5 font-semibold">상태</th>
                <th className="w-[176px] border-b border-line px-3 py-2.5 font-semibold">종류</th>
                <th className="border-b border-line px-3 py-2.5 font-semibold">지적</th>
                <th className="w-[380px] border-b border-line px-5 py-2.5 font-semibold">문서에서 바뀐 곳</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, c }) => {
                const ch = s === 'resolved' ? changeOf(c, prev, curr) : null;
                return (
                  <tr key={c.key} className="border-b border-line-2 last:border-0">
                    <td className="px-5 py-4 align-top">
                      <StatusBadge s={s} />
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <SeverityLabel s={c.severity} />
                    </td>
                    <td className={`px-3 py-3.5 align-top text-[15px] font-semibold leading-[22px] ${s === 'resolved' ? 'text-ink-2' : 'text-ink'}`}>{c.title}</td>
                    <td className="px-5 py-3.5 align-top text-[14px]">
                      {ch ? (
                        <>
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-ink-3 line-through decoration-ink-3">{ch.from}</span>
                            <span className="text-ink-3">→</span>
                            <span className="font-semibold text-pen">{ch.to}</span>
                          </div>
                          <div className="mt-0.5 truncate text-meta text-ink-3">{ch.where}</div>
                        </>
                      ) : (
                        <span className="text-meta text-ink-3">{s === 'remaining' ? '그대로예요' : s === 'added' ? '이번에 처음 나왔어요' : '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Paper>
      </div>
    </div>
  );
}

const SHORT: Record<Severity, string> = { red: '확인된 오류', orange: '권고', gray: '연결 확인', yellow: '제안' };

const STATUS: Record<Status, { label: string; cls: string }> = {
  resolved: { label: '해결됨', cls: 'bg-pen text-white' },
  remaining: { label: '남음', cls: 'bg-desk-2 text-ink shadow-[inset_0_0_0_1px_#c3c7ce]' },
  added: { label: '새로 생김', cls: 'bg-graphite text-white' },
};

function StatusBadge({ s }: { s: Status }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-meta font-semibold ${STATUS[s].cls}`}>
      {s === 'resolved' && Icon.check('h-3.5 w-3.5')}
      {STATUS[s].label}
    </span>
  );
}

function StatusPill({ s, n }: { s: Status; n: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl bg-paper px-5 shadow-paper">
      <span className={`text-stat font-bold ${s === 'resolved' ? 'text-pen' : n ? 'text-ink' : 'text-ink-3'}`}>{n}</span>
      <span className="text-meta text-ink-3">{STATUS[s].label}</span>
    </div>
  );
}

function RunBox({ run, cards, tag, now }: { run: Run; cards: Card[]; tag: string; now?: boolean }) {
  const n = countBySeverity(cards);
  return (
    <Paper className="flex-1 px-5 py-3">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className={`text-meta font-semibold ${now ? 'text-ink' : 'text-ink-3'}`}>{tag}</span>
        <span className="text-[15px] font-semibold text-ink">{run.label}</span>
        <span className="text-meta text-ink-3">{formatTime(run.at)}</span>
      </div>
      <div className="mt-1.5 flex gap-4 whitespace-nowrap">
        {(['red', 'orange', 'gray', 'yellow'] as Severity[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5 text-meta text-ink-2">
            <Swatch s={s} />
            {SHORT[s]}
            <span className={`text-[16px] font-bold ${n[s] ? SEVERITY[s].ink : 'text-ink-3'}`}>{n[s]}</span>
          </div>
        ))}
      </div>
    </Paper>
  );
}
