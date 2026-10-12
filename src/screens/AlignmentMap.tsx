import { buildAlignment, type AlignmentRow, type LinkVia } from '../domain/rules';
import type { CheckInput } from '../domain/types';
import { PageHead, Paper } from '../ui/layout';
import { Button, Icon, SeverityLabel } from '../ui/primitives';

type Props = {
  input: CheckInput;
  onToggle: (code: string, assessmentId: string) => void;
  onResults: () => void;
  lastLinked?: { code: string; name: string } | null;
};

export default function AlignmentMap({ input, onToggle, onResults, lastLinked }: Props) {
  const rows = buildAlignment(input);
  const missing = rows.filter((r) => !r.linked);
  const used = new Set(rows.flatMap((r) => r.cells.map((c) => c.via)));
  const title = missing.length
    ? `성취기준 ${rows.length}개 중 ${missing.length}개가 어떤 평가와도 연결되지 않았어요`
    : `성취기준 ${rows.length}개가 모두 평가와 연결되어 있어요`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHead
        title={title}
        sub="행은 평가계획의 학기 성취기준, 열은 평가예요. 빈 칸을 누르면 선생님이 직접 연결을 지정할 수 있어요."
        right={<Button onClick={onResults}>결과로 돌아가기</Button>}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] items-start gap-6 px-8 pb-8">
        <Paper className="max-h-full overflow-auto">
          <table className="w-full border-collapse text-[15px]">
            <thead className="sticky top-0 z-10 bg-paper">
              <tr>
                <th className="border-b border-line px-5 py-3 text-left text-meta font-semibold text-ink-3">성취기준</th>
                {input.plan.map((a) => (
                  <th key={a.id} className="w-[148px] border-b border-l border-line-2 border-b-line px-3 py-3 text-center align-bottom">
                    <div className="text-[14px] font-semibold leading-5 text-ink">{a.name}</div>
                    <div className="mt-0.5 text-meta font-normal text-ink-3">
                      {a.method}
                      {a.weightPercent !== undefined && ` · ${a.weightPercent}%`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Row key={r.code} row={r} input={input} onToggle={onToggle} />
              ))}
            </tbody>
          </table>
          <p className="border-t border-line-2 px-5 py-3 text-meta text-ink-3">
            연결은 평가 요소 표와 채점기준표의 성취기준 코드 칸에서 읽었어요. 문장은 2022 개정 교육과정 고시 원문이에요.
          </p>
        </Paper>

        <aside className="flex flex-col gap-4">
          <Paper className="px-5 py-4">
            <h2 className="mb-3 text-[15px] font-bold text-ink">읽는 법</h2>
            <ul className="space-y-2.5 text-[14px] text-ink-2">
              {used.has('plan') && (
                <li className="flex items-center gap-3">
                  <Mark via="plan" /> 평가계획서에 적힌 연결
                </li>
              )}
              {used.has('rubric') && (
                <li className="flex items-center gap-3">
                  <Mark via="rubric" /> 채점기준표에만 적힌 연결
                </li>
              )}
              <li className="flex items-center gap-3">
                <Mark via="manual" /> 선생님이 지정한 연결
              </li>
              <li className="flex items-center gap-3">
                <span className="stripes h-5 w-6 rounded" /> 연결을 찾지 못한 성취기준
              </li>
            </ul>
          </Paper>
          <p className="px-1 text-[14px] leading-6 text-ink-2">
            연결이 교육적으로 타당한지는 <b className="font-semibold text-ink">자동으로 판정하지 않아요.</b> 문서에서 연결을 찾지 못한 곳만 보여 주고, 실제로
            어느 평가에서 다루는지는 선생님이 정해요.
          </p>
          {missing.map((r) => (
            <Paper key={r.code} className="px-5 py-4">
              <SeverityLabel s="gray" />
              <div className="mt-1.5 text-[15px] font-semibold text-ink">{r.code}가 어떤 평가와도 연결되지 않았어요</div>
              <div className="mt-0.5 text-meta text-ink-3">이 성취기준을 다루는 평가 칸을 눌러 주세요</div>
            </Paper>
          ))}
          {!missing.length && lastLinked && (
            <div className="rounded-xl bg-pen-50 px-5 py-4 text-[14px] text-pen">
              <div className="flex items-center gap-2 font-semibold">{Icon.check()} 연결 확인 카드가 사라졌어요</div>
              <div className="mt-1">
                {lastLinked.code}를 ‘{lastLinked.name}’에 연결했어요.
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ row, input, onToggle }: { row: AlignmentRow; input: CheckInput; onToggle: Props['onToggle'] }) {
  return (
    <tr className={`border-b border-line-2 last:border-0 ${row.linked ? '' : 'stripes'}`}>
      <td className="px-5 py-2.5">
        <div className="flex items-start gap-3">
          <span className={`w-[92px] shrink-0 font-semibold ${row.inDb ? 'text-ink' : 'text-sev-red-ink'}`}>{row.code}</span>
          <span className="line-clamp-2 text-[14px] leading-[22px] text-ink-2">{row.text}</span>
        </div>
        {!row.linked && (
          <div className="mt-1 pl-[104px]">
            <span className="rounded bg-paper px-1.5 py-0.5 text-meta font-semibold text-sev-gray-ink">연결 확인 필요</span>
          </div>
        )}
      </td>
      {row.cells.map((c) => {
        const a = input.plan.find((x) => x.id === c.assessmentId)!;
        const clickable = c.via === null || c.via === 'manual';
        return (
          <td key={c.assessmentId} className="border-l border-line-2 p-0 text-center">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onToggle(row.code, c.assessmentId)}
              aria-label={`${row.code} – ${a.name}`}
              aria-pressed={c.via === 'manual'}
              className={`group flex min-h-[60px] w-full items-center justify-center transition-colors duration-150 ${clickable ? 'hover:bg-pen-50' : 'cursor-default'}`}
            >
              {c.via ? <Mark via={c.via} /> : <span className="flex h-6 w-6 items-center justify-center rounded-full text-pen opacity-0 ring-1 ring-pen/50 group-hover:opacity-100">+</span>}
            </button>
          </td>
        );
      })}
    </tr>
  );
}

function Mark({ via }: { via: Exclude<LinkVia, null> }) {
  if (via === 'manual')
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pen text-white" title="선생님이 지정">
        {Icon.check('h-4 w-4')}
      </span>
    );
  if (via === 'rubric') return <span className="h-4 w-4 rounded-full border-2 border-graphite bg-paper" title="채점기준표에만" />;
  return <span className="h-4 w-4 rounded-full bg-graphite" title="평가계획서" />;
}
