import { useMemo, useState } from 'react';
import { extract, suggestPairs } from './domain/extract';
import { parseHwpx } from './domain/hwpx';
import { runChecks } from './domain/rules';
import type { Action, Card, CellRef, DocKind, Extraction, ParsedDocument } from './domain/types';
import { SAMPLES, type SampleId } from './fixtures';
import type { Run } from './ui/helpers';
import { Header, type Step } from './ui/layout';
import AlignmentMap from './screens/AlignmentMap';
import Confirm from './screens/Confirm';
import Recheck from './screens/Recheck';
import Results from './screens/Results';
import Upload from './screens/Upload';

type Slots = { plan?: ParsedDocument; rubric?: ParsedDocument; label?: string };

async function loadSample(id: SampleId, kind: DocKind): Promise<ParsedDocument> {
  const fixture = SAMPLES[id][kind];
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}samples/${fixture.fileName}`);
    if (!res.ok) throw new Error(String(res.status));
    return await parseHwpx(await res.arrayBuffer(), fixture.fileName, kind);
  } catch (e) {
    console.warn('예시 HWPX를 읽지 못해 JSON fixture를 씁니다', e);
    return fixture;
  }
}

export default function App() {
  const [step, setStep] = useState<Step>('upload');
  const [slots, setSlots] = useState<Slots>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [ex, setEx] = useState<Extraction | null>(null);
  const [pairs, setPairs] = useState<Record<string, string | null>>({});
  const [confirmStart, setConfirmStart] = useState(Date.now());
  const [focus, setFocus] = useState<CellRef | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [lastLinked, setLastLinked] = useState<{ code: string; name: string } | null>(null);

  const run = runs[runs.length - 1];
  const prevRun = runs[runs.length - 2];
  const result = useMemo(() => (run ? runChecks(run.input) : null), [run]);

  const prepare = (plan: ParsedDocument, rubric: ParsedDocument) => {
    const e = extract(plan, rubric);
    setEx(e);
    setPairs(suggestPairs(e.plan, e.rubric));
    setFocus(e.plan[0]?.source ?? null);
    setConfirmStart(Date.now());
    setStep('confirm');
  };

  const onSample = async (id: SampleId) => {
    setLoading(id);
    setError(undefined);
    const [plan, rubric] = await Promise.all([loadSample(id, 'plan'), loadSample(id, 'rubric')]);
    setSlots({ plan, rubric, label: `${SAMPLES[id].label} 예시` });
    setLoading(null);
    prepare(plan, rubric);
  };

  const onFile = async (kind: DocKind, file: File) => {
    setError(undefined);
    try {
      if (!/\.hwpx$/i.test(file.name)) throw new Error('HWPX 파일만 읽을 수 있어요. 한글에서 “다른 이름으로 저장 → HWPX”로 바꿔 주세요.');
      const doc = await parseHwpx(await file.arrayBuffer(), file.name, kind);
      if (!doc.tables.length) throw new Error(`${file.name}에서 표를 찾지 못했어요.`);
      setSlots((s) => {
        const next = { ...s, [kind]: doc };
        return { ...next, label: [next.plan?.fileName, next.rubric?.fileName].filter(Boolean).join(' + ') };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submit = () => {
    if (!ex || !slots.plan || !slots.rubric) return;
    const r: Run = {
      id: runs.length + 1,
      label: slots.label ?? '업로드한 문서',
      at: new Date(),
      docs: { plan: slots.plan, rubric: slots.rubric },
      input: { plan: ex.plan, rubric: ex.rubric, planStandards: ex.planStandards, pairs, links: [] },
      confirmMs: Date.now() - confirmStart,
    };
    setRuns((rs) => [...rs, r]);
    setMemos({});
    setLastLinked(null);
    setStep('results');
  };

  const onAction = (a: Action, card: Card) => {
    if (a === 'link' && card.rule === 'J6') return setStep('map');
    setFocus(card.locations[0] ?? null);
    setConfirmStart(Date.now());
    setStep('confirm');
  };

  const toggleLink = (code: string, assessmentId: string) => {
    if (!run) return;
    const links = run.input.links;
    const exists = links.some((l) => l.code === code && l.assessmentId === assessmentId);
    const next = exists ? links.filter((l) => !(l.code === code && l.assessmentId === assessmentId)) : [...links, { code, assessmentId }];
    setRuns((rs) => rs.map((r) => (r === run ? { ...r, input: { ...r.input, links: next } } : r)));
    setLastLinked(exists ? null : { code, name: run.input.plan.find((p) => p.id === assessmentId)?.name ?? '' });
  };

  const reupload = () => {
    setSlots({});
    setError(undefined);
    setStep('upload');
  };

  const enabled: Record<Step, boolean> = {
    upload: true,
    confirm: !!ex && !!slots.plan && !!slots.rubric,
    results: !!run,
    map: !!run,
    recheck: !!run,
  };

  return (
    <div className="flex h-full min-w-[1280px] flex-col">
      <Header step={step} enabled={enabled} onStep={setStep} />
      <main className="flex min-h-0 flex-1 flex-col">
        {step === 'upload' && (
          <Upload
            plan={slots.plan}
            rubric={slots.rubric}
            error={error}
            loading={loading}
            lastRun={run}
            onFile={onFile}
            onSample={onSample}
            onNext={() => slots.plan && slots.rubric && prepare(slots.plan, slots.rubric)}
          />
        )}
        {step === 'confirm' && ex && slots.plan && slots.rubric && (
          <Confirm
            docs={{ plan: slots.plan, rubric: slots.rubric }}
            ex={ex}
            pairs={pairs}
            startedAt={confirmStart}
            focus={focus}
            onFocus={setFocus}
            onChange={setEx}
            onPair={(r, p) => setPairs((ps) => ({ ...ps, [r]: p }))}
            onSubmit={submit}
          />
        )}
        {step === 'results' && run && result && (
          <Results
            key={run.id}
            run={run}
            prevRun={prevRun}
            result={result}
            memos={memos}
            onMemo={(k, t) => setMemos((m) => ({ ...m, [k]: t }))}
            onAction={onAction}
            onRecheck={reupload}
            onCompare={() => setStep('recheck')}
            onMap={() => setStep('map')}
          />
        )}
        {step === 'map' && run && <AlignmentMap input={run.input} onToggle={toggleLink} onResults={() => setStep('results')} lastLinked={lastLinked} />}
        {step === 'recheck' && <Recheck prev={prevRun} curr={run} onUpload={reupload} onResults={() => setStep('results')} />}
      </main>
    </div>
  );
}
