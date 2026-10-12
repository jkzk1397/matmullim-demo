import { useEffect, useMemo, useState } from 'react';
import { countBySeverity, diffRuns, runChecks } from '../domain/rules';
import type { Action, Card, CheckResult, PassedCheck, RuleId, Severity } from '../domain/types';
import { SEVERITY, formatDuration, refPath, sameRef, type Run } from '../ui/helpers';
import { PageHead } from '../ui/layout';
import { Button, Icon, NumChip, SeverityLabel, StrengthScale, Swatch } from '../ui/primitives';
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
const RULE_NAME: Record<RuleId, string> = { J12: '문서 간 일치', J4: '성취기준 코드', J7: '채점기준 표현', J6: '성취기준–평가 연결', S5: '제안 질문' };
const ACTION_LABEL: Record<Action, string> = { fix: '고치기 · 고친 문서 올리기', memo: '메모하고 넘기기', link: '연결 지정' };
type Filter = Severity | 'all' | 'passed';

export function headline(cards: Card[]): string {
  const n = countBySeverity(cards);
  const cross = cards.filter((c) => c.key.startsWith('J12-max:')).length;
  if (n.red) return cross ? `확인된 오류 ${n.red}건 · 그중 ${cross}건은 두 문서가 서로 맞지 않아요` : `확인된 오류 ${n.red}건을 찾았어요`;
  if (n.orange) return `확인된 오류는 없고, 지침 권고와 다른 곳이 ${n.orange}건 있어요`;
  if (n.gray) return `확인된 오류는 없어요 · 확인이 필요한 연결 ${n.gray}건이 남았어요`;
  return '확인된 오류 0건 · 두 문서가 서로 맞물려요';
}

export default function Results({ run, prevRun, result, memos, onMemo, onAction, onReviewValue, onRecheck, onCompare, onMap }: Props) {
  const { cards, passed } = result;
  const n = countBySeverity(cards);
  const clean = n.red + n.orange + n.gray === 0;
  const [filter, setFilter] = useState<Filter>(clean ? 'passed' : 'all');
  const [sel, setSel] = useState<string | null>(clean ? null : cards[0]?.key ?? null);
  const shown = useMemo(() => cards.filter((c) => filter === 'all' || filter === 'passed' || c.severity === filter), [cards, filter]);
  useEffect(() => {
    if (sel && !cards.some((c) => c.key === sel)) setSel(clean ? null : cards[0]?.key ?? null);
  }, [cards, sel, clean]);
  const selected = filter === 'passed' ? undefined : cards.find((c) => c.key === sel);
  const diff = prevRun ? diffRuns(runChecks(prevRun.input).cards, cards) : null;
  const num = (c: Card) => cards.indexOf(c) + 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHead
        title={headline(cards)}
        sub={`${run.label} · 선생님이 ${formatDuration(run.confirmMs)} 동안 확인한 값으로 점검했어요. 같은 표를 넣으면 언제나 같은 결과가 나와요.`}
        right={
          <>
            {diff && (
              <Button variant="quiet" onClick={onCompare}>
                이전 점검 대비 해결 {diff.resolved.length}건 보기
              </Button>
            )}
            <Button onClick={onMap}>정렬 맵</Button>
            <Button onClick={onRecheck}>{clean ? '다른 문서 올리기' : '고친 문서 다시 올리기'}</Button>
          </>
        }
      />

      {/* 종류별 개수 = 필터 */}
      <div className="mx-8 flex shrink-0 items-stretch rounded-xl bg-paper shadow-paper" role="tablist" aria-label="카드 종류">
        {ORDER.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={filter === s}
            onClick={() => {
              const next = filter === s ? 'all' : s;
              setFilter(next);
              const first = cards.find((c) => next === 'all' || c.severity === next);
              if (first) setSel(first.key);
            }}
            className={`flex flex-1 items-center justify-between gap-3 border-r border-line-2 px-5 py-2.5 text-left transition-colors duration-150 first:rounded-l-xl hover:bg-desk-2 ${
              filter === s ? 'bg-desk-2 shadow-[inset_0_-3px_0_#23262b]' : ''
            }`}
          >
            <span className="flex items-center gap-2.5 text-[14px] text-ink-2">
              <Swatch s={s} size="md" />
              {SEVERITY[s].label}
            </span>
            <span className={`text-stat font-bold ${n[s] ? SEVERITY[s].ink : 'text-ink-3'}`}>
              {n[s]}
              <span className="ml-0.5 text-[14px] font-medium text-ink-3">건</span>
            </span>
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'passed'}
          onClick={() => setFilter(filter === 'passed' ? 'all' : 'passed')}
          className={`flex w-[188px] items-center justify-between gap-3 rounded-r-xl px-5 py-2.5 text-left transition-colors duration-150 hover:bg-desk-2 ${
            filter === 'passed' ? 'bg-desk-2 shadow-[inset_0_-3px_0_#23262b]' : ''
          }`}
        >
          <span className="flex items-center gap-2 text-[14px] text-ink-2">
            <span className="text-ink">{Icon.check()}</span>통과한 점검
          </span>
          <span className="text-stat font-bold text-ink">{passed.length}</span>
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[400px_minmax(0,1fr)] gap-6 px-8 pb-6 pt-4">
        <ol className="min-h-0 space-y-1.5 overflow-y-auto pr-1" aria-label="지적 목록">
          {shown.map((c) => {
            const active = sel === c.key && filter !== 'passed';
            return (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => {
                    setSel(c.key);
                    if (filter === 'passed') setFilter('all');
                  }}
                  aria-current={active}
                  className={`flex w-full gap-3 rounded-xl px-4 py-2.5 text-left transition-[background-color,box-shadow] duration-150 ${
                    active ? 'bg-paper shadow-lift' : 'hover:bg-desk-2'
                  }`}
                >
                  <NumChip n={num(c)} s={c.severity} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <SeverityLabel s={c.severity} />
                      {memos[c.key] && (
                        <span className="flex items-center gap-1 text-meta font-semibold text-pen">
                          {Icon.pen('h-3.5 w-3.5')}메모함
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[15px] font-semibold leading-[22px] text-ink">{c.title}</span>
                    <span className="mt-0.5 block truncate text-meta text-ink-3">{c.locations[0] ? refPath(run.docs, c.locations[0]) : ''}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className={`min-h-0 overflow-y-auto ${selected ? '' : 'rounded-xl bg-paper shadow-paper'}`}>
          {selected ? (
            <CardDetail
              key={selected.key}
              card={selected}
              n={num(selected)}
              run={run}
              memo={memos[selected.key]}
              onMemo={onMemo}
              onAction={onAction}
              onReviewValue={onReviewValue}
            />
          ) : (
            <PassedPanel passed={passed} clean={clean} run={run} />
          )}
        </div>
      </div>
    </div>
  );
}

function CardDetail({
  card,
  n,
  run,
  memo,
  onMemo,
  onAction,
  onReviewValue,
}: {
  card: Card;
  n: number;
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
  const basisInSheet = card.rule === 'J7';

  return (
    <article className="px-1 pb-2 pt-1">
      <div className="flex items-center gap-3">
        <NumChip n={n} s={card.severity} />
        <SeverityLabel s={card.severity} />
        <span className="text-meta text-ink-3">· {RULE_NAME[card.rule]}</span>
        {edited && (
          <span className="ml-auto flex items-center gap-1.5 text-meta font-semibold text-pen">
            {Icon.pen('h-3.5 w-3.5')}교사가 고친 추출값으로 점검했어요
          </span>
        )}
      </div>
      <h2 className="mt-2 text-h2 font-bold tracking-[-0.02em] text-ink">{card.title}</h2>

      <div className="mt-4 flex items-stretch gap-3">
        <Sheet model={sheets.left} s={card.severity} />
        {sheets.right && (
          <>
            <div className="flex w-7 shrink-0 items-center justify-center">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-bold ${SEVERITY[card.severity].bg} ${SEVERITY[card.severity].ink}`} aria-hidden>
                {sheets.joint}
              </span>
            </div>
            <Sheet model={sheets.right} s={card.severity} />
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-6 px-1">
          <div className="min-w-0">
            <div className="text-meta text-ink-3">근거</div>
            <div className="mt-0.5 text-[14px] font-semibold text-ink-2">
              {card.basis.source}
              {card.basis.page && !basisInSheet && <span className="font-normal text-ink-3"> · {card.basis.page}</span>}
            </div>
            {!basisInSheet && card.basis.text && <p className="mt-0.5 text-body text-ink">{card.basis.text}</p>}
            {basisInSheet && <p className="mt-0.5 text-body text-ink-2">원문 문장은 오른쪽 종이에 옮겨 두었어요.</p>}
            {card.note && <p className={`mt-2 text-[14px] font-semibold ${SEVERITY[card.severity].ink}`}>{card.note}</p>}
          </div>
          <div className="min-w-0">
            <div className="text-meta text-ink-3">고치는 법</div>
            <p className="mt-0.5 text-body text-ink">{card.fix ?? '판정이 아닌 질문이에요. 수업에서 다루고 있다면 메모하고 넘기세요.'}</p>
          </div>
        <StrengthScale s={card.strength} />
      </div>

      {memo && !editing && (
        <div className="mx-1 mt-4 flex items-start gap-2 rounded-lg bg-pen-50 px-4 py-3 text-body text-pen">
          {Icon.pen('mt-1 h-4 w-4 shrink-0')}
          <span className="flex-1">
            <b className="font-semibold">교사 메모</b> · {memo}
          </span>
          <button type="button" className="text-meta underline underline-offset-4" onClick={() => onMemo(card.key, null)}>
            메모 지우기
          </button>
        </div>
      )}

      {editing ? (
        <div className="mt-4 space-y-2 px-1">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="넘기는 이유를 남겨 두세요. 예: 학교 규정에 분량 기준이 있어 유지함"
            className="h-20 w-full resize-none rounded-lg bg-paper px-3 py-2 text-body text-pen placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-pen"
          />
          <div className="flex gap-2">
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
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 px-1">
          {card.rule !== 'S5' && card.rule !== 'J6' && (
            <Button variant="quiet" onClick={() => onReviewValue(card)}>
              추출값이 틀렸나요? 원문 값 다시 확인
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

function PassedPanel({ passed, clean, run }: { passed: PassedCheck[]; clean: boolean; run: Run }) {
  const { plan, rubric, pairs } = run.input;
  const pairsShown = rubric.flatMap((r) => {
    const p = plan.find((x) => x.id === pairs[r.id]);
    return p ? [{ p, total: r.elements.reduce((n, e) => n + (e.points ?? 0), 0), pn: p.elements.length, rn: r.elements.length }] : [];
  });
  return (
    <div className="px-9 py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-desk-2 text-ink">{Icon.check('h-5 w-5')}</span>
        <h2 className="text-h2 font-bold text-ink">{clean ? '두 문서를 서로, 그리고 지침과 대조했어요. 확인된 오류가 없어요.' : `통과한 점검 ${passed.length}개`}</h2>
      </div>
      <ul className="mt-6 divide-y divide-line-2">
        {passed.map((p) => (
          <li key={p.rule} className="flex items-baseline gap-4 py-3.5">
            <span className="w-44 shrink-0 text-body font-semibold text-ink">{p.label}</span>
            <span className="text-body text-ink-2">{p.detail}</span>
            <span className="ml-auto flex items-center gap-1 text-meta font-semibold text-ink">{Icon.check('h-3.5 w-3.5')}통과</span>
          </li>
        ))}
      </ul>
      {pairsShown.length > 0 && (
        <div className="mt-7">
          <h3 className="mb-2 text-[15px] font-bold text-ink">서로 맞물린 값</h3>
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-meta text-ink-3">
                <th className="border-b border-line py-2 font-semibold">평가</th>
                <th className="border-b border-line py-2 font-semibold">평가계획서 만점</th>
                <th className="border-b border-line py-2 font-semibold">채점기준표 배점 합계</th>
                <th className="border-b border-line py-2 font-semibold">평가요소</th>
                <th className="border-b border-line py-2 font-semibold">반영비율 (비교하지 않음)</th>
              </tr>
            </thead>
            <tbody>
              {pairsShown.map(({ p, total, pn, rn }) => (
                <tr key={p.id} className="border-b border-line-2 last:border-0">
                  <td className="py-2.5 font-semibold text-ink">{p.name}</td>
                  <td className="py-2.5 text-ink">{p.maxScore ?? '—'}점</td>
                  <td className="py-2.5 text-ink">
                    {total}점 {total === p.maxScore && <span className="ml-1 text-meta font-semibold text-ink-2">일치</span>}
                  </td>
                  <td className="py-2.5 text-ink-2">
                    {pn}개 · {rn}개
                  </td>
                  <td className="py-2.5 text-ink-3">{p.weightPercent ?? '—'}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {clean && <p className="mt-6 text-body text-ink-3">왼쪽의 제안은 판정이 아닌 질문이에요. 수업에서 다루고 있다면 메모하고 넘기셔도 돼요.</p>}
    </div>
  );
}
