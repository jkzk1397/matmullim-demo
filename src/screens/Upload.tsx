import { useRef, useState } from 'react';
import { countBySeverity, runChecks } from '../domain/rules';
import type { DocKind, ParsedDocument, Severity } from '../domain/types';
import type { SampleId } from '../fixtures';
import { SAMPLES } from '../fixtures';
import { SEVERITY, formatTime, type Run } from '../ui/helpers';
import { PageHead, Paper } from '../ui/layout';
import { Button, Icon, Swatch } from '../ui/primitives';

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

export default function Upload({ plan, rubric, error, loading, lastRun, fixHint, onFile, onSample, onNext }: Props) {
  const ready = !!plan && !!rubric;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHead
        title={lastRun ? '고친 문서를 올리면 지난 점검과 비교해 드려요' : '평가계획서와 채점기준표를 나란히 놓고, 맞지 않는 칸을 찾아요'}
        sub="2022 개정 교육과정 중학교 정보 · 한글(HWPX) 문서 두 개 · 파일은 이 브라우저 밖으로 나가지 않아요"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 px-8 pb-8">
        {lastRun && <LastRunBanner run={lastRun} hint={fixHint} />}

        <div className="flex items-stretch gap-3">
          <DropSlot kind="plan" tall={!lastRun} doc={plan} onFile={onFile} hint="평가 개요(평가명·반영비율·만점) 표와 평가요소·배점·성취기준 표가 있는 문서" />
          <div className="flex w-10 shrink-0 items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-paper text-ink-2 shadow-paper">{Icon.swap('h-5 w-5')}</span>
          </div>
          <DropSlot kind="rubric" tall={!lastRun} doc={rubric} onFile={onFile} hint="수행평가별 평가요소·성취기준·채점기준·배점 표가 있는 문서" />
        </div>
        {error && <p className="rounded-lg bg-sev-red-bg px-4 py-3 text-body text-sev-red-ink">{error}</p>}

        <div className="flex items-center justify-between">
          <p className="text-meta text-ink-3">
            HWP 파일이라면 한글에서 <b className="font-semibold text-ink-2">파일 › 다른 이름으로 저장 › 한글 문서(*.hwpx)</b>로 바꿔 주세요.
          </p>
          <Button variant="primary" size="lg" disabled={!ready} onClick={onNext}>
            읽어 낸 값 확인하기 {Icon.arrow()}
          </Button>
        </div>

        <section className="mt-1">
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="text-h2 font-bold text-ink">예시 문서로 해 보기</h2>
            <span className="text-meta text-ink-3">팀이 쓴 가상의 중학교 2학년 정보 평가계획 · 실제 HWPX 파일을 읽어요</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {SAMPLE_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onSample(id)}
                disabled={!!loading}
                className="group flex items-center justify-between rounded-xl bg-paper px-5 py-4 text-left shadow-paper transition-shadow duration-150 hover:shadow-lift disabled:opacity-60"
              >
                <span>
                  <span className="block text-body font-semibold text-ink">{SAMPLES[id].label}</span>
                  <span className="mt-0.5 block text-meta text-ink-3">{SAMPLES[id].desc}</span>
                </span>
                <span className="text-ink-3 transition-colors duration-150 group-hover:text-ink">{loading === id ? '읽는 중…' : Icon.arrow('h-5 w-5')}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-auto grid grid-cols-4 gap-6 border-t border-line pt-5">
          {[
            ['두 문서 사이', '같은 평가의 만점과 채점기준표 배점 합계, 반영비율 합계'],
            ['성취기준 코드', '2022 개정 중학교 정보 성취기준 25개와 대조'],
            ['채점기준 표현', '교육청 지침이 지양하는 표현(수행률·분량·감점 등)'],
            ['평가와의 연결', '계획의 성취기준이 어느 평가와 이어지는지'],
          ].map(([t, d]) => (
            <div key={t}>
              <h3 className="text-[14px] font-semibold text-ink">{t}</h3>
              <p className="mt-0.5 text-meta text-ink-3">{d}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function DropSlot({ kind, doc, onFile, hint, tall }: { kind: DocKind; doc?: ParsedDocument; onFile: Props['onFile']; hint: string; tall?: boolean }) {
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
      className={`flex flex-1 cursor-pointer flex-col rounded-xl bg-paper px-7 py-6 shadow-paper transition-shadow duration-150 hover:shadow-lift ${
        tall ? 'min-h-[300px]' : 'min-h-[236px]'
      } ${over ? 'ring-2 ring-pen' : ''}`}
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
      <div>
        <h2 className="text-h2 font-bold text-ink">{kind === 'plan' ? '평가계획서' : '수행평가 채점기준표'}</h2>
        <p className="mt-1 text-meta text-ink-3">{hint}</p>
      </div>
      {!doc && tall && (
        <div className="mb-4 mt-5 space-y-2" aria-label="읽는 표 머리글">
          <div className="text-meta text-ink-3">이런 머리글의 표를 읽어요</div>
          {(kind === 'plan'
            ? [
                ['평가명', '평가 방법', '반영비율(%)', '만점(점)'],
                ['평가명', '평가요소', '배점(점)', '성취기준 코드'],
              ]
            : [['평가명', '평가요소', '성취기준 코드', '채점기준', '배점(점)']]
          ).map((row, i) => (
            <div key={i} className="flex overflow-hidden rounded-md text-meta shadow-[inset_0_0_0_1px_#dcdfe4]">
              {row.map((h) => (
                <span key={h} className="flex-1 truncate border-r border-line px-2.5 py-1.5 text-ink-2 last:border-0">
                  {h}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
      {doc ? (
        <div className="mt-auto flex items-center gap-3 rounded-lg bg-pen-50 px-4 py-3">
          <span className="text-pen">{Icon.check('h-5 w-5')}</span>
          <div className="min-w-0">
            <div className="truncate text-body font-semibold text-ink">{doc.fileName}</div>
            <div className="text-meta text-ink-2">표 {doc.tables.length}개, {doc.tables.reduce((n, t) => n + t.rows.length - 1, 0)}줄을 읽었어요</div>
          </div>
        </div>
      ) : (
        <div className="mt-auto flex items-center gap-3 rounded-lg border-2 border-dashed border-line px-4 py-3.5 text-body text-ink-3">
          {Icon.upload()}
          <span>
            HWPX 파일을 끌어 놓거나 <span className="font-semibold text-ink">눌러서 고르기</span>
          </span>
        </div>
      )}
    </div>
  );
}

function LastRunBanner({ run, hint }: { run: Run; hint?: string | null }) {
  const n = countBySeverity(runChecks(run.input).cards);
  return (
    <Paper className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 px-5 py-3.5">
      <span className="whitespace-nowrap text-meta font-semibold text-ink-3">지난 점검</span>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="whitespace-nowrap text-[15px] font-semibold text-ink">
          {run.label} · {formatTime(run.at)}
        </span>
        {(['red', 'orange', 'gray', 'yellow'] as Severity[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 whitespace-nowrap text-meta text-ink-2">
            <Swatch s={s} />
            {SEVERITY[s].label} <b className="font-semibold text-ink">{n[s]}</b>
          </span>
        ))}
      </div>
      {hint && (
        <>
          <span className="whitespace-nowrap text-meta font-semibold text-ink-3">고칠 곳</span>
          <p className="text-[14px] leading-[22px] text-ink">{hint}</p>
        </>
      )}
    </Paper>
  );
}
