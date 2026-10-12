import { useRef, useState } from 'react';
import { extract, suggestPairs } from '../domain/extract';
import { countBySeverity, runChecks } from '../domain/rules';
import type { DocKind, ParsedDocument, Severity } from '../domain/types';
import type { SampleId } from '../fixtures';
import { SAMPLES } from '../fixtures';
import { SEVERITY, type Run } from '../ui/helpers';
import { Page, PageHead } from '../ui/layout';
import { Button, Card, Dot, Icon } from '../ui/primitives';

type Props = {
  plan?: ParsedDocument;
  rubric?: ParsedDocument;
  error?: string;
  loading?: string | null;
  lastRun?: Run;
  fixHint?: string | null;
  onFile: (kind: DocKind, file: File) => void;
  onSample: (id: SampleId) => void;
  onNext: () => void;
};

const SAMPLE_ORDER: SampleId[] = ['error', 'fixed', 'normal'];

/** 샘플 문서의 실제 점검 결과 요약 (fixture를 그대로 점검해서 계산) */
function sampleSummary(id: SampleId) {
  const ex = extract(SAMPLES[id].plan, SAMPLES[id].rubric);
  const n = countBySeverity(
    runChecks({ plan: ex.plan, rubric: ex.rubric, planStandards: ex.planStandards, pairs: suggestPairs(ex.plan, ex.rubric), links: [] }).cards,
  );
  return { n, assessments: ex.plan.length, standards: ex.planStandards.length };
}

export default function Upload({ plan, rubric, error, loading, lastRun, fixHint, onFile, onSample, onNext }: Props) {
  const ready = !!plan && !!rubric;
  return (
    <Page>
      <PageHead
        title={lastRun ? '고친 문서를 올려 주세요' : '평가계획서와 채점기준표를 올려 주세요'}
        right={
          <Button variant="primary" size="lg" disabled={!ready} onClick={onNext}>
            다음 {Icon.arrow()}
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-6 pb-8">
        {lastRun && <LastRunBanner run={lastRun} hint={fixHint} />}

        <div className="grid grid-cols-2 gap-6">
          <DropSlot kind="plan" doc={plan} onFile={onFile} />
          <DropSlot kind="rubric" doc={rubric} onFile={onFile} />
        </div>
        {error && <p className="rounded-xl bg-paper px-6 py-4 text-body font-bold text-sev-red shadow-card">{error}</p>}

        <Card className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-line-2 px-6 py-4">
            <h2 className="text-key font-bold text-ink">샘플 문서</h2>
            <span className="text-body text-ink-3">2026학년도 1학기 · 중학교 2학년 정보</span>
          </div>
          <table className="w-full border-collapse text-body">
            <tbody>
              {SAMPLE_ORDER.map((id) => {
                const sum = sampleSummary(id);
                return (
                  <tr key={id} className="border-b border-line-2 last:border-0">
                    <td className="py-4 pl-6 pr-4">
                      <div className="flex items-center gap-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue-50 text-brand-blue">{Icon.doc()}</span>
                        <div>
                          <div className="font-bold text-ink">정보과 평가계획 · {SAMPLES[id].label}</div>
                          <div className="text-ink-3">
                            평가 {sum.assessments}개 · 성취기준 {sum.standards}개
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-6">
                        {(['red', 'orange', 'gray'] as Severity[]).map((s) => (
                          <span key={s} className="inline-flex items-center gap-2 whitespace-nowrap text-ink-2">
                            <Dot s={s} />
                            {SEVERITY[s].label} <b className={`font-bold ${sum.n[s] ? SEVERITY[s].text : 'text-ink'}`}>{sum.n[s]}</b>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 pl-4 pr-6 text-right">
                      <Button onClick={() => onSample(id)} disabled={!!loading} className="w-24">
                        {loading === id ? '여는 중' : '열기'}
                      </Button>
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

function DropSlot({ kind, doc, onFile }: { kind: DocKind; doc?: ParsedDocument; onFile: Props['onFile'] }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(kind, f);
      }}
      onClick={() => input.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed bg-paper px-8 text-center transition-colors duration-150 h-[248px] ${over ? 'border-brand-blue bg-brand-blue-50' : doc ? 'border-brand-green' : 'border-line hover:border-brand-blue'}`}
    >
      <input
        ref={input}
        type="file"
        accept=".hwpx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(kind, f);
          e.target.value = '';
        }}
      />
      <span className={`flex h-16 w-16 items-center justify-center rounded-full ${doc ? 'bg-brand-green text-white' : 'bg-brand-blue-50 text-brand-blue'}`}>
        {doc ? Icon.check('h-8 w-8') : Icon.upload('h-8 w-8')}
      </span>
      <h2 className="text-title font-extrabold text-ink">{kind === 'plan' ? '평가계획서' : '채점기준표'}</h2>
      {doc ? (
        <p className="text-key font-bold text-brand-green">{doc.fileName}</p>
      ) : (
        <span className="rounded-lg bg-brand-navy px-6 py-2 text-body font-bold text-white">HWPX 파일 선택</span>
      )}
    </div>
  );
}

function LastRunBanner({ run, hint }: { run: Run; hint?: string | null }) {
  const n = countBySeverity(runChecks(run.input).cards);
  return (
    <Card className="flex items-center gap-6 px-6 py-4">
      <span className="text-body font-bold text-ink">지난 점검</span>
      {(['red', 'orange', 'gray', 'yellow'] as Severity[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-2 whitespace-nowrap text-body text-ink-2">
          <Dot s={s} />
          {SEVERITY[s].label} <b className="font-bold text-ink">{n[s]}</b>
        </span>
      ))}
      {hint && <span className="sr-only">고칠 곳: {hint}</span>}
    </Card>
  );
}
