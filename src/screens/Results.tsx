import { useEffect, useState } from 'react';
import { countBySeverity, diffRuns, runChecks } from '../domain/rules';
import type { Action, Card, CheckResult, PassedCheck, Severity } from '../domain/types';
import { SEVERITY, refPath, sameRef, type Run } from '../ui/helpers';
import { Page, PageHead } from '../ui/layout';
import { Button, Card as Box, Dot, Icon, SeverityLabel, StrengthBadge } from '../ui/primitives';
import { Sheet, buildSheets } from '../ui/sheets';

type Props = {
  run: Run;
  prevRun?: Run;
  result: CheckResult;
  memos: Record<string, string>;
  onMemo: (key: string, text: string | null) => void;
  onAction: (a: Action, card: Card) => void;
  onReviewValue: (card: Card) => void;
  onRecheck: () => void;
  onCompare: () => void;
  onMap: () => void;
};

const ORDER: Severity[] = ['red', 'orange', 'gray', 'yellow'];
const ACTION_LABEL: Record<Action, string> = { fix: '고치기 · 고친 문서 올리기', memo: '메모하고 넘기기', link: '연결 지정' };

export function headline(cards: Card[]): string {
  const n = countBySeverity(cards);
  const cross = cards.filter((c) => c.key.startsWith('J12-max:')).length;
  if (n.red) return cross ? `확인된 오류 ${n.red}건 · 그중 ${cross}건은 두 문서가 서로 맞지 않아요` : `확인된 오류 ${n.red}건을 찾았어요`;
  if (n.orange) return `확인된 오류는 없고, 지침 권고와 다른 곳이 ${n.orange}건 있어요`;
  if (n.gray) return `확인된 오류는 없어요 · 확인이 필요한 연결 ${n.gray}건이 남았어요`;
  return '두 문서가 서로 맞물려요';
}

export default function Results({ run, prevRun, result, memos, onMemo, onAction, onReviewValue, onRecheck, onCompare, onMap }: Props) {
  const { cards, passed } = result;
  const n = countBySeverity(cards);
  const clean = n.red + n.orange + n.gray === 0;
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const [sel, setSel] = useState<string | null>(cards[0]?.key ?? null);
  useEffect(() => {
    if (sel && !cards.some((c) => c.key === sel)) setSel(cards[0]?.key ?? null);
  }, [cards, sel]);
  const selected = cards.find((c) => c.key === sel);
  const diff = prevRun ? diffRuns(runChecks(prevRun.input).cards, cards) : null;
  const groups = ORDER.filter((s) => (filter === 'all' || filter === s) && cards.some((c) => c.severity === s));

  const head = (
    <PageHead
      title={headline(cards)}
      sub={`${run.label} · 평가계획서와 채점기준표, 교육청 지침을 서로 대조했어요`}
      right={
        <>
          {diff && (
            <Button variant="quiet" onClick={onCompare}>
              지난 점검과 비교 {Icon.arrow()}
            </Button>
          )}
          <Button onClick={onMap}>정렬 맵</Button>
          <Button onClick={onRecheck}>{clean ? '다른 문서 올리기' : '고친 문서 다시 올리기'}</Button>
        </>
      }
    />
  );

  if (clean) return <CleanResult head={head} run={run} result={result} memos={memos} onMemo={onMemo} />;

  return (
    <Page>
      {head}

      {/* 숫자 줄: 확인된 오류만 크게 */}
      <Box className="flex shrink-0 items-center gap-8 px-6 py-2">
        <button type="button" onClick={() => setFilter(filter === 'red' ? 'all' : 'red')} className="flex items-baseline gap-4" aria-pressed={filter === 'red'}>
          <span className="flex items-center gap-2 text-body font-bold text-sev-red">
            <Dot s="red" />
            확인된 오류
          </span>
          <span className="text-title font-extrabold text-sev-red">
            {n.red}
            <span className="ml-0.5 text-body font-bold">건</span>
          </span>
        </button>
        <span className="h-8 w-px bg-line" aria-hidden />
        {(['orange', 'gray', 'yellow'] as Severity[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(filter === s ? 'all' : s)}
            aria-pressed={filter === s}
            className={`flex items-center gap-2 text-body ${filter === s ? 'font-bold text-ink' : 'text-ink-2 hover:text-ink'}`}
          >
            <Dot s={s} />
            {SEVERITY[s].label}
            <b className="font-bold text-ink">{n[s]}</b>
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2 text-help text-ink-3">
          <span className="text-brand-green">{Icon.check()}</span>
          통과한 점검 {passed.length}
        </span>
      </Box>

      <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] gap-6 pb-4 pt-4">
        <nav className="min-h-0 space-y-4 overflow-y-auto" aria-label="지적 목록">
          {groups.map((s) => (
            <div key={s}>
              <div className="mb-1 flex items-center justify-between px-4">
                <SeverityLabel s={s} />
                <span className="text-help font-bold text-ink-3">{n[s]}</span>
              </div>
              <ul>
                {cards
                  .filter((c) => c.severity === s)
                  .map((c) => {
                    const active = sel === c.key;
                    return (
                      <li key={c.key}>
                        <button
                          type="button"
                          onClick={() => setSel(c.key)}
                          aria-current={active}
                          className={`flex w-full items-center gap-2 rounded-lg border-l-4 px-4 py-2 text-left transition-colors duration-150 ${
                            active ? `bg-paper shadow-card ${SEVERITY[s].border}` : 'border-l-transparent hover:bg-paper/70'
                          }`}
                        >
                          <span className={`min-w-0 flex-1 truncate text-body ${active ? 'font-bold text-ink' : 'text-ink-2'}`}>{c.title}</span>
                          {memos[c.key] && <span className="shrink-0 text-brand-blue">{Icon.pen()}</span>}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="min-h-0 overflow-y-auto">
          {selected && (
            <CardDetail key={selected.key} card={selected} run={run} memo={memos[selected.key]} onMemo={onMemo} onAction={onAction} onReviewValue={onReviewValue} />
          )}
        </div>
      </div>
    </Page>
  );
}

function CardDetail({
  card,
  run,
  memo,
  onMemo,
  onAction,
  onReviewValue,
}: {
  card: Card;
  run: Run;
  memo?: string;
  onMemo: Props['onMemo'];
  onAction: Props['onAction'];
  onReviewValue: Props['onReviewValue'];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memo ?? '');
  const sheets = buildSheets(card, run.docs, run.input);
  const edited = card.locations.some((l) => run.editedRefs.some((e) => sameRef(e, l)));

  return (
    <article>
      <div className="flex items-center gap-4">
        <SeverityLabel s={card.severity} />
        <StrengthBadge s={card.strength} />
        {edited && (
          <span className="ml-auto flex items-center gap-2 text-help font-bold text-brand-blue">
            {Icon.pen()}교사가 고친 값으로 점검
          </span>
        )}
      </div>
      <h2 className="mt-2 text-key font-bold tracking-[-0.02em] text-ink">{card.title}</h2>
      {card.locations[0] && <p className="mt-0.5 truncate text-help text-ink-3">{refPath(run.docs, card.locations[0])}</p>}

      <div className="mt-2 flex items-stretch gap-2">
        <Sheet model={sheets.left} s={card.severity} />
        {sheets.right && (
          <>
            <div className="flex w-8 shrink-0 items-center justify-center">
              <span className={`text-key font-extrabold ${SEVERITY[card.severity].text}`} aria-hidden>
                {sheets.joint}
              </span>
            </div>
            <Sheet model={sheets.right} s={card.severity} />
          </>
        )}
      </div>

      <div className="mt-4">
        <p className="text-body text-ink">
          <b className="mr-2 font-bold">고치는 법</b>
          {firstSentence(card.fix ?? '판정이 아닌 질문이에요. 수업에서 다루고 있다면 메모하고 넘기세요.')}
        </p>
      </div>

      {memo && !editing && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-brand-blue-50 px-4 py-2 text-body text-brand-blue">
          {Icon.pen()}
          <span className="flex-1 truncate">교사 메모 · {memo}</span>
          <button type="button" className="text-help underline underline-offset-4" onClick={() => onMemo(card.key, null)}>
            지우기
          </button>
        </div>
      )}

      {editing ? (
        <div className="mt-4 flex items-start gap-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="넘기는 이유를 남겨 두세요"
            className="h-12 flex-1 resize-none rounded-lg bg-paper px-4 py-2 text-body shadow-[inset_0_0_0_1px_#e3e7ed] focus:outline-none focus:ring-2 focus:ring-brand-blue"
          />
          <Button
            variant="primary"
            onClick={() => {
              onMemo(card.key, draft.trim() || '이유 없이 넘김');
              setEditing(false);
            }}
          >
            저장하고 넘기기
          </Button>
          <Button onClick={() => setEditing(false)}>취소</Button>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-help text-ink-3" title={`${card.basis.source} ${card.basis.page ?? ''} ${card.note ?? ''}`}>
            근거 · {card.basis.source}
            {card.basis.page ? ` · ${card.basis.page}` : ''}
            {card.note ? ` · ${card.note}` : ''}
          </p>
          {card.rule !== 'S5' && card.rule !== 'J6' && (
            <Button variant="quiet" onClick={() => onReviewValue(card)}>
              추출값이 틀렸나요?
            </Button>
          )}
          {[...card.actions].reverse().map((a) => (
            <Button key={a} variant={a === card.actions[0] ? 'primary' : 'secondary'} onClick={() => (a === 'memo' ? setEditing(true) : onAction(a, card))}>
              {ACTION_LABEL[a]}
            </Button>
          ))}
        </div>
      )}
    </article>
  );
}

/** 고치는 법은 첫 문장만 보여 준다 */
const firstSentence = (t: string) => t.split(/(?<=요\.)\s+/)[0];

/** 정상판: 가운데 큰 초록 체크 + 통과 목록. 제안과 맞물린 값은 접어 둔다 */
function CleanResult({ head, run, result, memos, onMemo }: { head: React.ReactNode; run: Run; result: CheckResult; memos: Record<string, string>; onMemo: Props['onMemo'] }) {
  const { plan, rubric, pairs } = run.input;
  const suggestions = result.cards.filter((c) => c.severity === 'yellow');
  const pairsShown = rubric.flatMap((r) => {
    const p = plan.find((x) => x.id === pairs[r.id]);
    return p ? [{ p, total: r.elements.reduce((n, e) => n + (e.points ?? 0), 0) }] : [];
  });
  return (
    <Page>
      {head}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto pb-8 pt-2">
        <Box className="h-fit w-full max-w-[760px] px-10 py-8">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-green text-white">{Icon.check('h-9 w-9')}</span>
            <div>
              <div className="text-title font-extrabold text-ink">확인된 오류 0건</div>
              <p className="text-body text-ink-2">아래 {result.passed.length}가지 점검을 모두 통과했어요.</p>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-line-2 border-y border-line-2">
            {result.passed.map((p: PassedCheck) => (
              <li key={p.rule} className="flex items-center gap-4 py-2">
                <span className="text-brand-green">{Icon.check('h-5 w-5')}</span>
                <span className="w-48 shrink-0 text-body font-bold text-ink">{p.label}</span>
                <span className="text-body text-ink-2">{p.detail}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1">
            {suggestions.length > 0 && (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-help font-bold text-ink-2">
                  <span className="transition-transform group-open:rotate-180">{Icon.chevron()}</span>
                  <Dot s="yellow" />
                  제안 {suggestions.length}건 보기
                </summary>
                {suggestions.map((c) => (
                  <div key={c.key} className="flex items-center gap-4 py-2 pl-6 text-body text-ink">
                    <span className="flex-1">{c.title}</span>
                    {memos[c.key] ? (
                      <span className="text-help text-brand-blue">메모함</span>
                    ) : (
                      <Button variant="quiet" onClick={() => onMemo(c.key, '수업에서 다룸')}>
                        수업에서 다뤄요
                      </Button>
                    )}
                  </div>
                ))}
              </details>
            )}
            {pairsShown.length > 0 && (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-help font-bold text-ink-2">
                  <span className="transition-transform group-open:rotate-180">{Icon.chevron()}</span>
                  서로 맞물린 값 보기
                </summary>
                <ul className="pl-6">
                  {pairsShown.map(({ p, total }) => (
                    <li key={p.id} className="flex gap-4 py-2 text-body">
                      <b className="w-48 font-bold text-ink">{p.name}</b>
                      <span className="text-ink-2">
                        만점 {p.maxScore ?? '—'}점 = 배점 합계 {total}점
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </Box>
      </div>
    </Page>
  );
}
