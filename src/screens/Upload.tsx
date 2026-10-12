import { useRef, useState } from 'react';
import { countBySeverity, runChecks } from '../domain/rules';
import type { DocKind, ParsedDocument } from '../domain/types';
import type { SampleId } from '../fixtures';
import { SAMPLES } from '../fixtures';
import { DOC_NAME, SEVERITY, formatTime, type Run } from '../ui/helpers';
import { PageHead } from '../ui/layout';
import { Button, Icon } from '../ui/primitives';

type Props = {
  plan?: ParsedDocument;
  rubric?: ParsedDocument;
  error?: string;
  loading?: string | null;
  lastRun?: Run;
  onFile: (kind: DocKind, file: File) => void;
  onSample: (id: SampleId) => void;
  onNext: () => void;
};

const SAMPLE_ORDER: SampleId[] = ['error', 'fixed', 'normal'];

export default function Upload({ plan, rubric, error, loading, lastRun, onFile, onSample, onNext }: Props) {
  const ready = !!plan && !!rubric;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHead
        title={lastRun ? '고친 문서를 다시 올려 주세요' : '평가계획서와 채점기준표를 올려 주세요'}
        sub="2022 개정 교육과정 · 중학교 정보 · HWPX 파일. 두 문서를 나란히 읽고 서로 맞물리지 않는 곳을 찾아요."
      />
      <div className="flex min-h-0 flex-1 flex-col gap-6 px-8 pb-8">
        {lastRun && <LastRunBanner run={lastRun} />}
        <div className="grid grid-cols-2 gap-6">
          <DropSlot kind="plan" tall={!lastRun} doc={plan} onFile={onFile} hint="평가 개요(평가명·반영비율·만점)와 평가요소·배점·성취기준 표" />
          <DropSlot kind="rubric" tall={!lastRun} doc={rubric} onFile={onFile} hint="수행평가별 평가요소·성취기준·채점기준·배점 표" />
        </div>
        {error && <p className="rounded-lg bg-sev-red-bg px-4 py-3 text-body text-sev-red-ink">{error}</p>}

        <div className="flex items-center justify-between">
          <p className="text-meta text-ink-3">
            {ready ? '두 문서를 읽었어요. 다음 단계에서 추출한 값을 원문과 대조해 확인해요.' : '두 문서를 모두 올리면 다음 단계로 넘어가요.'}
          </p>
          <Button variant="primary" size="lg" disabled={!ready} onClick={onNext}>
            추출 결과 확인하기 {Icon.arrow()}
          </Button>
        </div>

        <section className="mt-2 border-t border-line pt-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-h2 font-semibold">예시 불러오기</h2>
            <span className="text-meta text-ink-3">팀이 직접 쓴 중학교 2학년 정보 평가계획 · public/samples/*.hwpx를 실제로 파싱해요</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {SAMPLE_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onSample(id)}
                disabled={!!loading}
                className="group flex items-center justify-between rounded-xl border border-line bg-white px-5 py-4 text-left transition-colors hover:border-accent hover:bg-accent-50/50 disabled:opacity-60"
              >
                <div>
                  <div className="text-body font-semibold text-ink">{SAMPLES[id].label}</div>
                  <div className="mt-0.5 text-meta text-ink-3">{SAMPLES[id].desc}</div>
                  <div className="mt-2 text-[12px] text-ink-4">
                    {SAMPLES[id].plan.fileName} · {SAMPLES[id].rubric.fileName}
                  </div>
                </div>
                <span className="text-ink-4 group-hover:text-accent">{loading === id ? '읽는 중…' : Icon.arrow('h-5 w-5')}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-auto grid grid-cols-4 gap-4 rounded-xl bg-canvas px-6 py-5">
          {[
            ['문서 간 불일치', '같은 평가의 만점과 채점기준표 배점 합계, 반영비율 합계'],
            ['성취기준 코드', '2022 개정 중학교 정보 성취기준 25개 DB와 대조'],
            ['채점기준 표현', '경기도교육청 2026 지침의 지양 표현(수행률·분량·감점 등)'],
            ['정렬 맵', '계획의 성취기준이 어떤 평가와 연결되는지'],
          ].map(([t, d]) => (
            <div key={t}>
              <div className="text-[14px] font-semibold text-ink">{t}</div>
              <div className="mt-1 text-meta text-ink-3">{d}</div>
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
      className={`flex ${tall ? 'h-[256px]' : 'h-[188px]'} cursor-pointer flex-col justify-between rounded-xl border-2 border-dashed px-6 py-5 transition-colors ${
        over ? 'border-accent bg-accent-50' : doc ? 'border-accent-100 bg-accent-50/40' : 'border-line hover:border-ink-4'
      }`}
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
      <div className="flex items-start justify-between">
        <div>
          <div className="text-h2 font-semibold">{kind === 'plan' ? '평가계획서' : '수행평가 채점기준표'}</div>
          <div className="mt-1 text-meta text-ink-3">{hint}</div>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-full ${doc ? 'bg-accent text-white' : 'bg-canvas text-ink-3'}`}>
          {doc ? Icon.check('h-5 w-5') : Icon.upload()}
        </span>
      </div>
      {doc ? (
        <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3">
          {Icon.file('h-5 w-5 text-accent')}
          <div className="min-w-0">
            <div className="truncate text-body font-semibold">{doc.fileName}</div>
            <div className="text-meta text-ink-3">
              표 {doc.tables.length}개 · {doc.tables.reduce((n, t) => n + t.rows.length - 1, 0)}줄 읽음 · {DOC_NAME[kind]}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-body text-ink-3">
          HWPX 파일을 끌어 놓거나 <span className="font-semibold text-accent">눌러서 고르기</span>
        </div>
      )}
    </div>
  );
}

function LastRunBanner({ run }: { run: Run }) {
  const n = countBySeverity(runChecks(run.input).cards);
  return (
    <div className="flex items-center justify-between rounded-xl border border-accent-100 bg-accent-50/60 px-5 py-3.5">
      <div className="text-body">
        <span className="font-semibold">이전 점검</span>
        <span className="mx-2 text-ink-4">|</span>
        {run.label} · {formatTime(run.at)}
        <span className="ml-4 inline-flex gap-3 text-meta text-ink-2">
          {(['red', 'orange', 'gray', 'yellow'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${SEVERITY[s].dot}`} />
              {SEVERITY[s].label} {n[s]}
            </span>
          ))}
        </span>
      </div>
      <span className="text-meta text-ink-3">고친 문서를 올리면 무엇이 해결됐는지 비교해 보여 드려요</span>
    </div>
  );
}
