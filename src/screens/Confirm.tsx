import { useEffect, useState } from 'react';
import { extractCodes } from '../domain/standards';
import type { Assessment, CellRef, DocKind, Element, Extraction } from '../domain/types';
import { DOC_NAME, formatDuration, sameRef, type Docs } from '../ui/helpers';
import { DocTable, PageHead } from '../ui/layout';
import { Button, Icon } from '../ui/primitives';

type Props = {
  docs: Docs;
  ex: Extraction;
  pairs: Record<string, string | null>;
  startedAt: number;
  focus: CellRef | null;
  onFocus: (r: CellRef | null) => void;
  onChange: (ex: Extraction) => void;
  onPair: (rubricId: string, planId: string | null) => void;
  onSubmit: () => void;
};

export default function Confirm({ docs, ex, pairs, startedAt, focus, onFocus, onChange, onPair, onSubmit }: Props) {
  const [tab, setTab] = useState<DocKind>(focus?.doc ?? 'plan');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!focus) return;
    setTab(focus.doc);
    requestAnimationFrame(() =>
      document.getElementById(`cell-${focus.doc}-${focus.table}-${focus.row}-${focus.col}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    );
  }, [focus]);

  const update = (kind: 'plan' | 'rubric', i: number, patch: Partial<Assessment>) =>
    onChange({ ...ex, [kind]: ex[kind].map((a, k) => (k === i ? { ...a, ...patch } : a)) });
  const updateEl = (kind: 'plan' | 'rubric', i: number, j: number, patch: Partial<Element>) =>
    update(kind, i, { elements: ex[kind][i].elements.map((e, k) => (k === j ? { ...e, ...patch } : e)) });

  const fieldProps = (ref: CellRef | undefined) => ({ active: sameRef(focus, ref), onFocus: () => onFocus(ref ?? null) });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHead
        title="추출한 값을 원문과 대조해 확인해 주세요"
        sub={`평가계획 평가 ${ex.plan.length}개 · 채점기준표 평가 ${ex.rubric.length}개 · 학기 성취기준 ${ex.planStandards.length}개를 읽었어요. 값을 누르면 왼쪽 원문 칸이 표시돼요.`}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] gap-6 px-8">
        {/* 왼쪽: 원문 */}
        <section className="flex min-h-0 flex-col rounded-xl border border-line">
          <div className="flex shrink-0 items-center gap-1 border-b border-line px-3 pt-2">
            {(['plan', 'rubric'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1.5 text-[14px] ${
                  tab === k ? 'border-accent font-semibold text-ink' : 'border-transparent text-ink-3 hover:text-ink'
                }`}
              >
                {Icon.file('h-4 w-4')}
                {DOC_NAME[k]} <span className="text-meta font-normal text-ink-4">{docs[k].fileName}</span>
              </button>
            ))}
            <span className="ml-auto pb-2 text-meta text-ink-4">원문</span>
          </div>
          <div className="scroll-thin min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <div className="text-[14px] font-semibold text-ink">{docs[tab].title}</div>
            {docs[tab].tables.map((t, i) => (
              <DocTable key={i} table={t} index={i} doc={tab} highlight={focus} onCell={(r) => onFocus(r)} compact />
            ))}
          </div>
        </section>

        {/* 오른쪽: 추출값 */}
        <section className="scroll-thin flex min-h-0 flex-col overflow-y-auto rounded-xl border border-line">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-3">
            <span className="text-[14px] font-semibold">점검에 쓰는 값</span>
            <span className="text-meta text-ink-3">고친 값으로 점검해요 · 만점·배점·반영비율은 따로 다뤄요</span>
          </div>
          <div className="space-y-6 px-5 py-5">
            <div>
              <SectionTitle>같은 평가 짝짓기</SectionTitle>
              <div className="overflow-hidden rounded-lg border border-line">
                {ex.rubric.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 border-b border-line-2 px-4 py-2.5 last:border-0">
                    <span className="w-24 shrink-0 text-meta text-ink-3">채점기준표</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                    <span className="text-ink-4">{Icon.arrow()}</span>
                    <span className="w-20 shrink-0 text-right text-meta text-ink-3">평가계획</span>
                    <select
                      value={pairs[r.id] ?? ''}
                      onChange={(e) => onPair(r.id, e.target.value || null)}
                      className="h-9 w-56 rounded-lg border border-line bg-white px-2.5 text-[14px] font-semibold text-ink focus:border-accent focus:outline-none"
                    >
                      <option value="">짝 없음</option>
                      {ex.plan.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle>평가계획서</SectionTitle>
              <div className="space-y-3">
                {ex.plan.map((a, i) => (
                  <div key={a.id} className="rounded-lg border border-line">
                    <div className="grid grid-cols-[1fr_64px_128px_128px] items-center gap-2 border-b border-line-2 bg-canvas/60 px-3 py-2">
                      <Field label="평가명" value={a.name} onText={(v) => update('plan', i, { name: v })} {...fieldProps(a.source)} strong />
                      <span className="text-center text-meta text-ink-3">{a.method}</span>
                      <Field label="반영비율" suffix="%" value={a.weightPercent} onNum={(v) => update('plan', i, { weightPercent: v })} {...fieldProps(a.refs?.weightPercent)} />
                      <Field label="만점" suffix="점" value={a.maxScore} onNum={(v) => update('plan', i, { maxScore: v })} {...fieldProps(a.refs?.maxScore)} />
                    </div>
                    <ElementRows kind="plan" a={a} i={i} updateEl={updateEl} fieldProps={fieldProps} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle>채점기준표</SectionTitle>
              <div className="space-y-3">
                {ex.rubric.map((a, i) => (
                  <div key={a.id} className="rounded-lg border border-line">
                    <div className="border-b border-line-2 bg-canvas/60 px-3 py-2">
                      <Field label="평가명" value={a.name} onText={(v) => update('rubric', i, { name: v })} {...fieldProps(a.source)} strong />
                    </div>
                    <ElementRows kind="rubric" a={a} i={i} updateEl={updateEl} fieldProps={fieldProps} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle>학기 성취기준 (평가계획서)</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {ex.planStandards.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => onFocus(s.ref)}
                    className={`rounded-md border px-2.5 py-1 text-[14px] ${sameRef(focus, s.ref) ? 'border-accent bg-accent-50 text-accent' : 'border-line text-ink-2 hover:border-ink-4'}`}
                  >
                    {s.code}
                  </button>
                ))}
              </div>
            </div>
            {ex.warnings.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-canvas px-4 py-3 text-meta text-ink-2">
                {ex.warnings.map((w) => (
                  <li key={w}>· {w}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="mt-5 flex h-[76px] shrink-0 items-center justify-between border-t border-line bg-white px-8">
        <p className="text-meta text-ink-3">
          표를 잘못 읽었을 수 있어서, 교사가 확인한 값만 점검에 써요. 같은 값을 넣으면 언제나 같은 결과가 나와요.
        </p>
        <div className="flex items-center gap-5">
          <span className="text-meta text-ink-3">
            확인 시간 <b className="ml-1 text-body font-semibold text-ink">{formatDuration(now - startedAt)}</b>
          </span>
          <Button variant="primary" size="lg" onClick={onSubmit}>
            확인하고 점검 {Icon.arrow()}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2.5 text-[14px] font-semibold text-ink-2">{children}</h3>;
}

type FP = (ref: CellRef | undefined) => { active: boolean; onFocus: () => void };

function ElementRows({
  kind,
  a,
  i,
  updateEl,
  fieldProps,
}: {
  kind: 'plan' | 'rubric';
  a: Assessment;
  i: number;
  updateEl: (k: 'plan' | 'rubric', i: number, j: number, p: Partial<Element>) => void;
  fieldProps: FP;
}) {
  const cols = kind === 'plan' ? 'grid-cols-[1fr_88px_1fr]' : 'grid-cols-[1fr_88px_1fr_1.35fr]';
  return (
    <div className="px-3 py-2">
      <div className={`grid ${cols} gap-2 px-1 pb-1 text-[12px] text-ink-4`}>
        <span>평가요소</span>
        <span>배점</span>
        <span>성취기준 코드</span>
        {kind === 'rubric' && <span>채점기준</span>}
      </div>
      {a.elements.map((e, j) => (
        <div key={j} className={`grid ${cols} items-start gap-2`}>
          <Field value={e.name} onText={(v) => updateEl(kind, i, j, { name: v })} {...fieldProps(e.refs?.name)} />
          <Field suffix="점" value={e.points} onNum={(v) => updateEl(kind, i, j, { points: v })} {...fieldProps(e.refs?.points)} />
          <CodesField codes={e.standards} onCodes={(c) => updateEl(kind, i, j, { standards: c })} {...fieldProps(e.refs?.standards)} />
          {kind === 'rubric' && (
            <Field value={e.rubricText ?? ''} onText={(v) => updateEl(kind, i, j, { rubricText: v })} {...fieldProps(e.refs?.rubricText)} />
          )}
        </div>
      ))}
    </div>
  );
}

type FieldProps = {
  label?: string;
  value: string | number | undefined;
  suffix?: string;
  onText?: (v: string) => void;
  onNum?: (v: number | undefined) => void;
  active: boolean;
  onFocus: () => void;
  strong?: boolean;
};

function Field({ label, value, suffix, onText, onNum, active, onFocus, strong }: FieldProps) {
  return (
    <label
      className={`flex h-9 min-w-0 items-center gap-1 rounded-md border px-2 transition-colors ${
        active ? 'border-accent bg-accent-50 ring-2 ring-accent/20' : 'border-transparent hover:border-line hover:bg-white'
      }`}
    >
      {label && <span className="shrink-0 text-[12px] text-ink-4">{label}</span>}
      <input
        value={value ?? ''}
        onFocus={onFocus}
        onClick={onFocus}
        inputMode={onNum ? 'numeric' : undefined}
        onChange={(e) => {
          if (onNum) {
            const v = e.target.value.replace(/[^\d.]/g, '');
            onNum(v === '' ? undefined : Number(v));
          } else onText?.(e.target.value);
        }}
        className={`min-w-0 flex-1 truncate bg-transparent text-[14px] outline-none ${onNum ? 'text-right' : ''} ${strong ? 'font-semibold' : ''}`}
      />
      {suffix && <span className="shrink-0 text-[13px] text-ink-3">{suffix}</span>}
    </label>
  );
}

function CodesField({ codes, onCodes, active, onFocus }: { codes: string[]; onCodes: (c: string[]) => void; active: boolean; onFocus: () => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  // 입력을 마치면(blur) 글자를 성취기준 코드로 다시 읽는다
  return (
    <div
      className="min-w-0"
      onBlur={() => {
        if (draft !== null) onCodes(extractCodes(draft));
        setDraft(null);
      }}
    >
      <Field value={draft ?? codes.join(' ')} onText={setDraft} active={active} onFocus={onFocus} />
    </div>
  );
}
