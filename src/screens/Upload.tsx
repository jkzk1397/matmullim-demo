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

export default function Upload({ plan, rubric, error, loading, lastRun, fixHint, onFile, onSample, onNext }: Props) {
  const ready = !!plan && !!rubric;
  const [menu, setMenu] = useState(false);
  return (
    <Page>
      <PageHead title={lastRun ? '고친 문서를 올려 주세요' : '평가계획서와 채점기준표를 올려 주세요'} />
      <div className="flex min-h-0 flex-1 flex-col gap-6 pb-8">
        {lastRun && <LastRunBanner run={lastRun} hint={fixHint} />}

        <div className="grid grid-cols-2 gap-6">
          <DropSlot kind="plan" doc={plan} onFile={onFile} />
          <DropSlot kind="rubric" doc={rubric} onFile={onFile} />
        </div>
        {error && <p className="rounded-xl bg-paper px-6 py-4 text-body font-bold text-sev-red shadow-card">{error}</p>}

        <div className="flex items-center justify-between">
          <div className="relative">
            <Button onClick={() => setMenu(!menu)} disabled={!!loading}>
              {Icon.file('h-5 w-5')}
              {loading ? '여는 중…' : '샘플 문서 열기'}
              {Icon.chevron()}
            </Button>
            {menu && (
              <ul className="absolute bottom-12 left-0 z-20 w-56 overflow-hidden rounded-xl bg-paper py-2 shadow-[0_8px_24px_rgba(13,43,87,0.14)]" role="menu">
                {SAMPLE_ORDER.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenu(false);
                        onSample(id);
                      }}
                      className="block w-full px-4 py-2 text-left text-body font-bold text-ink hover:bg-canvas"
                    >
                      {SAMPLES[id].label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button variant="primary" size="lg" disabled={!ready} onClick={onNext}>
            다음 {Icon.arrow()}
          </Button>
        </div>
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
      className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed bg-paper px-8 text-center transition-colors duration-150 h-[432px] ${over ? 'border-brand-blue bg-brand-blue-50' : doc ? 'border-brand-green' : 'border-line hover:border-brand-blue'}`}
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
      <span className={`flex h-20 w-20 items-center justify-center rounded-full ${doc ? 'bg-brand-green text-white' : 'bg-brand-blue-50 text-brand-blue'}`}>
        {doc ? Icon.check('h-10 w-10') : Icon.upload('h-10 w-10')}
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
