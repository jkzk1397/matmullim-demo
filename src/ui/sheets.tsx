// 지적 하나를 "내 문서 한 장 ↔ 대조 문서 한 장"으로 보여 주는 시트.
// 칠할 칸과 내용은 모두 카드의 원문 위치와 규칙 데이터에서 나온다.
import { fillMerged, normalizeName } from '../domain/extract';
import { findDiscouraged, buildAlignment, J7_SOURCE_TEXT } from '../domain/rules';
import { STANDARDS_DB } from '../domain/standards';
import type { Card, CellRef, CheckInput, DocKind, Severity } from '../domain/types';
import { DOC_NAME, cleanTitle, sameRef, type Docs } from './helpers';
import { Marked } from './primitives';
import { SEVERITY } from './helpers';

type SheetCell = { text: string; mark?: boolean; phrases?: string[]; strong?: boolean };
type SheetPart = { title: string; header: string[]; rows: SheetCell[][]; foot?: SheetCell[]; wide?: number };
export type SheetModel = { label: string; sub?: string; parts: SheetPart[]; note?: string };

const ID_COL = /평가명|평가요소|코드/;
const cleanHeader = (h: string) => h.replace(/\s*\((점|%)\)\s*/g, '').trim();

/** 원문 칸 목록에서 표 조각을 만든다: 칸이 있는 행 + 행을 알아볼 열 + 칸이 있는 열 */
function docParts(docs: Docs, refs: CellRef[], emphasis: CellRef[], phrases: string[] | undefined, doc: DocKind, extraCols: RegExp[] = []): SheetPart[] {
  const byTable = new Map<number, CellRef[]>();
  for (const r of refs.filter((x) => x.doc === doc)) {
    if (!byTable.has(r.table)) byTable.set(r.table, []);
    byTable.get(r.table)!.push(r);
  }
  const parts: SheetPart[] = [];
  for (const [ti, locs] of [...byTable].sort((a, b) => a[0] - b[0])) {
    const t = docs[doc].tables[ti];
    if (!t) continue;
    const g = fillMerged(t);
    const header = g[0];
    const rows = [...new Set(locs.map((l) => l.row))].sort((a, b) => a - b);
    const hasEl = header.some((h) => /평가요소/.test(h));
    const isId = (h: string) => (hasEl ? /평가명|평가요소/.test(h) : ID_COL.test(h));
    let cols = [...new Set([...header.flatMap((h, i) => (isId(h) || extraCols.some((re) => re.test(h)) ? [i] : [])), ...locs.map((l) => l.col)])].sort(
      (a, b) => a - b,
    );
    // 길게 쓴 문장 열(성취기준 문장 등)은 칸이 없으면 뺀다
    let title = cleanTitle(t.title);
    const nameCol = header.findIndex((h) => /평가명/.test(h));
    if (nameCol >= 0 && !locs.some((l) => l.col === nameCol)) {
      const names = [...new Set(rows.map((r) => g[r][nameCol]))];
      if (names.length === 1) {
        cols = cols.filter((c) => c !== nameCol);
        title = `${title} · ${names[0]}`;
      }
    }
    parts.push({
      title,
      header: cols.map((c) => cleanHeader(header[c])),
      rows: rows.map((r) =>
        cols.map((c) => {
          const ref = { doc, table: ti, row: r, col: c };
          const isLoc = locs.some((l) => sameRef(l, ref));
          const mark = isLoc && emphasis.some((e) => sameRef(e, ref));
          return { text: g[r][c], mark: mark && !phrases?.length, phrases: isLoc && mark ? phrases : undefined, strong: isLoc };
        }),
      ),
      wide: cols.findIndex((c) => /채점기준|성취기준$/.test(header[c])),
    });
  }
  return parts;
}

function sumFoot(part: SheetPart, label: string, value: string, mark: boolean): SheetPart {
  const ptsCol = part.header.findIndex((h) => /배점/.test(h));
  if (ptsCol < 0) return part;
  return {
    ...part,
    foot: part.header.map((_, i) => (i === ptsCol ? { text: value, mark, strong: true } : i === 0 ? { text: label } : { text: '' })),
  };
}

export type SheetPair = { left: SheetModel; right?: SheetModel; joint: '≠' | '?' | '↔' };

export function buildSheets(card: Card, docs: Docs, input: CheckInput): SheetPair {
  const emphasis = card.emphasis ?? card.locations;
  const doc = (d: DocKind, extra: RegExp[] = []): SheetModel => ({
    label: DOC_NAME[d],
    sub: docs[d].fileName,
    parts: docParts(docs, card.locations, emphasis, card.highlights, d, extra),
  });
  const has = (d: DocKind) => card.locations.some((l) => l.doc === d);
  const joint = card.severity === 'gray' ? '?' : card.severity === 'yellow' ? '↔' : '≠';

  if (card.key.startsWith('J12-max:')) {
    const p = input.plan.find((a) => normalizeName(a.name) === card.key.slice(8));
    const r = p && input.rubric.find((x) => input.pairs[x.id] === p.id);
    const left = doc('plan');
    const right = doc('rubric');
    const pSum = (p?.elements ?? []).reduce((n, e) => n + (e.points ?? 0), 0);
    const rSum = (r?.elements ?? []).reduce((n, e) => n + (e.points ?? 0), 0);
    left.parts = left.parts.map((pt) => (pt.header.some((h) => /배점/.test(h)) ? sumFoot(pt, '합계', `${pSum}`, false) : pt));
    right.parts = right.parts.map((pt) => sumFoot(pt, '합계 (맞물림 계산)', `${rSum}`, rSum !== p?.maxScore));
    return { left, right, joint };
  }

  if (card.rule === 'J12' && has('plan') && has('rubric')) return { left: doc('plan'), right: doc('rubric'), joint };

  if (card.key === 'J12-weight-sum') {
    const left = doc('plan');
    const total = input.plan.reduce((n, a) => n + (a.weightPercent ?? 0), 0);
    left.parts = left.parts.map((pt) => ({ ...pt, foot: pt.header.map((h, i) => (/반영/.test(h) ? { text: `${total}%`, mark: true, strong: true } : { text: i === 0 ? '합계 (맞물림 계산)' : '' })) }));
    return { left, joint };
  }

  if (card.rule === 'J4') {
    const code = card.key.split(':')[1];
    const d: DocKind = has('plan') ? 'plan' : 'rubric';
    const left: SheetModel = { label: DOC_NAME[d], sub: docs[d].fileName, parts: docParts(docs, card.locations, card.locations, [code], d) };
    if (card.severity === 'gray') return { left, joint };
    const domainNo = code.slice(3, 5);
    const sibs = STANDARDS_DB.standards.filter((s) => s.code.startsWith(`[9정${domainNo}-`));
    return {
      left,
      right: {
        label: '성취기준 DB',
        sub: `2022 개정 중학교 정보${sibs[0] ? ` · ${sibs[0].domain}` : ''}`,
        parts: [{ title: `같은 영역 성취기준 ${sibs.length}개`, header: ['코드', '성취기준'], rows: sibs.map((s) => [{ text: s.code, strong: true }, { text: s.text }]), wide: 1 }],
        note: `${code}는 목록에 없어요.`,
      },
      joint,
    };
  }

  if (card.rule === 'J7') {
    const left = doc('rubric');
    const labels = findDiscouraged(card.quote).map((h) => h.label);
    const words = labels.map((l) => (l === '과제 수행률' ? '과제 수행률(%)' : l));
    return {
      left,
      right: {
        label: '교육청 지침',
        sub: card.basis.page,
        parts: [{ title: card.basis.source, header: [], rows: [[{ text: J7_SOURCE_TEXT, phrases: words }]] }],
      },
      joint,
    };
  }

  if (card.rule === 'J6') {
    const left = doc('plan', [/^성취기준$/]);
    const code = card.key.split(':')[1];
    const row = buildAlignment(input).find((x) => x.code === code);
    return {
      left,
      right: {
        label: '평가 요소와 성취기준',
        sub: '평가계획서 · 채점기준표에서 찾은 연결',
        parts: [
          {
            title: `${code}를 적은 평가`,
            header: ['평가', '연결'],
            rows: input.plan.map((a) => [{ text: a.name }, { text: row?.cells.find((c) => c.assessmentId === a.id)?.via ? '있음' : '찾지 못함', mark: true }]),
          },
        ],
      },
      joint,
    };
  }

  if (card.rule === 'S5') {
    return {
      left: {
        label: DOC_NAME.rubric,
        sub: docs.rubric.fileName,
        parts: input.rubric.map((a) => ({ title: a.name, header: ['평가요소'], rows: a.elements.map((e) => [{ text: e.name }]) })),
        note: '성찰·자기평가·동료평가 요소를 찾지 못했어요.',
      },
      joint,
    };
  }

  const d: DocKind = has('plan') ? 'plan' : 'rubric';
  return { left: doc(d), joint };
}

/** 문서 한 장: 다른 값만 카드 색으로 굵게, 같은 값은 흐리게 */
export function Sheet({ model, s }: { model: SheetModel; s: Severity }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl bg-paper shadow-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-line-2 px-4 py-2">
        <span className="text-body font-bold text-ink">{model.label}</span>
        {model.sub && <span className="truncate text-help text-ink-3">{model.sub}</span>}
      </div>
      <div className="space-y-2 px-4 py-2.5">
        {model.parts.map((pt, i) =>
          pt.rows.length === 1 && pt.header.length === 1 && !pt.foot ? (
            // 값 하나짜리 표 조각은 한 줄로: "평가 개요 · 프로그래밍 프로젝트   만점 30점"
            <div key={i} className="flex items-baseline justify-between gap-3 border-b border-line-2 pb-1.5">
              <span className="text-help text-ink-3">{pt.title}</span>
              <span className="whitespace-nowrap">
                <span className="mr-2 text-help font-bold text-ink-3">{pt.header[0]}</span>
                <SheetValue c={pt.rows[0][0]} s={s} />
              </span>
            </div>
          ) : (
          <div key={i}>
            <div className="mb-1 text-help text-ink-3">{pt.title}</div>
            <table className="w-full border-collapse text-body leading-[26px]">
              {pt.header.length > 0 && (
                <thead>
                  <tr>
                    {pt.header.map((h, j) => (
                      <th key={j} className={`border-b border-line px-1.5 pb-1 text-left text-help font-bold text-ink-3 ${j === pt.wide ? 'w-full' : 'whitespace-nowrap'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {pt.rows.map((row, r) => (
                  <tr key={r} className="border-b border-line-2 last:border-0">
                    {row.map((c, j) => (
                      <SheetTd key={j} c={c} s={s} wide={j === pt.wide || pt.header.length === 0} />
                    ))}
                  </tr>
                ))}
                {pt.foot && (
                  <tr className="border-t border-line">
                    {pt.foot.map((c, j) => (
                      <SheetTd key={j} c={c} s={s} foot />
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          ),
        )}
        {model.note && <p className="text-help text-ink-3">{model.note}</p>}
      </div>
    </div>
  );
}

function SheetValue({ c, s }: { c: SheetCell; s: Severity }) {
  return c.mark ? <span className={`font-bold ${SEVERITY[s].text}`}>{c.text}</span> : <span className="text-ink-3">{c.text}</span>;
}

function SheetTd({ c, s, wide, foot }: { c: SheetCell; s: Severity; wide?: boolean; foot?: boolean }) {
  const hit = `font-bold ${SEVERITY[s].text}`;
  return (
    <td className={`px-1.5 py-0.5 align-top ${wide ? '' : 'whitespace-nowrap'} ${foot && !c.strong ? 'text-help text-ink-3' : ''}`}>
      {c.mark ? (
        <span className={hit}>{c.text}</span>
      ) : c.phrases ? (
        <span className="text-ink-2">
          <Marked text={c.text} marks={c.phrases} className={hit} />
        </span>
      ) : (
        <span className={c.strong ? 'text-ink-3' : foot ? '' : 'text-ink-2'}>{c.text}</span>
      )}
    </td>
  );
}
