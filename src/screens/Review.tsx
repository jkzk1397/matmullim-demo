import { useEffect, useMemo, useRef, useState } from 'react';
import { fillMerged } from '../domain/extract';
import { curriculumLabel, STANDARD_COUNT } from '../domain/standards';
import { packFor } from '../domain/rulepacks';
import type { Card, CellRef, ParsedDocument, ParsedTable, Severity } from '../domain/types';
import { counts, resolvedCards, sectionLabel, type Review as R } from '../domain/workspace';
import { SEVERITY, STRENGTH_BADGE } from '../ui/helpers';
import { Button, Dot, Icon } from '../ui/primitives';

type Props = {
  review: R;
  onQuickFix: (card: Card) => void;
  onEditCell: (ref: CellRef, text: string) => void;
  onMemo: (key: string, text: string | null) => void;
  onMap: () => void;
  onReport: () => void;
  onDownload: () => void;
  onBack?: () => void;
  backLabel?: string;
};

const ORDER: Severity[] = ['red', 'orange', 'gray', 'yellow'];
const SEV_BG: Record<Severity, string> = {
  red: 'bg-[#fdecef]',
  orange: 'bg-[#fff1e8]',
  gray: 'bg-[#f1f3f5]',
  yellow: 'bg-[#fff8db]',
};
const SEV_RING: Record<Severity, string> = {
  red: 'outline-sev-red',
  orange: 'outline-sev-orange',
  gray: 'outline-sev-gray',
  yellow: 'outline-sev-yellow',
};
const SEV_BADGE: Record<Severity, string> = {
  red: 'bg-sev-red',
  orange: 'bg-sev-orange',
  gray: 'bg-sev-gray',
  yellow: 'bg-sev-yellow',
};

const rk = (r: CellRef) => `${r.table}-${r.row}-${r.col}`;

/** 칸 위치를 사람이 읽는 말로: "평가의 종류와 반영비율 › 영역 만점(반영비율) › 프로그래밍" */
export function locLabel(doc: ParsedDocument, ref: CellRef): string {
  const t = doc.tables[ref.table];
  if (!t) return '';
  const g = fillMerged(t);
  const clean = (x: string) => (x ?? '').replace(/\s+/g, ' ').replace(/\((교육과정)\)\s*/g, '').trim();
  const head = g[0] ?? [];
  const mCol = head.findIndex((h) => /^월$/.test(clean(h)));
  const wCol = head.findIndex((h) => /^주$/.test(clean(h)));
  const parts: string[] = [];
  let title = clean(t.title).replace(/^[\d.)\]■□▶○●\s-]+/, '');
  if (/^\d{1,2}\s*월$/.test(title) || mCol >= 0) title = title && !/^\d{1,2}\s*월$/.test(title) ? title : '교수·학습 운영 계획';
  parts.push((title || `표 ${ref.table + 1}`).slice(0, 26));
  if (mCol >= 0 && ref.row > 0) {
    const m = clean(g[ref.row]?.[mCol] ?? ''), w = wCol >= 0 ? clean(g[ref.row]?.[wCol] ?? '') : '';
    if (m) parts.push(`${m}월${w ? ` ${w}주` : ''}`);
  } else if (ref.col > 0) {
    const rh = clean(g[ref.row]?.[0] ?? '');
    if (rh && !/^\d+$/.test(rh)) parts.push(rh.slice(0, 18));
  }
  if (ref.row > 0) {
    const ch = clean(head[ref.col] ?? '');
    if (ch && !parts.includes(ch)) parts.push(ch.slice(0, 18));
  }
  return parts.join(' › ');
}

export default function Review({ review, onQuickFix, onEditCell, onMemo, onMap, onReport, onDownload, onBack, backLabel }: Props) {
  const { result, doc, section, ex } = review;
  const cards = useMemo(() => [...result.cards].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity)), [result.cards]);
  const n = counts(review);
  const fixed = resolvedCards(review);
  const total = fixed.length + n.red + n.orange + n.gray;
  const [sel, setSel] = useState<string | null>(cards[0]?.key ?? null);
  const [flash, setFlash] = useState<string | null>(null);
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const docRef = useRef<HTMLDivElement>(null);
  const prevCounts = useRef(n);

  useEffect(() => {
    if (sel && !cards.some((c) => c.key === sel)) setSel(cards.find((c) => c.severity !== 'yellow')?.key ?? cards[0]?.key ?? null);
  }, [cards, sel]);

  // 고친 뒤 잠깐 알림
  useEffect(() => {
    const p = prevCounts.current;
    if (review.edits.length && (p.red !== n.red || p.orange !== n.orange || p.gray !== n.gray)) {
      const last = review.edits[review.edits.length - 1];
      setFlash(`‘${short(last.from)}’ → ‘${short(last.to)}’ 고치고 다시 점검했어요 · 확인된 오류 ${p.red} → ${n.red}`);
      const t = setTimeout(() => setFlash(null), 3500);
      prevCounts.current = n;
      return () => clearTimeout(t);
    }
    prevCounts.current = n;
  }, [review.edits.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const numbered = cards.map((c, i) => ({ c, no: i + 1 }));
  const byCell = new Map<string, { c: Card; no: number }[]>();
  for (const x of numbered) for (const l of x.c.emphasis?.length ? x.c.emphasis : x.c.locations) byCell.set(rk(l), [...(byCell.get(rk(l)) ?? []), x]);
  const editedCells = new Set(review.edits.map((e) => `${e.table}-${e.row}-${e.col}`));
  const selected = cards.find((c) => c.key === sel);
  const selCells = new Set((selected?.emphasis?.length ? selected.emphasis : selected?.locations ?? []).map(rk));

  const select = (key: string) => {
    setSel(key);
    const c = cards.find((x) => x.key === key);
    const l = c && (c.emphasis?.[0] ?? c.locations[0]);
    if (l) requestAnimationFrame(() => document.getElementById(`dv-${rk(l)}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const ctx = ex.context;
  const pack = packFor(ctx?.year);
  const visible = numbered.filter((x) => filter === 'all' || x.c.severity === filter);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 문서 머리 */}
      <div className="shrink-0 border-b border-line bg-paper">
        <div className="mx-auto flex w-[calc(100%-48px)] max-w-[1400px] items-center justify-between gap-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {onBack && (
              <button type="button" onClick={onBack} className="shrink-0 rounded-lg px-2 py-1 text-help font-bold text-brand-blue hover:bg-brand-blue-50">
                ← {backLabel ?? '전체 현황'}
              </button>
            )}
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-50 text-brand-blue">{Icon.doc('h-5 w-5')}</span>
            <div className="min-w-0">
              <div className="truncate text-key font-extrabold tracking-[-0.02em] text-ink">{ctx?.title?.replace(/\s+/g, ' ') || section.title || review.source.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-help text-ink-3">
                <Chip>{sectionLabel(review)}</Chip>
                {ctx?.curriculum && ctx.curriculum !== 'mixed' && <Chip tone="blue">{curriculumLabel(ctx.curriculum)} 교육과정</Chip>}
                {ctx?.curriculum === 'mixed' && <Chip tone="blue">2015·2022 개정 혼재</Chip>}
                {pack && <Chip tone="green">규칙팩 {pack.name}</Chip>}
                <span className="truncate">{review.source.name}</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={onMap}>
              {Icon.map()} 정렬 맵
            </Button>
            <Button onClick={onReport}>
              {Icon.print()} 점검 보고서
            </Button>
            <Button variant="primary" onClick={onDownload}>
              {Icon.download()} {review.source.kind === 'hwpx' ? '고친 파일 받기' : '수정 목록 받기'}
            </Button>
          </div>
        </div>
      </div>

      {/* 숫자 줄 */}
      <div className="shrink-0 border-b border-line bg-paper/60">
        <div className="mx-auto flex w-[calc(100%-48px)] max-w-[1400px] items-center gap-2 py-2">
          {(['red', 'orange', 'gray', 'yellow'] as Severity[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(filter === s ? 'all' : s)}
              aria-pressed={filter === s}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-help font-bold transition-colors ${filter === s ? 'bg-paper shadow-[inset_0_0_0_1.5px_#0d2b57]' : 'hover:bg-paper'} ${SEVERITY[s].text}`}
            >
              <Dot s={s} />
              {SEVERITY[s].label}
              <span className="text-key font-extrabold">{n[s]}</span>
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-help font-bold text-ink-2">
              고친 항목 <span className="text-brand-green">{fixed.length}</span> / {total}
            </span>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-brand-green transition-all duration-500" style={{ width: `${total ? (fixed.length / total) * 100 : 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* 왼쪽: 문서 */}
        <div ref={docRef} className="min-w-0 flex-1 overflow-auto bg-[#eef1f5] px-8 py-6">
          <article className="mx-auto max-w-[860px] rounded-sm bg-paper px-10 py-9 shadow-[0_2px_10px_rgba(13,43,87,0.10)]">
            {doc.tables.slice(section.from, section.to).map((t, k) => {
              const ti = section.from + k;
              if (!t.rows.length || t.rows.every((r) => r.every((c) => !c))) return null;
              return (
                <DocTableView
                  key={ti}
                  table={t}
                  index={ti}
                  byCell={byCell}
                  edited={editedCells}
                  selCells={selCells}
                  highlights={selected ? [...(selected.highlights ?? []), selected.replace?.from ?? ''].filter(Boolean) : []}
                  onPick={(key) => select(key)}
                  onEdit={onEditCell}
                />
              );
            })}
          </article>
        </div>

        {/* 오른쪽: 지적 목록 */}
        <aside className="flex w-[460px] shrink-0 flex-col border-l border-line bg-paper">
          <div className="min-h-0 flex-1 overflow-auto">
            {!cards.filter((c) => c.severity !== 'yellow').length && (
              <div className="m-5 rounded-xl bg-brand-green-50 p-5">
                <div className="flex items-center gap-2 text-key font-extrabold text-brand-green">{Icon.check('h-6 w-6')} 확인된 오류가 없어요</div>
                <p className="mt-1 text-help text-ink-2">점검한 {result.passed.length}가지 항목을 모두 통과했어요.</p>
              </div>
            )}
            <ol>
              {visible.map(({ c, no }) => (
                <IssueItem
                  key={c.key}
                  card={c}
                  no={no}
                  doc={doc}
                  open={c.key === sel}
                  memo={review.memos[c.key]}
                  onOpen={() => select(c.key)}
                  onQuickFix={() => onQuickFix(c)}
                  onMemo={(t) => onMemo(c.key, t)}
                />
              ))}
            </ol>
            {fixed.length > 0 && (
              <div className="border-t border-line px-5 py-4">
                <div className="mb-2 text-help font-bold text-ink-3">고친 항목 {fixed.length}</div>
                <ul className="space-y-1.5">
                  {fixed.map((c) => (
                    <li key={c.key} className="flex items-start gap-2 text-help text-ink-3">
                      <span className="mt-0.5 text-brand-green">{Icon.check('h-4 w-4')}</span>
                      <span className="line-through decoration-ink-3/50">{c.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.passed.length > 0 && (
              <div className="border-t border-line px-5 py-4">
                <div className="mb-2 text-help font-bold text-ink-3">통과한 점검 {result.passed.length}</div>
                <ul className="space-y-1">
                  {result.passed.map((p) => (
                    <li key={p.label} className="flex items-start gap-2 text-help text-ink-2">
                      <span className="mt-0.5 text-brand-green">{Icon.check('h-4 w-4')}</span>
                      <span>
                        <b className="font-bold">{p.label}</b> · {p.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="shrink-0 border-t border-line bg-canvas px-5 py-2.5 text-help text-ink-3">
            성취기준 {STANDARD_COUNT['2015'] + STANDARD_COUNT['2022']}개(2015·2022 개정 중학교 전 교과){pack ? ` · ${pack.source}` : ''}
          </div>
        </aside>

        {flash && (
          <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-xl bg-brand-navy px-5 py-3 text-help font-bold text-white shadow-lg">
            <span className="mr-2 text-[#8ce99a]">{Icon.check('inline h-4 w-4')}</span>
            {flash}
          </div>
        )}
      </div>
    </div>
  );
}

const short = (s: string) => (s.length > 26 ? `${s.slice(0, 24)}…` : s);

function Chip({ children, tone }: { children: React.ReactNode; tone?: 'blue' | 'green' }) {
  const cls = tone === 'blue' ? 'bg-brand-blue-50 text-brand-blue' : tone === 'green' ? 'bg-brand-green-50 text-brand-green' : 'bg-canvas text-ink-2';
  return <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-help font-bold ${cls}`}>{children}</span>;
}

function IssueItem({
  card,
  no,
  doc,
  open,
  memo,
  onOpen,
  onQuickFix,
  onMemo,
}: {
  card: Card;
  no: number;
  doc: ParsedDocument;
  open: boolean;
  memo?: string;
  onOpen: () => void;
  onQuickFix: () => void;
  onMemo: (t: string | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const loc = card.locations[0] ? locLabel(doc, card.emphasis?.[0] ?? card.locations[0]) : '';
  return (
    <li className={`border-b border-line ${open ? 'bg-[#f8fafc]' : ''}`}>
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-canvas">
        <span className={`mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-help font-extrabold text-white ${SEV_BADGE[card.severity]}`}>{no}</span>
        <span className="min-w-0 flex-1">
          <span className={`block text-help font-bold ${SEVERITY[card.severity].text}`}>
            {SEVERITY[card.severity].label} · {STRENGTH_BADGE[card.strength]}
            {memo !== undefined && <span className="ml-2 rounded bg-canvas px-1.5 text-ink-3">메모함</span>}
          </span>
          <span className="mt-0.5 block text-body font-bold leading-snug text-ink">{card.title}</span>
          {loc && <span className="mt-0.5 block truncate text-help text-ink-3">{loc}</span>}
        </span>
      </button>
      {open && (
        <div className="space-y-3 px-5 pb-4 pl-14">
          <div className="whitespace-pre-line rounded-lg bg-paper px-3 py-2 text-help text-ink-2 shadow-[inset_0_0_0_1px_#e3e7ed]">{card.quote}</div>
          <div className="rounded-lg border-l-4 border-brand-navy bg-brand-blue-50 px-3 py-2">
            <div className="text-help font-bold text-brand-navy">
              근거 · {card.basis.source}
              {card.basis.page && <span className="font-medium text-ink-2"> · {card.basis.page}</span>}
            </div>
            {card.basis.text && <p className="mt-1 text-help text-ink">“{card.basis.text}”</p>}
            {card.basis.url && (
              <a href={card.basis.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-help font-bold text-brand-blue hover:underline">
                원문 열기 {Icon.link()}
              </a>
            )}
          </div>
          {card.fix && (
            <p className="text-help text-ink">
              <b className="font-bold text-brand-navy">고치는 법</b> · {card.fix}
            </p>
          )}
          {card.note && <p className="text-help text-ink-3">{card.note}</p>}
          {draft !== null ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="넘기는 이유를 적어 두세요 (예: 학교 규정에 따름)"
                className="h-20 w-full resize-none rounded-lg border border-line px-3 py-2 text-help outline-none focus:border-brand-blue"
              />
              <div className="flex justify-end gap-2">
                <Button onClick={() => setDraft(null)}>취소</Button>
                <Button variant="primary" onClick={() => { onMemo(draft); setDraft(null); }}>
                  메모 저장
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {card.replace && (
                <Button variant="primary" onClick={onQuickFix}>
                  {Icon.wand()} 바로 고치기
                </Button>
              )}
              <Button onClick={() => setDraft(memo ?? '')}>{memo !== undefined ? '메모 고치기' : '메모하고 넘기기'}</Button>
              {memo !== undefined && (
                <Button variant="quiet" onClick={() => onMemo(null)}>
                  메모 지우기
                </Button>
              )}
              {!card.replace && card.actions.includes('fix') && <span className="text-help text-ink-3">문서의 칸을 두 번 눌러 직접 고칠 수 있어요</span>}
            </div>
          )}
          {card.replace && (
            <div className="rounded-lg bg-canvas px-3 py-2 text-help text-ink-2">
              <span className="font-bold text-ink-3">바뀌는 내용 </span>
              <span className="text-sev-red line-through">{short(card.replace.from)}</span>
              <span className="mx-1">→</span>
              <span className="font-bold text-brand-green">{short(card.replace.to)}</span>
            </div>
          )}
          {memo && <p className="rounded-lg bg-canvas px-3 py-2 text-help text-ink-2">메모: {memo}</p>}
        </div>
      )}
    </li>
  );
}

function DocTableView({
  table,
  index,
  byCell,
  edited,
  selCells,
  highlights,
  onPick,
  onEdit,
}: {
  table: ParsedTable;
  index: number;
  byCell: Map<string, { c: Card; no: number }[]>;
  edited: Set<string>;
  selCells: Set<string>;
  highlights: string[];
  onPick: (key: string) => void;
  onEdit: (ref: CellRef, text: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const covered = new Set<string>();
  const spanAt = new Map<string, { rowSpan: number; colSpan: number }>();
  for (const s of table.spans) {
    spanAt.set(`${s.row},${s.col}`, s);
    for (let r = s.row; r < s.row + s.rowSpan; r++) for (let c = s.col; c < s.col + s.colSpan; c++) if (r !== s.row || c !== s.col) covered.add(`${r},${c}`);
  }
  const filled = table.rows.flat().filter((x) => x && x.trim());
  if (filled.length <= 2 && filled.join(' ').length < 140) {
    return (
      <section className="mb-5">
        {filled.map((x, i) => (
          <div key={i} className={i === 0 ? 'text-center text-[17px] font-extrabold leading-snug text-ink' : 'mt-1 text-center text-[13px] text-ink-2'}>
            {x.replace(/\s+/g, ' ')}
          </div>
        ))}
      </section>
    );
  }
  const width = table.rows[0]?.length ?? 1;
  const headCol = table.rows.length > 2 && table.rows.every((r) => r[0] !== undefined) && /만점|반영|평가|영역|성취기준|요소/.test(table.rows.map((r) => r[0]).join(' '));
  return (
    <section className="mb-6">
      {table.title && <h3 className="mb-1.5 text-help font-bold text-ink-2">{table.title.replace(/\s+/g, ' ').slice(0, 80)}</h3>}
      <table className="w-full border-collapse text-[13px] leading-[1.55] text-ink" style={{ fontFamily: '"Pretendard Variable", Pretendard, serif' }}>
        <colgroup>
          {Array.from({ length: width }, (_, i) => (
            <col key={i} style={{ width: headCol && i === 0 ? '15%' : undefined, minWidth: 48 }} />
          ))}
        </colgroup>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((text, c) => {
                if (covered.has(`${r},${c}`)) return null;
                const sp = spanAt.get(`${r},${c}`);
                const key = `${index}-${r}-${c}`;
                const issues = byCell.get(key);
                const top = issues?.[0];
                const isSel = selCells.has(key);
                const isEdited = edited.has(key);
                const isHead = r === 0 || (headCol && c === 0);
                const ref: CellRef = { doc: 'plan', table: index, row: r, col: c };
                return (
                  <td
                    key={c}
                    id={`dv-${key}`}
                    rowSpan={sp?.rowSpan}
                    colSpan={sp?.colSpan}
                    onClick={top ? () => onPick(top.c.key) : undefined}
                    onDoubleClick={() => { setEditing(key); setDraft(text); }}
                    className={`relative border border-[#9aa3ad] px-1.5 py-1 align-middle ${isHead ? 'bg-[#f1f3f5] text-center font-bold' : ''} ${
                      top ? `${SEV_BG[top.c.severity]} cursor-pointer` : ''
                    } ${isEdited && !top ? 'bg-brand-green-50' : ''} ${isSel ? `outline outline-[2.5px] -outline-offset-2 ${SEV_RING[top?.c.severity ?? 'red']}` : ''}`}
                  >
                    {top && (
                      <span className="absolute -right-2 -top-2 z-10 flex gap-0.5">
                        {issues!.slice(0, 3).map((x) => (
                          <span key={x.no} className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-extrabold text-white shadow ${SEV_BADGE[x.c.severity]}`}>
                            {x.no}
                          </span>
                        ))}
                      </span>
                    )}
                    {isEdited && <span className="absolute -left-1.5 -top-2 z-10 rounded bg-brand-green px-1 text-[10px] font-bold text-white">고침</span>}
                    {editing === key ? (
                      <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className="h-24 w-full min-w-[160px] resize-y rounded border border-brand-blue px-1 py-0.5 text-[13px] outline-none"
                        />
                        <div className="flex justify-end gap-1">
                          <button type="button" className="rounded px-2 py-0.5 text-[12px] text-ink-2 hover:bg-canvas" onClick={() => setEditing(null)}>
                            취소
                          </button>
                          <button
                            type="button"
                            className="rounded bg-brand-navy px-2 py-0.5 text-[12px] font-bold text-white"
                            onClick={() => { onEdit(ref, draft); setEditing(null); }}
                          >
                            고치고 다시 점검
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="whitespace-pre-line break-words">
                        <Highlight text={text} marks={isSel ? highlights : []} />
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Highlight({ text, marks }: { text: string; marks: string[] }) {
  const list = marks.filter((m) => m && text.includes(m));
  if (!list.length) return <>{text}</>;
  const esc = list.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${esc.join('|')})`, 'g'));
  return (
    <>
      {parts.map((p, i) =>
        list.includes(p) ? (
          <mark key={i} className="rounded-sm bg-[#ffe066] px-0.5 text-ink [box-decoration-break:clone]">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
