import { useMemo, useState } from 'react';
import { parseHwpx } from './domain/hwpx';
import { isHwp5, parseHwp5 } from './domain/hwp5';
import { isPdf, parsePdf } from './domain/pdf-text';
import { runChecks } from './domain/rules';
import type { Card, CellRef } from './domain/types';
import { applyQuickFix, counts, reviewsFor, setCellText, type Review, type Source, type SourceKind } from './domain/workspace';
import { Header, type Step } from './ui/layout';
import AlignmentMap from './screens/AlignmentMap';
import Home, { type SampleEntry } from './screens/Home';
import Overview from './screens/Overview';
import Report from './screens/Report';
import ReviewScreen, { locLabel } from './screens/Review';

let seq = 0;

async function readSource(name: string, buf: ArrayBuffer): Promise<Source> {
  const head = new Uint8Array(buf.slice(0, 8));
  const kind: SourceKind = isPdf(head) ? 'pdf' : isHwp5(head) ? 'hwp' : 'hwpx';
  if (!/\.(hwpx|hwp|pdf)$/i.test(name)) throw new Error(`${name}: HWP·HWPX·PDF 파일을 올려 주세요.`);
  const doc = kind === 'pdf' ? await parsePdf(buf, name, 'plan') : kind === 'hwp' ? parseHwp5(buf, name, 'plan') : await parseHwpx(buf, name, 'plan');
  if (!doc.tables.length) throw new Error(`${name}에서 표나 글자를 찾지 못했어요. 스캔한 PDF는 글자를 읽을 수 없어요.`);
  return { id: `f${++seq}`, name, kind, bytes: buf, doc };
}

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [step, setStep] = useState<Step>('upload');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [reportAll, setReportAll] = useState(false);
  const [recent, setRecent] = useState<{ name: string; at: Date; red: number; orange: number; sections: number }[]>([]);

  const review = useMemo(() => reviews.find((r) => r.id === current) ?? null, [reviews, current]);
  const multi = reviews.length > 1;

  const load = async (items: { name: string; buf: () => Promise<ArrayBuffer> }[], append = false) => {
    setError(undefined);
    const out: Review[] = [];
    try {
      for (const it of items) {
        setBusy(it.name);
        const src = await readSource(it.name, await it.buf());
        const rs = reviewsFor(src);
        if (!rs.length) throw new Error(`${it.name}에서 교과 계획을 찾지 못했어요.`);
        out.push(...rs);
        setRecent((xs) => [
          { name: it.name, at: new Date(), red: rs.reduce((n, r) => n + counts(r).red, 0), orange: rs.reduce((n, r) => n + counts(r).orange, 0), sections: rs.length },
          ...xs,
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
    if (!out.length) return;
    const next = append ? [...reviews, ...out] : out;
    setReviews(next);
    setCurrent(next[append ? reviews.length : 0].id);
    setStep(next.length > 1 ? 'overview' : 'review');
  };

  const onFiles = (files: File[]) => load(files.map((f) => ({ name: f.name, buf: () => f.arrayBuffer() })));
  const onSample = (s: SampleEntry) =>
    load([{ name: s.file.split('/').pop()!, buf: async () => (await fetch(`${import.meta.env.BASE_URL}samples/v2/${s.file}`)).arrayBuffer() }]);

  const update = (next: Review) => setReviews((rs) => rs.map((r) => (r.id === next.id ? next : r)));

  const onQuickFix = (card: Card) => review && update(applyQuickFix(review, card));
  const onEditCell = (ref: CellRef, text: string) => review && update(setCellText(review, ref, text));
  const onMemo = (key: string, text: string | null) => {
    if (!review) return;
    const memos = { ...review.memos };
    if (text === null) delete memos[key];
    else memos[key] = text;
    update({ ...review, memos });
  };

  const onToggleLink = (code: string, assessmentId: string) => {
    if (!review) return;
    const links = review.input.links;
    const exists = links.some((l) => l.code === code && l.assessmentId === assessmentId);
    const input = { ...review.input, links: exists ? links.filter((l) => !(l.code === code && l.assessmentId === assessmentId)) : [...links, { code, assessmentId }] };
    update({ ...review, input, result: runChecks(input) });
  };

  const onDownload = async () => {
    if (!review) return;
    const base = review.source.name.replace(/\.(hwpx|hwp|pdf)$/i, '');
    // 같은 파일의 다른 교과에서 고친 것까지 한 번에
    const sameFile = reviews.filter((r) => r.source.id === review.source.id);
    const edits = sameFile.flatMap((r) => r.edits);
    if (review.source.kind === 'hwpx' && edits.length) {
      const { patchHwpx } = await import('./domain/hwpx-patch');
      const out = await patchHwpx(review.source.bytes, edits);
      download(`${base}_맞물림수정.hwpx`, out.bytes, 'application/hwp+zip');
      return;
    }
    const lines = [`[맞물림 수정 목록] ${review.source.name}`, ''];
    for (const r of sameFile) {
      lines.push(`■ ${r.ex.context?.subject ?? ''} ${r.ex.context?.grades.length ? `(${r.ex.context.grades.join('·')}학년)` : ''}`);
      for (const e of r.edits) lines.push(`  · ${locLabel(r.doc, { doc: 'plan', table: e.table, row: e.row, col: e.col })}: "${e.from}" → "${e.to}"`);
      for (const c of r.result.cards.filter((x) => x.severity !== 'yellow')) lines.push(`  □ ${c.title}${c.fix ? ` — ${c.fix}` : ''}`);
      lines.push('');
    }
    download(`${base}_수정목록.txt`, lines.join('\n'), 'text/plain;charset=utf-8');
  };

  const enabled: Record<Step, boolean> = {
    upload: true,
    overview: multi,
    review: !!review,
    map: !!review,
    report: !!review,
  };

  return (
    <div className="flex h-full min-w-[1280px] flex-col print:block print:h-auto print:min-w-0">
      <div className="print:hidden">
        <Header
          step={step}
          enabled={enabled}
          onStep={(s) => {
            if (s === 'report') setReportAll(false);
            setStep(s);
          }}
        />
      </div>
      <main className="flex min-h-0 flex-1 flex-col print:block">
        {step === 'upload' && <Home busy={busy} error={error} onFiles={onFiles} onSample={onSample} recent={recent} />}
        {step === 'overview' && (
          <Overview
            reviews={reviews}
            onOpen={(id) => {
              setCurrent(id);
              setStep('review');
            }}
            onReport={() => {
              setReportAll(true);
              setStep('report');
            }}
            onAdd={() => setStep('upload')}
          />
        )}
        {step === 'review' && review && (
          <ReviewScreen
            key={review.id}
            review={review}
            onQuickFix={onQuickFix}
            onEditCell={onEditCell}
            onMemo={onMemo}
            onMap={() => setStep('map')}
            onReport={() => {
              setReportAll(false);
              setStep('report');
            }}
            onDownload={onDownload}
            onBack={multi ? () => setStep('overview') : undefined}
          />
        )}
        {step === 'map' && review && <AlignmentMap input={review.input} onToggle={onToggleLink} onResults={() => setStep('review')} lastLinked={null} />}
        {step === 'report' && review && <Report reviews={reportAll ? reviews : [review]} onBack={() => setStep(reportAll ? 'overview' : 'review')} />}
      </main>
    </div>
  );
}
