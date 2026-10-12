import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { extractCodes } from '../domain/standards';
import type { Assessment, CellRef, DocKind, Element, Extraction } from '../domain/types';
import { DOC_NAME, refKey, sameRef, type Docs } from '../ui/helpers';
import { DocTable, Page, PageHead } from '../ui/layout';
import { Button, Card, Icon } from '../ui/primitives';

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

/** 추출값이 나온 원문 칸 전부 (누르면 오른쪽 값으로 이어짐) */
function recognizedRefs(ex: Extraction): CellRef[] {
  const out: (CellRef | undefined)[] = [];
  for (const a of [...ex.plan, ...ex.rubric]) {
    out.push(a.source, ...Object.values(a.refs ?? {}));
    for (const e of a.elements) out.push(...Object.values(e.refs ?? {}));
  }
  for (const s of ex.planStandards) out.push(s.ref);
  return out.filter((x): x is CellRef => !!x);
}

/** 접어 두는 값의 원문 칸 (반영비율·평가 방법·채점기준) */
function foldedRefs(ex: Extraction): Set<string> {
  const out: CellRef[] = [];
  for (const a of ex.plan) out.push(...[a.refs?.weightPercent, a.refs?.method].filter((x): x is CellRef => !!x));
  for (const a of ex.rubric) for (const e of a.elements) if (e.refs?.rubricText) out.push(e.refs.rubricText);
  return new Set(out.map(refKey));
}

export default function Confirm({ docs, ex, original, pairs, focus, onFocus, onChange, onPair, onSubmit }: Props) {
  const [tab, setTab] = useState<DocKind>(focus?.doc ?? 'plan');
  const [more, setMore] = useState(false);
  const [editPairs, setEditPairs] = useState(false);
  const recognized = useMemo(() => new Set(recognizedRefs(ex).map(refKey)), [ex]);
  const folded = useMemo(() => foldedRefs(ex), [ex]);
  useEffect(() => {
    if (!focus) return;
    setTab(focus.doc);
    if (folded.has(refKey(focus))) setMore(true);
    requestAnimationFrame(() => {
      document.getElementById(`cell-${refKey(focus)}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      document.getElementById(`f-${refKey(focus)}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [focus, folded]);

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
  const paired = ex.rubric.filter((r) => pairs[r.id]).length;
  const allPaired = paired === ex.rubric.length && paired > 0;

  return (
    <Page>
      <PageHead title="읽어 낸 값을 원문과 맞춰 보세요" sub="값을 누르면 원문의 같은 칸이 표시돼요. 틀린 값은 바로 고칠 수 있어요." />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
        <Card className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-end gap-1 border-b border-line-2 px-4 pt-2" role="tablist">
            {(['plan', 'rubric'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`-mb-px flex items-center gap-2 border-b-[3px] px-4 pb-2 pt-2 text-help transition-colors duration-150 ${
                  tab === k ? 'border-brand-navy font-bold text-brand-navy' : 'border-transparent text-ink-3 hover:text-ink'
                }`}
              >
                {Icon.file('h-4 w-4')}
                {DOC_NAME[k]}
              </button>
            ))}
            <span className="ml-auto pb-2 text-help text-ink-3">{docs[tab].fileName}</span>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {docs[tab].tables.map((t, i) => (
              <DocTable key={i} table={t} index={i} doc={tab} highlight={focus} recognized={recognized} onCell={(r) => onFocus(r)} />
            ))}
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-line-2 px-4 py-2">
            {allPaired && !editPairs ? (
              <span className="flex items-center gap-2 text-help font-bold text-brand-green">
                {Icon.check()}
                {paired}쌍 자동 연결
                <button type="button" className="ml-1 font-bold text-brand-blue underline-offset-4 hover:underline" onClick={() => setEditPairs(true)}>
                  바꾸기
                </button>
              </span>
            ) : (
              <span className="text-help font-bold text-ink-2">같은 평가끼리 짝지어 주세요</span>
            )}
            <button type="button" onClick={() => setMore(!more)} className="flex items-center gap-1 text-help font-bold text-ink-3 hover:text-ink" aria-expanded={more}>
              {more ? '다른 값 접기' : '다른 값도 보기 (반영비율·채점기준)'}
              <span className={more ? 'rotate-180' : ''}>{Icon.chevron()}</span>
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {(!allPaired || editPairs) && (
              <div className="space-y-2">
                {ex.rubric.map((r) => (
                  <label key={r.id} className="flex items-center gap-4 text-body">
                    <span className="min-w-0 flex-1 truncate font-bold">{r.name}</span>
                    <span className="text-help text-ink-3">= 평가계획의</span>
                    <select
                      value={pairs[r.id] ?? ''}
                      onChange={(e) => onPair(r.id, e.target.value || null)}
                      className="h-10 w-56 rounded-lg bg-canvas px-4 text-help font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    >
                      <option value="">짝 없음</option>
                      {ex.plan.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}

            <Section title="평가계획서">
              {ex.plan.map((a, i) => {
                const o = original.plan[i];
                return (
                  <Block key={a.id}>
                    <div className="flex items-center gap-2">
                      <Field value={a.name} onText={(v) => update('plan', i, { name: v })} grow {...fp(a.source, a.name, o?.name)} />
                      {more && (
                        <Field label="반영비율" suffix="%" value={a.weightPercent} onNum={(v) => update('plan', i, { weightPercent: v })} w="w-40" {...fp(a.refs?.weightPercent, a.weightPercent, o?.weightPercent)} />
                      )}
                      <Field label="만점" suffix="점" value={a.maxScore} onNum={(v) => update('plan', i, { maxScore: v })} strong w="w-32" {...fp(a.refs?.maxScore, a.maxScore, o?.maxScore)} />
                    </div>
                    <ElementRows kind="plan" a={a} o={o} i={i} updateEl={updateEl} fp={fp} more={more} />
                  </Block>
                );
              })}
            </Section>

            <Section title="채점기준표">
              {ex.rubric.map((a, i) => {
                const o = original.rubric[i];
                return (
                  <Block key={a.id}>
                    <Field value={a.name} onText={(v) => update('rubric', i, { name: v })} grow {...fp(a.source, a.name, o?.name)} />
                    <ElementRows kind="rubric" a={a} o={o} i={i} updateEl={updateEl} fp={fp} more={more} />
                  </Block>
                );
              })}
            </Section>

            <Section title="학기 성취기준">
              <div className="flex flex-wrap gap-2">
                {ex.planStandards.map((s) => (
                  <button
                    key={s.code}
                    id={`f-${refKey(s.ref)}`}
                    type="button"
                    onClick={() => onFocus(s.ref)}
                    className={`rounded-md px-2 py-1 text-help font-bold transition-colors duration-150 ${
                      sameRef(focus, s.ref) ? 'bg-brand-blue-50 text-brand-blue ring-2 ring-brand-blue' : 'bg-canvas text-ink hover:bg-line-2'
                    }`}
                  >
                    {s.code}
                  </button>
                ))}
              </div>
            </Section>
            {ex.warnings.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-canvas px-4 py-4 text-help text-ink-2">
                {ex.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="flex shrink-0 items-center justify-between py-4">
        <p className="flex items-center gap-2 text-help text-ink-3">
          <span className="text-brand-blue">{Icon.pen()}</span>
          여기서 고친 값은 ‘교사 수정’으로 표시돼요.
        </p>
        <Button variant="primary" size="lg" onClick={onSubmit}>
          확인하고 점검 {Icon.arrow()}
        </Button>
      </div>
    </Page>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-help font-bold text-ink-3">{title}</h2>
      <div className="divide-y divide-line-2">{children}</div>
    </section>
  );
}

function Block({ children }: { children: ReactNode }) {
  return <div className="py-2">{children}</div>;
}

type FP = (ref: CellRef | undefined, now: unknown, was: unknown) => { id?: string; active: boolean; edited: boolean; onFocus: () => void };

function ElementRows({
  kind,
  a,
  o,
  i,
  updateEl,
  fp,
  more,
}: {
  kind: 'plan' | 'rubric';
  a: Assessment;
  o?: Assessment;
  i: number;
  updateEl: (k: 'plan' | 'rubric', i: number, j: number, p: Partial<Element>) => void;
  fp: FP;
  more: boolean;
}) {
  return (
    <div className="mt-0.5 pl-4">
      {a.elements.map((e, j) => {
        const oe = o?.elements[j];
        return (
          <div key={j}>
            <div className="grid grid-cols-[minmax(0,1fr)_104px_minmax(0,0.9fr)] items-center gap-2">
              <Field value={e.name} onText={(v) => updateEl(kind, i, j, { name: v })} quiet {...fp(e.refs?.name, e.name, oe?.name)} />
              <Field suffix="점" value={e.points} onNum={(v) => updateEl(kind, i, j, { points: v })} strong {...fp(e.refs?.points, e.points, oe?.points)} />
              <CodesField codes={e.standards} onCodes={(c) => updateEl(kind, i, j, { standards: c })} {...fp(e.refs?.standards, e.standards, oe?.standards)} />
            </div>
            {more && kind === 'rubric' && (
              <Field label="채점기준" value={e.rubricText ?? ''} onText={(v) => updateEl(kind, i, j, { rubricText: v })} quiet {...fp(e.refs?.rubricText, e.rubricText, oe?.rubricText)} />
            )}
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
  quiet?: boolean;
  grow?: boolean;
  w?: string;
};

function Field({ id, label, value, suffix, onText, onNum, active, edited, onFocus, strong, quiet, grow, w = '' }: FieldProps) {
  return (
    <label
      className={`flex h-10 min-w-0 items-center gap-2 rounded-md px-2 transition-colors duration-150 ${grow ? 'flex-1' : ''} ${w} ${
        active ? 'bg-brand-blue-50 outline-dashed outline-2 -outline-offset-2 outline-brand-blue' : 'hover:bg-canvas'
      }`}
    >
      {label && <span className="shrink-0 text-help text-ink-3">{label}</span>}
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
        className={`min-w-0 flex-1 truncate bg-transparent text-body outline-none ${onNum ? 'text-right' : ''} ${
          strong ? 'font-extrabold' : quiet ? 'text-ink-2' : 'font-bold'
        } ${edited ? 'text-brand-blue' : quiet ? '' : 'text-ink'}`}
      />
      {suffix && <span className="shrink-0 text-help text-ink-3">{suffix}</span>}
      {edited && (
        <span className="shrink-0 text-brand-blue" title="교사 수정">
          {Icon.pen('h-4 w-4')}
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
      <Field value={draft ?? codes.join(' ')} onText={setDraft} strong {...rest} />
    </div>
  );
}
