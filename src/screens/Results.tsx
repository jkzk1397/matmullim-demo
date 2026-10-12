import { useEffect, useState } from 'react';
import { countBySeverity, diffRuns, runChecks } from '../domain/rules';
import type { Action, Card, CheckResult, PassedCheck, Severity } from '../domain/types';
import { SEVERITY, sameRef, type Run } from '../ui/helpers';
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
const ACTION_LABEL: Record<Action, string> = { fix: '고치고 다시 올리기', memo: '메모하고 넘기기', link: '연결 지정' };

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
        <span className="ml-auto flex items-center gap-2 text-body text-ink-2">
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
                <span className="text-body font-bold text-ink-2">{n[s]}</span>
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

      <div className="mt-4 flex items-baseline gap-4 rounded-xl bg-brand-blue-50 px-6 py-4">
        <b className="shrink-0 text-body font-bold text-brand-navy">고치는 법</b>
        <p className="text-body font-bold text-ink">
          {firstSentence(card.fix ?? '판정이 아닌 질문이에요. 수업에서 다루고 있다면 메모하고 넘기세요.')}
          {card.note && <span className="ml-2 font-medium text-ink-2">{card.note}</span>}
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
        <div className="mt-4 flex items-center gap-2">
          {card.rule !== 'S5' && card.rule !== 'J6' && (
            <Button variant="quiet" className="text-body" onClick={() => onReviewValue(card)}>
              원문 값 다시 보기
            </Button>
          )}
          <span className="ml-auto" />
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

/** 정상판: 왼쪽 큰 초록 체크 + 통과 목록, 오른쪽 점검한 문서·맞물린 값·제안 */
function CleanResult({ head, run, result, memos, onMemo }: { head: React.ReactNode; run: Run; result: CheckResult; memos: Record<string, string>; onMemo: Props['onMemo'] }) {
  const suggestions = result.cards.filter((c) => c.severity === 'yellow');
  const { plan, rubric, pairs, planStandards } = run.input;
  const matched = rubric.flatMap((r) => {
    const p = plan.find((x) => x.id === pairs[r.id]);
    return p ? [{ p, total: r.elements.reduce((n, e) => n + (e.points ?? 0), 0) }] : [];
  });
  const weight = plan.reduce((n, a) => n + (a.weightPercent ?? 0), 0);
  return (
    <Page>
      {head}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-6 pb-8">
        <Box className="flex flex-col px-8 py-8">
          <div className="flex items-center gap-6">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-green text-white">{Icon.check('h-11 w-11')}</span>
            <div>
              <div className="text-title font-extrabold text-ink">확인된 오류 0건</div>
              <p className="text-key font-bold text-brand-green">점검 {result.passed.length}가지 모두 통과</p>
            </div>
          </div>
          <ul className="mt-8 flex flex-1 flex-col justify-between divide-y divide-line-2 border-t border-line-2">
            {result.passed.map((p: PassedCheck) => (
              <li key={p.rule} className="flex flex-1 items-center gap-4">
                <span className="text-brand-green">{Icon.check('h-6 w-6')}</span>
                <span className="w-44 shrink-0 text-body font-bold text-ink">{p.label}</span>
                <span className="text-body text-ink-2">{p.detail}</span>
              </li>
            ))}
          </ul>
        </Box>

        <div className="flex min-h-0 flex-col gap-6">
          <Box className="px-6 py-6">
            <h2 className="text-key font-bold text-ink">점검한 문서</h2>
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              {[
                ['평가', `${plan.length}개`],
                ['성취기준', `${planStandards.length}개`],
                ['반영비율 합계', `${weight}%`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-canvas py-4">
                  <div className="text-title font-extrabold text-brand-navy">{v}</div>
                  <div className="text-body text-ink-2">{k}</div>
                </div>
              ))}
            </div>
          </Box>
          <Box className="flex-1 px-6 py-6">
            <h2 className="text-key font-bold text-ink">만점과 배점 합계</h2>
            <ul className="mt-2 divide-y divide-line-2">
              {matched.map(({ p, total }) => (
                <li key={p.id} className="flex items-center gap-4 py-4 text-body">
                  <span className="flex-1 font-bold text-ink">{p.name}</span>
                  <span className="text-ink-2">
                    {p.maxScore}점 = {total}점
                  </span>
                  <span className="text-brand-green">{Icon.check('h-5 w-5')}</span>
                </li>
              ))}
            </ul>
          </Box>
          {suggestions.map((c) => (
            <Box key={c.key} className="flex items-center gap-4 px-6 py-4">
              <Dot s="yellow" />
              <span className="flex-1 text-body font-bold text-ink">{c.title}</span>
              {memos[c.key] ? (
                <span className="text-body text-brand-blue">메모함</span>
              ) : (
                <Button onClick={() => onMemo(c.key, '수업에서 다룸')}>수업에서 다뤄요</Button>
              )}
            </Box>
          ))}
        </div>
      </div>
    </Page>
  );
}
