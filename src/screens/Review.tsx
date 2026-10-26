import { useEffect, useMemo, useRef, useState } from 'react';
import { curriculumLabel, STANDARD_COUNT } from '../domain/standards';
import { packFor } from '../domain/rulepacks';
import type { Card, CellRef, ParsedDocument, ParsedTable, Severity } from '../domain/types';
import { counts, resolvedCards, sectionLabel, type Review as R } from '../domain/workspace';
import { SEVERITY } from '../ui/helpers';
import { Button, Dot, Icon } from '../ui/primitives';
import { cellsOf, isInsertCard, J14_EXAMPLE, J14_PLACE, kindLabel } from './cardInfo';
import { locLabel } from './locLabel';

export { locLabel };

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

const HINT_KEY = 'matmullim.editHint.dismissed';
const readHint = () => {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
};

export default function Review({ review, onQuickFix, onEditCell, onMemo, onMap, onReport, onDownload, onBack, backLabel }: Props) {
  const { result, doc, section, ex } = review;
  const cards = useMemo(() => [...result.cards].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity)), [result.cards]);
  const n = counts(review);
  const fixed = resolvedCards(review);
  const total = fixed.length + n.red + n.orange + n.gray;
  const [sel, setSel] = useState<string | null>(cards[0]?.key ?? null);
  const [flash, setFlash] = useState<{ text: string; extra?: string } | null>(null);
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const [hintOff, setHintOff] = useState(readHint);
  const docRef = useRef<HTMLDivElement>(null);
  const prevCounts = useRef(n);
  const prevKeys = useRef(new Set(result.cards.map((c) => c.key)));

  useEffect(() => {
    if (sel && !cards.some((c) => c.key === sel)) setSel(cards.find((c) => c.severity !== 'yellow')?.key ?? cards[0]?.key ?? null);
  }, [cards, sel]);

  // 고친 뒤 알림 (3초)
  useEffect(() => {
    const p = prevCounts.current;
    const before = prevKeys.current;
    prevCounts.current = n;
    prevKeys.current = new Set(result.cards.map((c) => c.key));
    if (!review.edits.length) return;
    const last = review.edits[review.edits.length - 1];
    const added = result.cards.filter((c) => !before.has(c.key) && c.severity !== 'yellow');
    const extra = added.length
      ? added.every((c) => c.rule === 'J6')
        ? `새로 보이는 항목 ${added.length}건 (고친 코드가 인식돼 연결 점검에 들어갔어요)`
        : `새 확인 항목 ${added.length}건`
      : undefined;
    setFlash({ text: `‘${short(last.from)}’ → ‘${short(last.to)}’ 고치고 다시 점검했어요 · 확인된 오류 ${p.red} → ${n.red}`, extra });
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [review.edits.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const numbered = cards.map((c, i) => ({ c, no: i + 1 }));
  const byCell = new Map<string, { c: Card; no: number }[]>();
  for (const x of numbered)
    for (const l of cellsOf(x.c)) {
      const list = byCell.get(rk(l)) ?? [];
      if (!list.some((y) => y.no === x.no)) byCell.set(rk(l), [...list, x]);
    }
  const editedCells = new Set(review.edits.map((e) => `${e.table}-${e.row}-${e.col}`));
  const selected = cards.find((c) => c.key === sel);
  const selCells = new Set((selected ? cellsOf(selected) : []).map(rk));
  const insertAfter = selected && isInsertCard(selected) ? selected.locations[0]?.table : undefined;

  /** 칸을 문서 가운데로: 화면 밖이면 바로, 안이면 부드럽게. 그다음 잠깐 깜빡 */
  const reveal = (c: Card | undefined) => {
    if (!c) return;
    const box = docRef.current;
    const l = cellsOf(c)[0];
    const el = l ? document.getElementById(`dv-${rk(l)}`) : isInsertCard(c) && c.locations[0] ? document.getElementById(`dvt-${c.locations[0].table}`) : null;
    if (!el || !box) return;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const off = r.bottom < b.top || r.top > b.bottom;
    el.scrollIntoView({ behavior: off ? 'auto' : 'smooth', block: isInsertCard(c) ? 'end' : 'center', inline: 'nearest' });
    if (!l) return;
    for (const x of cellsOf(c)) {
      const cell = document.getElementById(`dv-${rk(x)}`);
      if (!cell) continue;
      cell.classList.remove('cell-pulse');
      void cell.offsetWidth;
      cell.classList.add('cell-pulse');
      setTimeout(() => cell.classList.remove('cell-pulse'), 1300);
    }
  };

  const select = (key: string) => {
    setSel(key);
    const c = cards.find((x) => x.key === key);
    requestAnimationFrame(() => requestAnimationFrame(() => reveal(c)));
  };

  // 처음 열 때 첫 항목 칸으로
  useEffect(() => {
    const c = cards.find((x) => x.key === sel);
    const id = requestAnimationFrame(() => reveal(c));
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissHint = () => {
    setHintOff(true);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* 저장 못 해도 이번 화면에서는 숨김 */
    }
  };

  const ctx = ex.context;
  const pack = packFor(ctx?.year);
  const noPlan = ex.plan.length === 0;
  const packNote = pack ? null : ctx?.year === undefined ? '학년도를 찾지 못해 경기 2026 지침 점검은 건너뛰었어요' : `${ctx.year}학년도 지침 규칙은 아직 없어요`;
  const visible = numbered.filter((x) => filter === 'all' || x.c.severity === filter);
  const title = (ctx?.title || section.title || review.source.name).replace(/\s+/g, ' ');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 문서 머리: 왼쪽은 문서 폭에 맞추고, 오른쪽은 목록 폭에 맞춘다 */}
      <div className="flex shrink-0 border-b border-line bg-paper">
        <div className="min-w-0 flex-1 px-8">
          <div className="mx-auto flex max-w-[1240px] items-center gap-3 py-3">
            {onBack && (
              <button type="button" onClick={onBack} className="shrink-0 rounded-lg px-2 py-1 text-help font-bold text-brand-blue hover:bg-brand-blue-50">
                ← {backLabel ?? '전체 현황'}
              </button>
            )}
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-50 text-brand-blue">{Icon.doc('h-5 w-5')}</span>
            <div className="min-w-0">
              <div className="truncate text-key font-extrabold tracking-[-0.02em] text-ink" title={title}>
                {title}
              </div>
              <div className="mt-0.5 flex min-w-0 items-center gap-2 text-help text-ink-3">
                <Chip>{sectionLabel(review)}</Chip>
                {ctx?.curriculum && ctx.curriculum !== 'mixed' && <Chip tone="blue">{curriculumLabel(ctx.curriculum)} 교육과정</Chip>}
                {ctx?.curriculum === 'mixed' && <Chip tone="blue">2015·2022 개정 혼재</Chip>}
                {pack && <Chip tone="green">규칙팩 {pack.name}</Chip>}
                <span className="truncate">{review.source.name}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex w-[460px] shrink-0 items-center justify-end gap-2 px-5">
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

      {/* 숫자 줄 */}
      <div className="flex shrink-0 border-b border-line bg-paper/60">
        <div className="min-w-0 flex-1 px-8">
          <div className="mx-auto flex max-w-[1240px] items-center gap-2 py-2">
            {(['red', 'orange', 'gray', 'yellow'] as Severity[]).map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(filter === s ? 'all' : s)}
                aria-pressed={filter === s}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-help font-bold transition-colors ${i === 0 ? '-ml-3' : ''} ${
                  filter === s ? 'bg-paper shadow-[inset_0_0_0_1.5px_#0d2b57]' : 'hover:bg-paper'
                } ${SEVERITY[s].text}`}
              >
                <Dot s={s} />
                {SEVERITY[s].label}
                <span className="text-key font-extrabold">{n[s]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex w-[460px] shrink-0 items-center justify-end gap-3 px-5">
          <span className="text-help font-bold text-ink-2">
            고친 항목 <span className="text-brand-green">{fixed.length}</span> / {total}
          </span>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand-green transition-all duration-500" style={{ width: `${total ? (fixed.length / total) * 100 : noPlan ? 0 : 100}%` }} />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 왼쪽: 문서 */}
        <div className="relative min-w-0 flex-1">
          <div ref={docRef} className="h-full overflow-auto bg-[#eef1f5] px-8 py-6">
            {!hintOff && !review.edits.length && (
              <div className="mx-auto mb-3 flex max-w-[1240px] items-center gap-2 rounded-lg bg-paper px-4 py-2 text-help text-ink-2 shadow-card">
                <span className="text-brand-blue">{Icon.pen('h-4 w-4')}</span>
                <span className="flex-1">칸을 두 번 누르면 바로 고칠 수 있어요</span>
                <button type="button" onClick={dismissHint} className="rounded px-2 py-0.5 font-bold text-ink-3 hover:bg-canvas hover:text-ink">
                  닫기
                </button>
              </div>
            )}
            <article className="mx-auto max-w-[1240px] rounded-sm bg-paper px-10 py-9 shadow-[0_2px_10px_rgba(13,43,87,0.10)]">
              {doc.tables.slice(section.from, section.to).map((t, k) => {
                const ti = section.from + k;
                if (!t.rows.length || t.rows.every((r) => r.every((c) => !c))) return null;
                return (
                  <div key={ti} id={`dvt-${ti}`}>
                    <DocTableView
                      table={t}
                      index={ti}
                      byCell={byCell}
                      edited={editedCells}
                      selCells={selCells}
                      highlights={selected ? [...(selected.highlights ?? []), selected.replace?.from ?? ''].filter(Boolean) : []}
                      onPick={(key) => select(key)}
                      onEdit={onEditCell}
                    />
                    {insertAfter === ti && (
                      <div className="-mt-3 mb-6 rounded-md border-2 border-dashed border-sev-gray bg-[#f1f3f5] px-3 py-2 text-[13px] font-bold text-ink-2">
                        여기에 결시자 처리기준 문장을 넣으세요
                      </div>
                    )}
                  </div>
                );
              })}
            </article>
          </div>
          {flash && (
            <div
              role="status"
              className="pointer-events-none absolute left-1/2 top-4 z-20 max-w-[min(820px,calc(100%-48px))] -translate-x-1/2 rounded-xl bg-[#0a2246] px-6 py-3.5 text-body font-bold text-white shadow-[0_8px_24px_rgba(13,43,87,0.35)]"
            >
              <span className="mr-2 text-[#8ce99a]">{Icon.check('inline h-5 w-5 align-[-3px]')}</span>
              {flash.text}
              {flash.extra && <span className="text-[#ffd8a8]"> · {flash.extra}</span>}
            </div>
          )}
        </div>

        {/* 오른쪽: 지적 목록 */}
        <aside className="flex w-[460px] shrink-0 flex-col border-l border-line bg-paper">
          <div className="min-h-0 flex-1 overflow-auto">
            {noPlan && (
              <div className="m-5 mb-0 rounded-xl bg-[#f4f1e8] p-4 text-help text-ink shadow-[inset_0_0_0_1px_#e6dcbf]">
                <div className="font-bold text-[#7a5d00]">숫자 점검을 못 했어요</div>
                <p className="mt-1">이 계획서에서 평가 요약표(평가 종류·반영비율)를 읽지 못해 숫자 점검은 못 했어요. 성취기준 코드만 점검했어요.</p>
              </div>
            )}
            {packNote && <p className="mx-5 mt-4 text-help text-ink-3">{packNote}</p>}
            {!noPlan && !cards.filter((c) => c.severity !== 'yellow').length && (
              <div className="m-5 rounded-xl bg-brand-green-50 p-5">
                <div className="flex items-center gap-2 text-key font-extrabold text-brand-green">{Icon.check('h-6 w-6')} 확인된 오류가 없어요</div>
                <p className="mt-1 text-help text-ink-2">점검한 {result.passed.length}가지 항목을 모두 통과했어요.</p>
              </div>
            )}
            {(noPlan || packNote) && <div className="h-3" />}
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
                  {result.passed.map((p, i) => (
                    <li key={`${p.rule}-${i}`} className="flex items-start gap-2 text-help text-ink-2">
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
  const [copied, setCopied] = useState(false);
  const insert = isInsertCard(card);
  const loc = insert ? `넣을 곳: ${J14_PLACE}` : card.locations[0] ? locLabel(doc, card.emphasis?.[0] ?? card.locations[0]) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(J14_EXAMPLE);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = J14_EXAMPLE;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* 복사 못 하면 직접 고르기 */
      }
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <li className={`border-b border-line ${open ? 'bg-[#f8fafc]' : ''}`}>
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-canvas">
        <span className={`mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-help font-extrabold text-white ${SEV_BADGE[card.severity]}`}>{no}</span>
        <span className="min-w-0 flex-1">
          <span className={`block text-help font-bold ${SEVERITY[card.severity].text}`}>
            {kindLabel(card)}
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
            {card.basis.text &&
              (card.basis.quoted ? (
                <p className="mt-1 text-help text-ink">“{card.basis.text}”</p>
              ) : (
                <p className="mt-1 text-help text-ink">
                  <b className="font-bold text-ink-2">판단 기준</b> · {card.basis.text}
                </p>
              ))}
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
          {insert && (
            <div className="rounded-lg bg-paper px-3 py-2.5 shadow-[inset_0_0_0_1px_#e3e7ed]">
              <div className="text-help font-bold text-ink-3">예시 문장 — 학교 규정에 맞게 고쳐 쓰세요</div>
              <p className="mt-0.5 text-help text-ink">{J14_EXAMPLE}</p>
              <div className="mt-2">
                <Button onClick={copy}>{copied ? <>{Icon.check('h-4 w-4')} 복사했어요</> : '문장 복사'}</Button>
              </div>
            </div>
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
              {!card.replace && !insert && card.actions.includes('fix') && <span className="text-help text-ink-3">문서의 칸을 두 번 눌러 직접 고칠 수 있어요</span>}
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
                    title={editing === key ? undefined : '두 번 눌러 고치기'}
                    className={`group relative border border-[#9aa3ad] px-1.5 py-1 align-middle ${isHead ? 'bg-[#f1f3f5] text-center font-bold' : ''} ${
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
                    {editing !== key && (
                      <span className="pointer-events-none absolute bottom-0.5 right-0.5 hidden rounded bg-paper/90 p-0.5 text-brand-blue shadow-sm group-hover:block" aria-hidden>
                        {Icon.pen('h-3.5 w-3.5')}
                      </span>
                    )}
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
