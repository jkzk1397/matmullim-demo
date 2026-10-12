import { useEffect, useState } from 'react';
import { countBySeverity, diffRuns, runChecks } from '../domain/rules';
import type { Action, Card, CellRef, CheckResult, Severity } from '../domain/types';
import { SEVERITY, cellAt, formatDuration, refLabel, type Docs, type Run } from '../ui/helpers';
import { PageHead } from '../ui/layout';
import { Button, Highlight, Icon, Quote, SeverityBadge, StrengthTag, Tag } from '../ui/primitives';

type Props = {
  run: Run;
  prevRun?: Run;
  result: CheckResult;
  memos: Record<string, string>;
  onMemo: (key: string, text: string) => void;
  onAction: (a: Action, card: Card) => void;
  onRecheck: () => void;
  onCompare: () => void;
  onMap: () => void;
  initialKey?: string | null;
};

const ORDER: Severity[] = ['red', 'orange', 'gray', 'yellow'];
const ACTION_LABEL: Record<Action, string> = { fix: '고치기', memo: '메모하고 넘기기', link: '연결 지정' };

export function headline(cards: Card[]): string {
  const n = countBySeverity(cards);
  const mismatch = cards.filter((c) => c.rule === 'J12' && c.severity === 'red').length;
  if (mismatch) return `평가계획과 채점기준표에서 불일치 ${mismatch}건을 찾았어요`;
  if (n.red) return `확인된 오류 ${n.red}건을 찾았어요`;
  if (n.orange) return `확인된 오류는 없고, 지침 권고와 다른 곳이 ${n.orange}건 있어요`;
  return '확인된 오류 0건 — 두 문서가 서로 맞물려요';
}

export default function Results({ run, prevRun, result, memos, onMemo, onAction, onRecheck, onCompare, onMap, initialKey }: Props) {
  const { cards, passed } = result;
  const n = countBySeverity(cards);
  const clean = n.red + n.orange + n.gray === 0;
  const [sel, setSel] = useState<string | null>(initialKey ?? (clean ? null : cards[0]?.key ?? null));
  useEffect(() => {
    if (sel && !cards.some((c) => c.key === sel)) setSel(clean ? null : cards[0]?.key ?? null);
  }, [cards, sel, clean]);
  const selected = cards.find((c) => c.key === sel);
  const diff = prevRun ? diffRuns(runChecks(prevRun.input).cards, cards) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHead
        title={headline(cards)}
        sub={
          <>
            {run.label} · 확인에 걸린 시간 <b className="font-semibold text-ink-2">{formatDuration(run.confirmMs)}</b> · 규칙과 성취기준 DB로 점검했어요 (LLM 없음 · 같은 표를 넣으면 같은 결과)
          </>
        }
        right={
          <>
            {diff && (
              <Button variant="ghost" onClick={onCompare}>
                이전 점검 대비 해결 {diff.resolved.length} · 남음 {diff.remaining.length} · 새로 {diff.added.length} {Icon.arrow()}
              </Button>
            )}
            <Button onClick={onMap}>정렬 맵</Button>
            <Button variant="primary" onClick={onRecheck}>
              {clean ? '다른 문서 올리기' : '고친 문서 다시 올리기'}
            </Button>
          </>
        }
      />

      <div className="grid shrink-0 grid-cols-4 gap-4 px-8">
        {ORDER.map((s) => (
          <div key={s} className={`flex items-center justify-between rounded-xl border border-line px-5 py-3 ${n[s] && s !== 'yellow' ? SEVERITY[s].bg : 'bg-white'}`}>
            <div className="flex items-center gap-2 text-[14px] text-ink-2">
              <span className={`h-2.5 w-2.5 rounded-full ${SEVERITY[s].dot}`} />
              {SEVERITY[s].label}
            </div>
            <div className={`text-stat font-bold ${n[s] ? SEVERITY[s].ink : 'text-ink-4'}`}>
              {n[s]}
              <span className="ml-1 text-body font-medium text-ink-3">건</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[440px_minmax(0,1fr)] gap-6 px-8 pb-8 pt-6">
        <div className="scroll-thin min-h-0 space-y-2 overflow-y-auto pr-1">
          {cards.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setSel(c.key)}
              className={`block w-full rounded-lg border border-l-4 px-4 py-3 text-left transition-colors ${SEVERITY[c.severity].border} ${
                sel === c.key ? 'border-y-accent border-r-accent bg-accent-50/50 ring-1 ring-accent' : 'border-y-line border-r-line bg-white hover:bg-canvas'
              } ${memos[c.key] ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-2">
                <SeverityBadge s={c.severity} size="sm" />
                <span className="text-[12px] text-ink-4">{c.rule}</span>
                {memos[c.key] && <span className="ml-auto text-[12px] text-ink-3">메모함 · 넘김</span>}
              </div>
              <div className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-6 text-ink">{c.title}</div>
              <div className="mt-1 truncate text-meta text-ink-3">{c.locations[0] ? refLabel(run.docs, c.locations[0]) : ''}</div>
            </button>
          ))}
          <div className={`pt-3 ${clean ? 'hidden' : ''}`}>
            <div className="mb-2 text-meta font-semibold text-ink-3">통과한 점검</div>
            <ul className="space-y-1.5">
              {passed.map((p) => (
                <li key={p.rule} className="flex items-center gap-2 text-[14px] text-ink-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-50 text-accent">{Icon.check('h-3.5 w-3.5')}</span>
                  <b className="font-semibold text-ink">{p.label}</b>
                  <span className="text-ink-3">{p.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="scroll-thin min-h-0 overflow-y-auto rounded-xl border border-line">
          {selected ? (
            <CardDetail card={selected} docs={run.docs} memo={memos[selected.key]} onMemo={onMemo} onAction={onAction} />
          ) : (
            <CleanSummary result={result} onSelectYellow={() => setSel(cards[0]?.key ?? null)} />
          )}
        </div>
      </div>
    </div>
  );
}

function CardDetail({ card, docs, memo, onMemo, onAction }: { card: Card; docs: Docs; memo?: string; onMemo: Props['onMemo']; onAction: Props['onAction'] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memo ?? '');
  useEffect(() => {
    setEditing(false);
    setDraft(memo ?? '');
  }, [card.key, memo]);
  const v = SEVERITY[card.severity];
  const locs = card.locations.slice(0, card.compare ? 1 : 3);

  return (
    <article className="px-7 py-5">
      <div className="flex items-center gap-2">
        <SeverityBadge s={card.severity} />
        <StrengthTag s={card.strength} />
        <Tag>규칙 {card.rule}</Tag>
      </div>
      <h2 className="mt-3 text-h2 font-semibold text-ink">{card.title}</h2>

      <div className="mt-4 space-y-4">
        {card.compare ? (
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-meta text-ink-3">내 문서 원문 · 두 문서의 해당 칸을 나란히</span>
              <span className="text-[12px] text-ink-4">다른 값만 표시</span>
            </div>
            <Compare card={card} docs={docs} />
          </div>
        ) : (
          <Quote label="내 문서 원문">
            <div className="space-y-2">
              {locs.map((r, i) => (
                <div key={i}>
                  <div className="text-[12px] text-ink-3">{refLabel(docs, r)}</div>
                  <div>
                    <Highlight text={cellAt(docs, r)} marks={card.highlights ?? (card.rule === 'J4' ? [card.key.split(':')[1]] : undefined)} />
                  </div>
                </div>
              ))}
              {!locs.length && card.quote}
              {card.locations.length > locs.length && <div className="text-[12px] text-ink-3">외 {card.locations.length - locs.length}칸</div>}
            </div>
          </Quote>
        )}

        <Quote
          tone="accent"
          label={
            <>
              근거 · {card.basis.source}
              {card.basis.page && <span className="ml-1 text-ink-2">· {card.basis.page}</span>}
            </>
          }
        >
          {card.basis.text}
        </Quote>

        {card.note && (
          <p className={`flex items-center gap-2 rounded-lg ${v.bg} px-4 py-2.5 text-[14px] ${v.ink}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />
            {card.note}
          </p>
        )}
      </div>

      {editing ? (
        <div className="mt-5 space-y-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="예: 학교 규정에 분량 기준이 있어 유지함"
            className="h-20 w-full resize-none rounded-lg border border-line px-3 py-2 text-[14px] focus:border-accent focus:outline-none"
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                onMemo(card.key, draft.trim() || '메모 없이 넘김');
                setEditing(false);
              }}
            >
              저장하고 넘기기
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
          {card.actions.map((a, i) => (
            <Button
              key={a}
              variant={i === 0 ? 'primary' : 'secondary'}
              onClick={() => (a === 'memo' ? setEditing(true) : onAction(a, card))}
            >
              {ACTION_LABEL[a]}
            </Button>
          ))}
          {memo && <span className="ml-2 truncate text-meta text-ink-3">메모: {memo}</span>}
        </div>
      )}
    </article>
  );
}

function Compare({ card, docs }: { card: Card; docs: Docs }) {
  const planRef = card.locations.find((r) => r.doc === 'plan');
  const rubricRef = card.locations.find((r) => r.doc === 'rubric');
  const head = (r: CellRef | undefined, name: string) => (
    <th className="w-[34%] border-b border-line px-4 py-2 text-left font-semibold text-ink-2">
      {name}
      <span className="ml-2 text-[12px] font-normal text-ink-4">{r ? `${docs[r.doc].fileName} · 표${r.table + 1}` : ''}</span>
    </th>
  );
  return (
    <table className="w-full overflow-hidden rounded-lg border border-line text-[14px]">
      <thead className="bg-canvas">
        <tr>
          <th className="border-b border-line px-4 py-2 text-left font-semibold text-ink-2">항목</th>
          {head(planRef, '평가계획서')}
          {head(rubricRef, '채점기준표')}
        </tr>
      </thead>
      <tbody>
        {card.compare!.map((row) => {
          const cls = row.differs ? 'bg-sev-red-bg font-semibold text-sev-red-ink' : 'text-ink-2';
          return (
            <tr key={row.label} className="border-b border-line-2 last:border-0">
              <td className={`px-4 py-1.5 ${row.differs ? 'font-semibold text-ink' : 'text-ink-3'}`}>{row.label}</td>
              <td className={`px-4 py-1.5 ${row.plan !== undefined ? cls : 'text-ink-4'}`}>{row.plan ?? '없음'}</td>
              <td className={`px-4 py-1.5 ${row.rubric !== undefined ? cls : 'text-ink-4'}`}>{row.rubric ?? '없음'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CleanSummary({ result, onSelectYellow }: { result: CheckResult; onSelectYellow: () => void }) {
  const yellow = result.cards.filter((c) => c.severity === 'yellow');
  return (
    <div className="flex h-full flex-col justify-center px-12 py-10">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-50 text-accent">{Icon.check('h-7 w-7')}</div>
      <h2 className="mt-5 text-[24px] font-bold leading-8 text-ink">확인된 오류가 없어요</h2>
      <p className="mt-2 max-w-[560px] text-body text-ink-3">
        평가계획과 채점기준표의 만점·배점이 맞고, 모든 성취기준 코드가 2022 개정 중학교 정보 DB에 있으며, 채점기준에 지침이 지양하는 표현이 없어요.
      </p>
      <ul className="mt-6 grid max-w-[640px] grid-cols-2 gap-3">
        {result.passed.map((p) => (
          <li key={p.rule} className="rounded-lg border border-line px-4 py-3">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <span className="text-accent">{Icon.check()}</span>
              {p.label}
            </div>
            <div className="mt-0.5 pl-6 text-meta text-ink-3">{p.detail}</div>
          </li>
        ))}
      </ul>
      {yellow.length > 0 && (
        <button type="button" onClick={onSelectYellow} className="mt-6 flex max-w-[640px] items-center gap-3 rounded-lg bg-sev-yellow-bg px-4 py-3 text-left">
          <SeverityBadge s="yellow" size="sm" />
          <span className="text-[14px] text-sev-yellow-ink">{yellow[0].title}</span>
          <span className="ml-auto text-sev-yellow-ink">{Icon.arrow()}</span>
        </button>
      )}
    </div>
  );
}
