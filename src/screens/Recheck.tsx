import { countBySeverity, diffRuns, runChecks } from '../domain/rules';
import type { Card } from '../domain/types';
import { SEVERITY, formatDuration, formatTime, type Run } from '../ui/helpers';
import { PageHead } from '../ui/layout';
import { Button, Icon, SeverityBadge } from '../ui/primitives';

type Props = { prev?: Run; curr?: Run; onUpload: () => void; onResults: () => void };

export default function Recheck({ prev, curr, onUpload, onResults }: Props) {
  if (!prev || !curr)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHead title="고친 문서를 다시 올리면 이전 점검과 비교해 보여 드려요" sub="해결된 것, 남은 것, 새로 생긴 것을 카드 단위로 나눠 보여 줘요." />
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
  const title = d.resolved.length ? `이전 점검과 비교해 ${d.resolved.length}건이 해결됐어요` : '이전 점검과 비교해 해결된 지적이 없어요';
  const remainingSev = [...new Set(d.remaining.map((c) => SEVERITY[c.severity].label))].join('·');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHead
        title={title}
        sub={
          <>
            확인된 오류 {resolvedRed}건 포함
            {d.remaining.length ? ` · 남은 ${d.remaining.length}건은 ${remainingSev} 카드예요` : ' · 남은 지적이 없어요'}
            {d.added.length ? ` · 새로 생긴 지적 ${d.added.length}건` : ' · 새로 생긴 지적은 없어요'}
          </>
        }
        right={
          <>
            <Button onClick={onResults}>현재 결과 보기</Button>
            <Button variant="primary" onClick={onUpload}>
              다시 올리기
            </Button>
          </>
        }
      />

      <div className="flex shrink-0 items-stretch gap-4 px-8">
        <RunBox run={prev} cards={pc} tag="이전" />
        <div className="flex items-center text-ink-4">{Icon.arrow('h-6 w-6')}</div>
        <RunBox run={curr} cards={cc} tag="지금" />
      </div>

      <div className="grid min-h-0 grid-cols-3 content-start items-start gap-5 px-8 pb-8 pt-6">
        <Column title="해결됨" count={d.resolved.length} cards={d.resolved} kind="resolved" />
        <Column title="남음" count={d.remaining.length} cards={d.remaining} kind="remaining" />
        <Column title="새로 생김" count={d.added.length} cards={d.added} kind="added" />
      </div>
    </div>
  );
}

function RunBox({ run, cards, tag }: { run: Run; cards: Card[]; tag: string }) {
  const n = countBySeverity(cards);
  return (
    <div className="flex flex-1 items-center justify-between rounded-xl border border-line px-5 py-4">
      <div>
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold ${tag === '지금' ? 'bg-accent text-white' : 'bg-canvas text-ink-3'}`}>{tag}</span>
          <span className="font-semibold">{run.label}</span>
        </div>
        <div className="mt-1 text-meta text-ink-3">
          {formatTime(run.at)} 점검 · 확인 {formatDuration(run.confirmMs)} · {run.docs.plan.fileName}, {run.docs.rubric.fileName}
        </div>
      </div>
      <div className="flex gap-4">
        {(['red', 'orange', 'gray', 'yellow'] as const).map((s) => (
          <div key={s} className="text-center">
            <div className={`text-[24px] font-bold leading-8 ${n[s] ? SEVERITY[s].ink : 'text-ink-4'}`}>{n[s]}</div>
            <div className="flex items-center gap-1 text-[12px] text-ink-3">
              <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY[s].dot}`} />
              {SEVERITY[s].short}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Column({ title, count, cards, kind }: { title: string; count: number; cards: Card[]; kind: 'resolved' | 'remaining' | 'added' }) {
  const head = {
    resolved: 'bg-accent text-white',
    remaining: 'bg-canvas text-ink-2',
    added: 'bg-canvas text-ink-2',
  }[kind];
  return (
    <section className="flex max-h-[600px] min-h-[340px] flex-col rounded-xl border border-line">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <span className="flex items-center gap-2 text-h2 font-semibold">
          {kind === 'resolved' && <span className="text-accent">{Icon.check('h-5 w-5')}</span>}
          {title}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-[14px] font-semibold ${head}`}>{count}</span>
      </div>
      <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {cards.map((c) => (
          <div key={c.key} className={`rounded-lg border border-l-4 border-line ${SEVERITY[c.severity].border} px-4 py-3 ${kind === 'resolved' ? 'bg-canvas/60' : 'bg-white'}`}>
            <div className="flex items-center gap-2">
              <SeverityBadge s={c.severity} size="sm" />
              <span className="text-[12px] text-ink-4">{c.rule}</span>
              {kind === 'resolved' && <span className="ml-auto text-[12px] font-semibold text-accent">해결됨</span>}
            </div>
            <div className={`mt-1.5 text-[14px] font-semibold leading-[22px] ${kind === 'resolved' ? 'text-ink-2' : 'text-ink'}`}>{c.title}</div>
          </div>
        ))}
        {!cards.length && <div className="px-2 py-6 text-center text-meta text-ink-4">없음</div>}
      </div>
    </section>
  );
}
