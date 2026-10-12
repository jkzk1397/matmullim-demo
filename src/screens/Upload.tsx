import { useRef, useState } from 'react';
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
const HELP = {
  plan: ['평가 개요 표: 평가명 · 평가 방법 · 반영비율(%) · 만점(점)', '평가 요소 표: 평가명 · 평가요소 · 배점(점) · 성취기준 코드'],
  rubric: ['채점기준 표: 평가명 · 평가요소 · 성취기준 코드 · 채점기준 · 배점(점)'],
};

export default function Upload({ plan, rubric, error, loading, lastRun, fixHint, onFile, onSample, onNext }: Props) {
  const ready = !!plan && !!rubric;
  const [help, setHelp] = useState(false);
  return (
    <Page>
      <PageHead
        title={lastRun ? '고친 문서를 올려 주세요' : '평가계획서와 채점기준표를 올려 주세요'}
        sub={lastRun ? '지난 점검과 비교해 무엇이 해결됐는지 보여 드려요.' : '두 문서를 나란히 읽고 서로 맞지 않는 칸을 찾아요. 파일은 이 브라우저 밖으로 나가지 않아요.'}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 pb-6">
        {lastRun && <LastRunBanner run={lastRun} hint={fixHint} />}

        <div className="grid grid-cols-2 gap-6">
          <DropSlot kind="plan" tall={!lastRun} doc={plan} onFile={onFile} />
          <DropSlot kind="rubric" tall={!lastRun} doc={rubric} onFile={onFile} />
        </div>

        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <button type="button" onClick={() => setHelp(!help)} aria-expanded={help} className="flex items-center gap-2 text-help font-bold text-brand-blue hover:underline underline-offset-4">
              {Icon.help()}어떤 표를 읽나요?
            </button>
            {help && (
              <ul className="mt-2 space-y-0.5 text-help text-ink-2">
                {[...HELP.plan, ...HELP.rubric].map((h) => (
                  <li key={h}>{h}</li>
                ))}
                <li className="text-ink-3">HWP 파일은 한글에서 ‘다른 이름으로 저장 → 한글 문서(*.hwpx)’로 바꿔 주세요.</li>
              </ul>
            )}
          </div>
          <Button variant="primary" size="lg" disabled={!ready} onClick={onNext}>
            읽어 낸 값 확인하기 {Icon.arrow()}
          </Button>
        </div>
        {error && <p className="rounded-lg bg-paper px-4 py-4 text-body font-bold text-sev-red shadow-card">{error}</p>}

        <section className="mt-2">
          <h2 className="mb-2 text-help font-bold text-ink-3">예시 문서로 해 보기</h2>
          <div className="grid grid-cols-3 gap-4">
            {SAMPLE_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onSample(id)}
                disabled={!!loading}
                className="group flex items-center justify-between rounded-xl bg-paper px-4 py-4 text-left shadow-card transition-colors duration-150 hover:bg-brand-blue-50 disabled:opacity-60"
              >
                <span>
                  <span className="block text-body font-bold text-ink">{SAMPLES[id].label}</span>
                  <span className="block text-help text-ink-3">{SAMPLES[id].desc}</span>
                </span>
                <span className="text-ink-3 transition-colors duration-150 group-hover:text-brand-navy">{loading === id ? '읽는 중…' : Icon.arrow('h-5 w-5')}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}

function DropSlot({ kind, doc, onFile, tall }: { kind: DocKind; doc?: ParsedDocument; onFile: Props['onFile']; tall?: boolean }) {
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
      className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed bg-paper px-8 text-center transition-colors duration-150 ${
        tall ? 'h-[312px]' : 'h-[200px]'
      } ${over ? 'border-brand-blue bg-brand-blue-50' : doc ? 'border-brand-green' : 'border-line hover:border-brand-blue'}`}
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
      <span className={`flex h-14 w-14 items-center justify-center rounded-full ${doc ? 'bg-brand-green text-white' : 'bg-brand-blue-50 text-brand-blue'}`}>
        {doc ? Icon.check('h-7 w-7') : Icon.upload('h-7 w-7')}
      </span>
      <h2 className="text-key font-bold text-ink">{kind === 'plan' ? '평가계획서' : '수행평가 채점기준표'}</h2>
      {doc ? (
        <p className="text-body text-ink-2">
          <b className="font-bold text-ink">{doc.fileName}</b> · 표 {doc.tables.length}개를 읽었어요
        </p>
      ) : (
        <p className="text-body text-ink-3">
          HWPX 파일을 끌어 놓거나 <b className="font-bold text-brand-blue">눌러서 고르기</b>
        </p>
      )}
    </div>
  );
}

function LastRunBanner({ run, hint }: { run: Run; hint?: string | null }) {
  const n = countBySeverity(runChecks(run.input).cards);
  return (
    <Card className="px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-help font-bold text-ink-3">지난 점검</span>
        <span className="text-body font-bold text-ink">{run.label}</span>
        {(['red', 'orange', 'gray', 'yellow'] as Severity[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-2 whitespace-nowrap text-help text-ink-2">
            <Dot s={s} />
            {SEVERITY[s].label} <b className="font-bold text-ink">{n[s]}</b>
          </span>
        ))}
      </div>
      {hint && <p className="mt-1 text-help text-ink-2">고칠 곳 · {hint}</p>}
    </Card>
  );
}
