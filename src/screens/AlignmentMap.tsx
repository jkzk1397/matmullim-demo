import { buildAlignment, type AlignmentRow } from '../domain/rules';
import type { CheckInput } from '../domain/types';
import { PageHead } from '../ui/layout';
import { Button, Icon, SeverityBadge } from '../ui/primitives';

type Props = {
  input: CheckInput;
  onToggle: (code: string, assessmentId: string) => void;
  onResults: () => void;
  lastLinked?: { code: string; name: string } | null;
};

export default function AlignmentMap({ input, onToggle, onResults, lastLinked }: Props) {
  const rows = buildAlignment(input);
  const missing = rows.filter((r) => !r.linked);
  const title = missing.length
    ? `성취기준 ${rows.length}개 중 ${missing.length}개가 어떤 평가와도 연결되지 않았어요`
    : `성취기준 ${rows.length}개가 모두 평가와 연결되어 있어요`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHead
        title={title}
        sub="행은 평가계획의 학기 성취기준, 열은 평가예요. 빈 칸을 누르면 교사가 연결을 지정할 수 있어요."
        right={<Button onClick={onResults}>결과로 돌아가기</Button>}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-6 px-8 pb-8">
        <div className="flex min-h-0 flex-col gap-3">
        <div className="scroll-thin min-h-0 overflow-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-[14px]">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <th className="border-b border-line px-5 py-3 text-left font-semibold text-ink-2">성취기준</th>
                {input.plan.map((a) => (
                  <th key={a.id} className="w-[150px] border-b border-l border-line px-3 py-3 text-center align-bottom">
                    <div className="font-semibold leading-5 text-ink">{a.name}</div>
                    <div className="mt-0.5 text-[12px] font-normal text-ink-3">
                      {a.method}
                      {a.weightPercent !== undefined && ` · ${a.weightPercent}%`}
                    </div>
                  </th>
                ))}
                <th className="w-[132px] border-b border-l border-line px-3 py-3 text-center font-semibold text-ink-2">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Row key={r.code} row={r} input={input} onToggle={onToggle} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-1 text-meta text-ink-3">
          연결은 평가계획서 표3과 채점기준표의 성취기준 코드 칸에서 읽었어요. 성취기준 문장은 2022 개정 교육과정 고시 원문(DECK6 정형 데이터)이에요.
        </p>
        </div>

        <aside className="flex min-h-0 flex-col gap-4">
          <div className="rounded-xl border border-line px-5 py-4">
            <div className="mb-3 text-[14px] font-semibold">읽는 법</div>
            <ul className="space-y-2.5 text-[14px] text-ink-2">
              <li className="flex items-center gap-3">
                <Dot via="plan" /> 평가계획서에 적힌 연결
              </li>
              <li className="flex items-center gap-3">
                <Dot via="rubric" /> 채점기준표에만 적힌 연결
              </li>
              <li className="flex items-center gap-3">
                <Dot via="manual" /> 교사가 지정한 연결
              </li>
              <li className="flex items-center gap-3">
                <span className="stripes h-5 w-8 rounded border border-line" /> 연결을 찾지 못한 성취기준
              </li>
            </ul>
          </div>
          <div className="rounded-xl bg-canvas px-5 py-4 text-[14px] leading-6 text-ink-2">
            맞물림은 연결의 <b className="text-ink">교육적 타당성을 자동으로 판정하지 않아요.</b> 문서에서 연결을 찾지 못한 곳만 보여 주고, 실제로 어떤 평가에서 다루는지는
            선생님이 정해요.
          </div>
          <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto">
            {missing.map((r) => (
              <div key={r.code} className="rounded-lg border border-l-4 border-line border-l-sev-gray bg-white px-4 py-3">
                <SeverityBadge s="gray" size="sm" />
                <div className="mt-1.5 text-[14px] font-semibold">{r.code}가 어떤 평가와도 연결되지 않았어요</div>
                <div className="mt-0.5 text-meta text-ink-3">해당하는 평가 칸을 눌러 연결을 지정하세요</div>
              </div>
            ))}
            {!missing.length && lastLinked && (
              <div className="rounded-lg border border-accent-100 bg-accent-50/60 px-4 py-3 text-[14px] text-ink-2">
                <div className="flex items-center gap-2 font-semibold text-accent">{Icon.check()} 연결 확인 카드가 사라졌어요</div>
                <div className="mt-1">
                  {lastLinked.code} → {lastLinked.name} 연결을 지정했어요.
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ row, input, onToggle }: { row: AlignmentRow; input: CheckInput; onToggle: Props['onToggle'] }) {
  return (
    <tr className={`border-b border-line-2 ${row.linked ? '' : 'stripes'}`}>
      <td className="h-16 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className={`shrink-0 font-semibold ${row.inDb ? 'text-ink' : 'text-sev-red-ink'}`}>{row.code}</span>
          <span className="line-clamp-1 text-ink-2" title={row.text}>
            {row.text}
          </span>
        </div>
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
              title={c.via ? undefined : `${row.code}를 ‘${a.name}’에 연결`}
              aria-label={`${row.code} – ${a.name}`}
              className={`group flex h-16 w-full items-center justify-center ${clickable ? 'hover:bg-accent-50' : 'cursor-default'}`}
            >
              {c.via ? <Dot via={c.via} /> : <span className="h-3 w-3 rounded-full border border-dashed border-ink-4 opacity-0 group-hover:opacity-100" />}
            </button>
          </td>
        );
      })}
      <td className="border-l border-line-2 px-3 text-center">
        {row.linked ? (
          <span className="text-meta text-ink-3">연결됨</span>
        ) : (
          <span className="rounded-md bg-white px-2 py-1 text-[12px] font-semibold text-sev-gray-ink ring-1 ring-sev-gray/40">연결 확인 필요</span>
        )}
      </td>
    </tr>
  );
}

function Dot({ via }: { via: 'plan' | 'rubric' | 'manual' }) {
  if (via === 'manual')
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-100 text-accent" title="교사 지정">
        {Icon.check('h-4 w-4')}
      </span>
    );
  if (via === 'rubric') return <span className="h-3.5 w-3.5 rounded-full border-2 border-accent bg-white" title="채점기준표" />;
  return <span className="h-3.5 w-3.5 rounded-full bg-accent" title="평가계획서" />;
}
