import { buildAlignment, type AlignmentRow, type LinkVia } from '../domain/rules';
import type { CheckInput } from '../domain/types';
import { Page, PageHead } from '../ui/layout';
import { Button, Card, Dot, Icon } from '../ui/primitives';

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
    <Page>
      <PageHead
        title={title}
        right={<Button onClick={onResults}>결과로 돌아가기</Button>}
      />

      <div className="flex shrink-0 items-center gap-6 pb-4 text-body text-ink-2">
        {used.has('plan') && (
          <span className="flex items-center gap-2">
            <Mark via="plan" /> 평가계획서에 적힌 연결
          </span>
        )}
        {used.has('rubric') && (
          <span className="flex items-center gap-2">
            <Mark via="rubric" /> 채점기준표에만 적힌 연결
          </span>
        )}
        <span className="flex items-center gap-2">
          <Mark via="manual" /> 선생님이 지정한 연결
        </span>
        <span className="flex items-center gap-2">
          <Dot s="gray" /> 연결을 찾지 못한 성취기준
        </span>
        {!missing.length && lastLinked && (
          <span className="ml-auto flex items-center gap-2 font-bold text-brand-green">
            {Icon.check()}
            {lastLinked.code}를 ‘{lastLinked.name}’에 연결했어요
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 pb-6">
        <Card className="max-h-full overflow-auto">
          <table className="w-full border-collapse text-body">
            <thead className="sticky top-0 z-10 bg-paper">
              <tr>
                <th className="border-b border-line py-2 pl-6 pr-4 text-left text-help font-bold text-ink-3">성취기준</th>
                {input.plan.map((a) => (
                  <th key={a.id} className="w-[168px] border-b border-l border-line-2 border-b-line px-4 py-2 text-center align-bottom">
                    <div className="text-body font-bold text-ink">{a.name}</div>
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
        </Card>
      </div>
    </Page>
  );
}

function Row({ row, input, onToggle }: { row: AlignmentRow; input: CheckInput; onToggle: Props['onToggle'] }) {
  return (
    <tr className="border-b border-line-2 last:border-0">
      <td className={`border-l-4 py-2 pl-4 pr-4 ${row.linked ? 'border-l-transparent' : 'border-l-sev-gray'}`}>
        <div className="flex items-center gap-4">
          <span className={`w-[104px] shrink-0 font-bold ${row.inDb ? 'text-ink' : 'text-sev-red'}`}>{row.code}</span>
          <span className="line-clamp-1 flex-1 text-ink-2" title={row.text}>
            {row.text}
          </span>
          {!row.linked && (
            <label className="relative flex shrink-0 items-center">
              <span className="sr-only">{row.code}를 연결할 평가</span>
              <select
                value=""
                onChange={(e) => e.target.value && onToggle(row.code, e.target.value)}
                className="h-10 cursor-pointer appearance-none rounded-lg bg-brand-navy pl-4 pr-8 text-body font-bold text-white hover:bg-brand-navy-2 focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                <option value="">평가 연결하기</option>
                {input.plan.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 text-white">{Icon.chevron()}</span>
            </label>
          )}
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
              aria-label={`${row.code} – ${a.name}`}
              aria-pressed={c.via === 'manual'}
              className={`group flex h-16 w-full items-center justify-center transition-colors duration-150 ${clickable ? 'hover:bg-brand-blue-50' : 'cursor-default'}`}
            >
              {c.via ? <Mark via={c.via} /> : <span className="text-help font-bold text-brand-blue opacity-0 group-hover:opacity-100">+ 연결</span>}
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
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-white" title="선생님이 지정">
        {Icon.check('h-4 w-4')}
      </span>
    );
  if (via === 'rubric') return <span className="h-3.5 w-3.5 rounded-full border-2 border-brand-navy bg-paper" title="채점기준표에만" />;
  return <span className="h-3.5 w-3.5 rounded-full bg-brand-navy" title="평가계획서" />;
}
