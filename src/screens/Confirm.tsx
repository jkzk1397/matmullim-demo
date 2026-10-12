import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { extractCodes } from '../domain/standards';
import type { Assessment, CellRef, DocKind, Element, Extraction } from '../domain/types';
import { DOC_NAME, refKey, sameRef, type Docs } from '../ui/helpers';
import { DocTable, PageHead, Paper } from '../ui/layout';
import { Button, Icon } from '../ui/primitives';

type Props = {
  docs: Docs;
  ex: Extraction;
  original: Extraction;
  pairs: Record<string, string | null>;
  focus: CellRef | null;
  onFocus: (r: CellRef | null) => void;
  onChange: (ex: Extraction) => void;
  onPair: (rubricId: string, planId: string | null) => void;
  onSubmit: () => void;
};

/** 추출값이 나온 원문 칸 전부 (원문 표에 '읽어 낸 칸'으로 표시) */
function recognizedRefs(ex: Extraction): CellRef[] {
  const out: (CellRef | undefined)[] = [];
  for (const a of [...ex.plan, ...ex.rubric]) {
    out.push(a.source, ...Object.values(a.refs ?? {}));
    for (const e of a.elements) out.push(...Object.values(e.refs ?? {}));
  }
  for (const s of ex.planStandards) out.push(s.ref);
  return out.filter((x): x is CellRef => !!x);
}

export default function Confirm({ docs, ex, original, pairs, focus, onFocus, onChange, onPair, onSubmit }: Props) {
  const [tab, setTab] = useState<DocKind>(focus?.doc ?? 'plan');
  const recognized = useMemo(() => new Set(recognizedRefs(ex).map(refKey)), [ex]);
  useEffect(() => {
    if (!focus) return;
    setTab(focus.doc);
    requestAnimationFrame(() => {
      document.getElementById(`cell-${refKey(focus)}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      document.getElementById(`f-${refKey(focus)}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [focus]);

  const update = (kind: 'plan' | 'rubric', i: number, patch: Partial<Assessment>) =>
    onChange({ ...ex, [kind]: ex[kind].map((a, k) => (k === i ? { ...a, ...patch } : a)) });
  const updateEl = (kind: 'plan' | 'rubric', i: number, j: number, patch: Partial<Element>) =>
    update(kind, i, { elements: ex[kind][i].elements.map((e, k) => (k === j ? { ...e, ...patch } : e)) });

  const fp: FP = (ref, now, was) => ({
    id: ref ? `f-${refKey(ref)}` : undefined,
    active: sameRef(focus, ref),
    edited: JSON.stringify(now) !== JSON.stringify(was),
    onFocus: () => onFocus(ref ?? null),
  });
  const counts = `평가계획 평가 ${ex.plan.length}개, 채점기준표 평가 ${ex.rubric.length}개, 학기 성취기준 ${ex.planStandards.length}개`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHead title="읽어 낸 값을 원문과 맞춰 보고 확인해 주세요" sub={`${counts}를 읽었어요. 점선 칸이 읽어 낸 칸이고, 누르면 오른쪽 값과 이어져요.`} />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6 px-8">
        <Paper className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-end gap-1 border-b border-line-2 px-4 pt-3" role="tablist">
            {(['plan', 'rubric'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-[14px] transition-colors duration-150 ${
                  tab === k ? 'border-graphite font-semibold text-ink' : 'border-transparent text-ink-3 hover:text-ink'
                }`}
              >
                {Icon.file('h-4 w-4')}
                {DOC_NAME[k]}
                <span className="text-meta font-normal text-ink-3">{docs[k].fileName}</span>
              </button>
            ))}
            <span className="ml-auto pb-2.5 text-meta text-ink-3">원문</span>
          </div>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <div className="text-[14px] font-semibold text-ink">{docs[tab].title}</div>
            {docs[tab].tables.map((t, i) => (
              <DocTable key={i} table={t} index={i} doc={tab} highlight={focus} recognized={recognized} onCell={(r) => onFocus(r)} />
            ))}
          </div>
        </Paper>

        <Paper className="flex min-h-0 flex-col overflow-y-auto">
          <div className="space-y-7 px-6 py-5">
            <Section title="같은 평가 짝짓기" aside="두 문서에서 같은 평가끼리 묶어야 배점을 비교해요">
              {ex.rubric.map((r) => (
                <div key={r.id} className="flex items-center gap-3 border-b border-line-2 py-2 last:border-0">
                  <span className="w-[84px] shrink-0 text-meta text-ink-3">채점기준표</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                  <span className="text-ink-3">{Icon.swap()}</span>
                  <label className="sr-only" htmlFor={`pair-${r.id}`}>
                    {r.name}과 같은 평가계획의 평가
                  </label>
                  <select
                    id={`pair-${r.id}`}
                    value={pairs[r.id] ?? ''}
                    onChange={(e) => onPair(r.id, e.target.value || null)}
                    className="h-10 w-64 rounded-lg bg-desk-2 px-3 text-[14px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-pen"
                  >
                    <option value="">짝 없음</option>
                    {ex.plan.map((p) => (
                      <option key={p.id} value={p.id}>
                        평가계획 · {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </Section>

            <Section title="평가계획서" aside="만점·배점·반영비율은 따로 읽어요">
              {ex.plan.map((a, i) => {
                const o = original.plan[i];
                return (
                  <div key={a.id} className="border-b border-line-2 pb-3 pt-1 last:border-0">
                    <div className="grid grid-cols-[1fr_52px_136px_136px] items-center gap-2">
                      <Field label="평가명" value={a.name} onText={(v) => update('plan', i, { name: v })} strong {...fp(a.source, a.name, o?.name)} />
                      <span className="text-center text-meta text-ink-3">{a.method}</span>
                      <Field label="반영비율" suffix="%" value={a.weightPercent} onNum={(v) => update('plan', i, { weightPercent: v })} {...fp(a.refs?.weightPercent, a.weightPercent, o?.weightPercent)} />
                      <Field label="만점" suffix="점" value={a.maxScore} onNum={(v) => update('plan', i, { maxScore: v })} {...fp(a.refs?.maxScore, a.maxScore, o?.maxScore)} />
                    </div>
                    <ElementRows kind="plan" a={a} o={o} i={i} updateEl={updateEl} fp={fp} />
                  </div>
                );
              })}
            </Section>

            <Section title="채점기준표" aside="채점기준 문장은 지침 표현 점검에 써요">
              {ex.rubric.map((a, i) => {
                const o = original.rubric[i];
                return (
                  <div key={a.id} className="border-b border-line-2 pb-3 pt-1 last:border-0">
                    <Field label="평가명" value={a.name} onText={(v) => update('rubric', i, { name: v })} strong {...fp(a.source, a.name, o?.name)} />
                    <ElementRows kind="rubric" a={a} o={o} i={i} updateEl={updateEl} fp={fp} />
                  </div>
                );
              })}
            </Section>

            <Section title="학기 성취기준" aside="정렬 맵의 행이 돼요">
              <div className="flex flex-wrap gap-2">
                {ex.planStandards.map((s) => (
                  <button
                    key={s.code}
                    id={`f-${refKey(s.ref)}`}
                    type="button"
                    onClick={() => onFocus(s.ref)}
                    className={`rounded-md px-2.5 py-1 text-[14px] font-semibold transition-colors duration-150 ${
                      sameRef(focus, s.ref) ? 'bg-pen-50 text-pen ring-2 ring-pen' : 'bg-desk-2 text-ink-2 hover:bg-desk'
                    }`}
                  >
                    {s.code}
                  </button>
                ))}
              </div>
            </Section>
            {ex.warnings.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-desk-2 px-4 py-3 text-meta text-ink-2">
                {ex.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        </Paper>
      </div>

      <div className="mt-5 flex h-[72px] shrink-0 items-center justify-between bg-paper px-8 shadow-[0_-1px_0_#dcdfe4]">
        <p className="flex items-center gap-2 text-meta text-ink-3">
          <span className="text-pen">{Icon.pen('h-4 w-4')}</span>
          여기서 고친 값은 ‘교사 수정’으로 표시돼요. 문서 자체를 고쳤다면 결과를 본 뒤 고친 파일을 다시 올려 주세요.
        </p>
        <Button variant="primary" size="lg" onClick={onSubmit}>
          확인하고 점검 {Icon.arrow()}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {aside && <span className="text-meta text-ink-3">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

type FP = (ref: CellRef | undefined, now: unknown, was: unknown) => { id?: string; active: boolean; edited: boolean; onFocus: () => void };

function ElementRows({
  kind,
  a,
  o,
  i,
  updateEl,
  fp,
}: {
  kind: 'plan' | 'rubric';
  a: Assessment;
  o?: Assessment;
  i: number;
  updateEl: (k: 'plan' | 'rubric', i: number, j: number, p: Partial<Element>) => void;
  fp: FP;
}) {
  const cols = kind === 'plan' ? 'grid-cols-[1fr_96px_1fr]' : 'grid-cols-[1fr_96px_0.9fr_1.4fr]';
  return (
    <div className="mt-1 pl-3">
      <div className={`grid ${cols} gap-2 px-2 pb-0.5 text-meta text-ink-3`}>
        <span>평가요소</span>
        <span>배점</span>
        <span>성취기준 코드</span>
        {kind === 'rubric' && <span>채점기준</span>}
      </div>
      {a.elements.map((e, j) => {
        const oe = o?.elements[j];
        return (
          <div key={j} className={`grid ${cols} items-start gap-2`}>
            <Field value={e.name} onText={(v) => updateEl(kind, i, j, { name: v })} {...fp(e.refs?.name, e.name, oe?.name)} />
            <Field suffix="점" value={e.points} onNum={(v) => updateEl(kind, i, j, { points: v })} {...fp(e.refs?.points, e.points, oe?.points)} />
            <CodesField codes={e.standards} onCodes={(c) => updateEl(kind, i, j, { standards: c })} {...fp(e.refs?.standards, e.standards, oe?.standards)} />
            {kind === 'rubric' && <Field value={e.rubricText ?? ''} onText={(v) => updateEl(kind, i, j, { rubricText: v })} {...fp(e.refs?.rubricText, e.rubricText, oe?.rubricText)} />}
          </div>
        );
      })}
    </div>
  );
}

type FieldProps = {
  id?: string;
  label?: string;
  value: string | number | undefined;
  suffix?: string;
  onText?: (v: string) => void;
  onNum?: (v: number | undefined) => void;
  active: boolean;
  edited: boolean;
  onFocus: () => void;
  strong?: boolean;
};

function Field({ id, label, value, suffix, onText, onNum, active, edited, onFocus, strong }: FieldProps) {
  return (
    <label className={`flex h-10 min-w-0 items-center gap-1.5 rounded-md px-2 transition-colors duration-150 ${active ? 'bg-pen-50 ring-2 ring-pen' : 'hover:bg-desk-2'}`}>
      {label && <span className="shrink-0 text-meta text-ink-3">{label}</span>}
      <input
        id={id}
        value={value ?? ''}
        onFocus={onFocus}
        inputMode={onNum ? 'numeric' : undefined}
        onChange={(e) => {
          if (onNum) {
            const v = e.target.value.replace(/[^\d.]/g, '');
            onNum(v === '' ? undefined : Number(v));
          } else onText?.(e.target.value);
        }}
        className={`min-w-0 flex-1 truncate bg-transparent text-[15px] outline-none ${onNum ? 'text-right' : ''} ${strong ? 'font-semibold' : ''} ${edited ? 'text-pen' : 'text-ink'}`}
      />
      {suffix && <span className="shrink-0 text-meta text-ink-3">{suffix}</span>}
      {edited && (
        <span className="shrink-0 text-pen" title="교사 수정">
          {Icon.pen('h-3.5 w-3.5')}
        </span>
      )}
    </label>
  );
}

function CodesField({ codes, onCodes, ...rest }: { codes: string[]; onCodes: (c: string[]) => void; id?: string; active: boolean; edited: boolean; onFocus: () => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div
      className="min-w-0"
      onBlur={() => {
        if (draft !== null) onCodes(extractCodes(draft));
        setDraft(null);
      }}
    >
      <Field value={draft ?? codes.join(' ')} onText={setDraft} {...rest} />
    </div>
  );
}
