import { useMemo, useState } from 'react';
import { parseHwpx } from './domain/hwpx';
import { isHwp5, parseHwp5 } from './domain/hwp5';
import { isPdf, parsePdf } from './domain/pdf-text';
import { parseDocx, parseOdt, parseXlsx, zipKind } from './domain/office';
import { runChecks } from './domain/rules';
import type { Card, CellRef } from './domain/types';
import { applyQuickFix, counts, KIND_LABEL, reviewsFor, setCellText, type Review, type Source, type SourceKind } from './domain/workspace';
import { Header, type Step } from './ui/layout';
import AlignmentMap from './screens/AlignmentMap';
import Home, { type SampleEntry } from './screens/Home';
import Overview from './screens/Overview';
import Report from './screens/Report';
import ReviewScreen from './screens/Review';
import { locLabel } from './screens/locLabel';

let seq = 0;

/** 읽지 못한 이유 (교사에게 보이는 말) */
class ReadFail extends Error {}

const EXT = /\.(hwpx|hwp|pdf|docx|xlsx|odt)$/i;
const OLD_OFFICE = /\.(doc|xls|ppt|pptx|cell|show)$/i;

async function readSource(name: string, buf: ArrayBuffer): Promise<Source> {
  const head = new Uint8Array(buf.slice(0, 8));
  if (OLD_OFFICE.test(name)) throw new ReadFail('이 형식은 아직 읽지 못해요. 한글·Word·Excel 문서로 저장해 올려 주세요');
  if (!EXT.test(name)) throw new ReadFail('문서 파일(HWP·HWPX·PDF·Word·Excel·ODT)이 아니에요');
  if (!buf.byteLength) throw new ReadFail('빈 파일이에요');
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  let kind: SourceKind;
  if (isPdf(head)) kind = 'pdf';
  else if (isHwp5(head)) kind = 'hwp';
  else if (isZip) {
    const z = await zipKind(buf).catch(() => null);
    if (!z) throw new ReadFail('파일 안을 읽지 못했어요');
    kind = z;
  } else throw new ReadFail(/\.pdf$/i.test(name) ? 'PDF 형식이 아니에요' : /\.hwp$/i.test(name) ? 'HWP 형식이 아니에요' : '파일이 손상됐거나 형식이 달라요');
  let doc;
  try {
    doc =
      kind === 'pdf' ? await parsePdf(buf, name, 'plan')
      : kind === 'hwp' ? parseHwp5(buf, name, 'plan')
      : kind === 'docx' ? await parseDocx(buf, name, 'plan')
      : kind === 'xlsx' ? await parseXlsx(buf, name, 'plan')
      : kind === 'odt' ? await parseOdt(buf, name, 'plan')
      : await parseHwpx(buf, name, 'plan');
  } catch {
    throw new ReadFail(kind === 'pdf' ? 'PDF를 열지 못했어요' : kind === 'hwp' ? 'HWP 파일을 열지 못했어요 (암호가 걸려 있는지 확인해 주세요)' : `${KIND_LABEL[kind]} 파일을 열지 못했어요`);
  }
  if (!doc.tables.length) throw new ReadFail(kind === 'pdf' ? '표를 찾지 못했어요 (스캔한 PDF는 글자를 읽을 수 없어요)' : '표를 찾지 못했어요');
  return { id: `f${++seq}`, name, kind, bytes: buf, doc };
}

/** 같은 파일 판별: 크기 + 앞 4KB */
function fingerprint(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf, 0, Math.min(4096, buf.byteLength));
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 0x01000193) >>> 0;
  return `${buf.byteLength}:${h.toString(16)}`;
}

const sevScore = (r: Review) => {
  const n = counts(r);
  return n.red * 10000 + n.orange * 100 + n.gray + (r.ex.plan.length ? 0 : 50);
};

/** 처음 읽었을 때 한 번만 심각한 순으로 줄 세운다 (파일끼리, 파일 안 교과끼리) */
function orderOf(rs: Review[]): string[] {
  const byFile = new Map<string, Review[]>();
  for (const r of rs) byFile.set(r.source.id, [...(byFile.get(r.source.id) ?? []), r]);
  const files = [...byFile.values()].map((xs) => ({ xs: [...xs].sort((a, b) => sevScore(b) - sevScore(a)), s: Math.max(...xs.map(sevScore)) }));
  files.sort((a, b) => b.s - a.s);
  return files.flatMap((f) => f.xs.map((r) => r.id));
}

export type LoadFailure = { name: string; reason: string };
export type LoadNotice = { tried: number; read: number; failures: LoadFailure[]; duplicates: string[] };
export type LoadStats = { files: number; sections: number; ms: number };

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const orderReviews = (rs: Review[], order: string[]) => {
  const pos = new Map(order.map((id, i) => [id, i]));
  return [...rs].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
};

export default function App() {
  const [step, setStep] = useState<Step>('upload');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [reportAll, setReportAll] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [stats, setStats] = useState<LoadStats | null>(null);
  const [notice, setNotice] = useState<LoadNotice | null>(null);
  const [recent, setRecent] = useState<{ name: string; at: Date; red: number; orange: number; sections: number }[]>([]);

  const review = useMemo(() => reviews.find((r) => r.id === current) ?? null, [reviews, current]);
  const [appendNext, setAppendNext] = useState(false);
  const [overviewSticky, setOverviewSticky] = useState(false);
  const multi = reviews.length > 1 || overviewSticky;

  const load = async (items: { name: string; buf: () => Promise<ArrayBuffer> }[], append = false) => {
    setError(undefined);
    const t0 = performance.now();
    const out: Review[] = [];
    const failures: LoadFailure[] = [];
    const duplicates: string[] = [];
    const base = append ? reviews : [];
    const seen = new Set<string>();
    for (const r of base) {
      seen.add(fingerprint(r.source.bytes));
      seen.add(`${r.source.name}:${r.source.bytes.byteLength}`);
    }
    let readCount = 0;
    for (const it of items) {
      setBusy(it.name);
      try {
        const buf = await it.buf();
        const fp = fingerprint(buf);
        const ns = `${it.name}:${buf.byteLength}`;
        if (seen.has(fp) || seen.has(ns)) {
          duplicates.push(it.name);
          continue;
        }
        seen.add(fp);
        seen.add(ns);
        const src = await readSource(it.name, buf);
        const rs = reviewsFor(src);
        if (!rs.length) throw new ReadFail('교과 계획을 찾지 못했어요');
        out.push(...rs);
        readCount++;
        setRecent((xs) => [
          { name: it.name, at: new Date(), red: rs.reduce((n, r) => n + counts(r).red, 0), orange: rs.reduce((n, r) => n + counts(r).orange, 0), sections: rs.length },
          ...xs,
        ]);
      } catch (e) {
        failures.push({ name: it.name, reason: e instanceof ReadFail ? e.message : '파일을 읽지 못했어요' });
        if (!(e instanceof ReadFail)) console.error(it.name, e);
      }
    }
    setBusy(null);
    const ms = performance.now() - t0;
    const notice: LoadNotice = { tried: items.length, read: readCount, failures, duplicates };
    if (!out.length) {
      const lines = [...failures.map((f) => `${f.name}: ${f.reason}`), ...duplicates.map((d) => `${d}: 이미 올린 파일이에요`)];
      setError(lines.join('\n') || '읽은 파일이 없어요');
      return;
    }
    const next = append ? [...reviews, ...out] : out;
    setReviews(next);
    setOrder((o) => (append ? [...o, ...orderOf(out)] : orderOf(out)));
    setStats((st) => ({
      files: new Set(next.map((r) => r.source.id)).size,
      sections: next.length,
      ms: (append && st ? st.ms : 0) + ms,
    }));
    setNotice(failures.length || duplicates.length ? notice : null);
    setCurrent(next[append ? reviews.length : 0].id);
    setAppendNext(false);
    const toOverview = items.length > 1 || next.length > 1;
    setOverviewSticky(toOverview);
    setStep(toOverview ? 'overview' : 'review');
  };

  const onFiles = (files: File[]) => load(files.map((f) => ({ name: f.name, buf: () => f.arrayBuffer() })), appendNext && reviews.length > 0);
  const onSample = (s: SampleEntry) =>
    load([{ name: s.file.split('/').pop()!, buf: async () => (await fetch(`${import.meta.env.BASE_URL}samples/v2/${s.file}`)).arrayBuffer() }], appendNext && reviews.length > 0);

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
    const base = review.source.name.replace(/\.(hwpx|hwp|pdf|docx|xlsx|odt)$/i, '');
    // 같은 파일의 다른 교과에서 고친 것까지 한 번에
    const sameFile = reviews.filter((r) => r.source.id === review.source.id);
    const edits = sameFile.flatMap((r) => r.edits);
    if (review.source.kind === 'hwpx' && edits.length) {
      const { patchHwpx } = await import('./domain/hwpx-patch');
      const out = await patchHwpx(review.source.bytes, edits);
      download(`${base}_맞물림수정.hwpx`, out.bytes, 'application/hwp+zip');
      return;
    }
    if (review.source.kind === 'docx' && edits.length) {
      const { patchDocx } = await import('./domain/office-patch');
      const out = await patchDocx(review.source.bytes, edits);
      download(`${base}_맞물림수정.docx`, out.bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
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
            if (s === 'upload') setAppendNext(false);
            setStep(s);
          }}
        />
      </div>
      <main className="flex min-h-0 flex-1 flex-col print:block">
        {step === 'upload' && <Home busy={busy} error={error} onFiles={onFiles} onSample={onSample} recent={recent} appending={appendNext && reviews.length > 0} />}
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
            onAdd={() => {
              setAppendNext(true);
              setStep('upload');
            }}
            order={order}
            stats={stats}
            notice={notice}
            onDismissNotice={() => setNotice(null)}
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
        {step === 'report' && review && <Report reviews={reportAll ? orderReviews(reviews, order) : [review]} cover={reportAll} onBack={() => setStep(reportAll ? 'overview' : 'review')} />}
      </main>
    </div>
  );
}
