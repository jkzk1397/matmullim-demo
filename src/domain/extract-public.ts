// 학교알리미 공시용 「교수·학습 및 평가 운영 계획」 양식 읽기.
// 경기도 학교들이 공시하는 계획서는 한 파일에 평가 요약표와 수행평가 세부기준(채점기준)이 함께 있고,
// 요약표는 첫 "열"이 머리글이다(평가 종류 / 반영 비율 / 영역 / 영역 만점(반영비율) / 성취기준 / 평가요소 …).
// 이 파일은 그런 문서를 데모의 데이터 모델(Assessment)로 바꾼다. 점검 규칙은 그대로 rules.ts를 쓴다.
import { fillMerged, normalizeName } from './extract';
import { extractCodes, lookupAll, subjectOfCode, typoOf } from './standards';
import { detectContext, dominantSubject, splitSections, type DocContext, type SubjectSection } from './context';
import type { Assessment, CellRef, CodeText, DocKind, Element, EssayRow, Extraction, ParsedDocument, ParsedTable, PlanStandard } from './types';

const norm = (s: string) => (s ?? '').replace(/\s+/g, '').replace(/[()（）]/g, '');
const ref = (doc: DocKind, table: number, row: number, col: number): CellRef => ({ doc, table, row, col });


const isMaxRow = (label: string) => /^(영역)?만점(비율)?(반영비율|점|%)?$/.test(norm(label));

/** 요약표(첫 열에 '영역 만점(반영비율)' 행이 있는 표)가 있으면 공시 양식으로 본다. */
export function isPublicFormat(doc: ParsedDocument): boolean {
  return doc.tables.some((t) => fillMerged(t).some((row) => isMaxRow(row[0] ?? '')));
}

/**
 * 여러 교과·학년이 한 파일에 있는 경우 한 구간의 표만 남긴다. 구간을 안 주면 교과(없으면 첫 교과)의 첫 구간.
 * 표 번호(원문 위치)를 유지하려고 다른 구간 표는 빼지 않고 빈 표로 바꾼다.
 */
export function selectSubject(doc: ParsedDocument, subject?: string | SubjectSection): { doc: ParsedDocument; ranges: [number, number][]; section?: SubjectSection } {
  const sections = splitSections(doc);
  const section = typeof subject === 'object' ? subject : sections.find((x) => !subject || x.subject === subject) ?? (subject ? undefined : sections[0]);
  if (!section) return { doc, ranges: [[0, doc.tables.length]] };
  if (sections.length <= 1) return { doc, ranges: [[0, doc.tables.length]], section: { ...section, from: 0, to: doc.tables.length } };
  const keep = (i: number) => i >= section.from && i < section.to;
  return { doc: { ...doc, tables: doc.tables.map((t, i) => (keep(i) ? t : { title: '', rows: [], spans: [] })) }, ranges: [[section.from, section.to]], section };
}

const isCont = (t: ParsedTable, r: number, c: number) =>
  t.spans.some((s) => r >= s.row && r < s.row + s.rowSpan && c >= s.col && c < s.col + s.colSpan && !(r === s.row && c === s.col));

/** "90점(36%)", "30점 (30%)", "20(20%)" 같은 칸에서 점·%를 읽는다. 앞에 안내 문구가 있으면 마지막 값을 쓴다. */
export function readScoreCell(cell: string): { max?: number; weight?: number } {
  const t = (cell ?? '').replace(/,/g, '');
  const pairs = [...t.matchAll(/(\d+(?:\.\d+)?)\s*점?\s*\(\s*(\d+(?:\.\d+)?)\s*%\s*\)/g)];
  if (pairs.length) {
    const m = pairs[pairs.length - 1];
    return { max: Number(m[1]), weight: Number(m[2]) };
  }
  const pts = [...t.matchAll(/(\d+(?:\.\d+)?)\s*점/g)];
  const pct = [...t.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
  return { max: pts.length ? Number(pts[pts.length - 1][1]) : undefined, weight: pct.length === 1 && !pts.length ? Number(pct[0][1]) : undefined };
}

function splitElements(text: string): string[] {
  return (text ?? '')
    .split(/[•·∙◦○□■▪󰋻\n]|(?:^|\s)-\s|\s{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && !/^[-–‒·.]$/.test(s));
}

/** 요약표 하나 → 평가 목록 */
function readSummary(t: ParsedTable, ti: number): Assessment[] {
  const g = fillMerged(t);
  const maxRow = g.findIndex((row) => isMaxRow(row[0] ?? ''));
  if (maxRow < 0) return [];
  const find = (re: RegExp, from = 0, to = g.length) => {
    for (let r = from; r < to; r++) if (re.test(norm(g[r][0] ?? ''))) return r;
    return -1;
  };
  const typeRow = find(/^(평가)?(종류|유형)/, 0, maxRow);
  let nameRow = -1;
  for (let r = maxRow - 1; r >= 0; r--) if (/영역|평가명|횟수/.test(norm(g[r][0] ?? '')) && !isMaxRow(g[r][0])) { nameRow = r; break; }
  // 만점과 반영비율을 다른 줄에 적은 표: "만점(점) | 40" 다음 줄 "반영비율(%) | 40"
  const wRow = (() => { for (let r = maxRow + 1; r < Math.min(g.length, maxRow + 3); r++) if (/^반영비율(%)?$/.test(norm(g[r][0] ?? '').replace('%', '%'))) return r; return -1; })();
  const stdRow = find(/성취기준|평가내용/, maxRow + 1);
  const elRow = find(/평가요소|평가내용|세부내용/, maxRow + 1);
  const out: Assessment[] = [];
  const width = g[0]?.length ?? 0;
  let incomplete = false;
  for (let c = 1; c < width; c++) {
    if (isCont(t, maxRow, c)) continue;
    const noteCol = /※|변경될 수|일정에 따라/.test((nameRow >= 0 ? g[nameRow][c] : '') + (g[maxRow][c] ?? ''));
    if (noteCol) continue;
    const head = typeRow >= 0 ? g[typeRow][c] ?? '' : '';
    const nameAt = nameRow >= 0 ? (g[nameRow][c] ?? '').trim() : '';
    // 머리 행의 '합계' 칸이 옆 영역까지 덮은 표가 있어, 영역 이름이 따로 적힌 칸은 합계로 보지 않는다
    if (/^(합계|계|총계|총점)$/.test(norm(head)) && (!nameAt || /^[-‒·.∙ㆍ]$/.test(nameAt) || c === width - 1)) continue;
    const cell = g[maxRow][c] ?? '';
    let { max, weight } = readScoreCell(cell);
    const plain = (x: string) => (/^\s*\d+(?:\.\d+)?\s*$/.test(x ?? '') ? Number(x) : undefined);
    if (max === undefined && weight === undefined) max = plain(cell);
    if (wRow >= 0 && !isCont(t, wRow, c)) {
      const wc = g[wRow][c] ?? '';
      const w = readScoreCell(wc).weight ?? (/%/.test(wc) ? Number(wc.match(/\d+(?:\.\d+)?/)?.[0]) : plain(wc));
      if (w !== undefined && !Number.isNaN(w)) weight = w;
    }
    if (max === undefined && weight === undefined) {
      if ((g[maxRow][c] ?? '').trim() && !/^[-‒·.∙ㆍ]$/.test((g[maxRow][c] ?? '').trim())) incomplete = true;
      else if (/정기|지필/.test(head)) incomplete = true;
      continue;
    }
    // 맨 끝 합계 칸("100%", "100점(100%)")은 건너뛴다.
    let nameCell = nameRow >= 0 ? (g[nameRow][c] ?? '').trim() : '';
    // 줄마다 칸 병합이 엇갈린 표: 영역 칸은 왼쪽 병합의 연속인데, 점수 칸이 오른쪽으로 넓게 병합되어 그 안에 다른 영역 이름이 있으면 그 이름을 쓴다
    if (nameRow >= 0 && isCont(t, nameRow, c)) {
      const sp = t.spans.find((s) => s.row === maxRow && s.col === c);
      for (let k = c + 1; sp && k < c + sp.colSpan; k++) {
        const raw = (t.rows[nameRow]?.[k] ?? '').trim();
        if (raw && !isCont(t, nameRow, k)) { nameCell = raw; break; }
      }
    }
    if (c === width - 1 && (!nameCell || /^[-‒·.]?$/.test(nameCell)) && (weight === 100 || max === 100)) continue;
    if (/^(합계|계|총계|총점)$/.test(norm(nameCell))) continue;
    let name = nameCell || head || `평가 ${out.length + 1}`;
    for (let r = nameRow + 1; r > 0 && r < maxRow; r++) {
      const sub = (g[r][c] ?? '').trim();
      if (norm(g[r][0] ?? '') === norm(g[nameRow][0] ?? '') || !g[r][0]) {
        if (sub && sub !== name && !/^(선택형|서술형|논술형)$/.test(sub)) name = `${name} ${sub}`;
        else if (/^(선택형|서술형|논술형)$/.test(sub)) name = `${name}(${sub})`;
      }
    }
    const standards = stdRow >= 0 ? extractCodes(g[stdRow][c] ?? '') : [];
    const elementsText = elRow >= 0 ? g[elRow][c] ?? '' : '';
    const names = splitElements(elementsText);
    const elements: Element[] = (names.length ? names : [name]).map((n) => ({
      name: n,
      standards,
      refs: { name: ref('plan', ti, elRow >= 0 ? elRow : maxRow, c), standards: stdRow >= 0 ? ref('plan', ti, stdRow, c) : undefined },
    }));
    const written = /정기|지필|선택형/.test(head + name) || /^(논술형|서술형)(\s*\(\d+\))?$/.test(name.trim());
    out.push({
      id: `plan-${ti}-${c}`,
      name,
      method: written ? '지필' : head || '수행',
      maxScore: max,
      weightPercent: weight,
      elements,
      source: ref('plan', ti, nameRow >= 0 ? nameRow : maxRow, c),
      refs: { maxScore: ref('plan', ti, maxRow, c), weightPercent: ref('plan', ti, wRow >= 0 ? wRow : maxRow, c), method: typeRow >= 0 ? ref('plan', ti, typeRow, c) : undefined },
    });
  }
  // 합계 칸(다른 칸 비율의 합과 같은 100%)이 맨 끝이 아닌 곳에 있어도 뺀다
  const ws = out.map((a) => a.weightPercent ?? 0);
  const total = ws.reduce((x, y) => x + y, 0);
  const dropIdx = out.findIndex((a, i) => a.weightPercent === 100 && Math.abs(total - ws[i] - 100) < 1e-9);
  if (dropIdx >= 0 && out.length > 2) out.splice(dropIdx, 1);
  if (incomplete) for (const a of out) a.incomplete = true;
  return out;
}

/** 수행평가 세부기준: "평가 영역(명) | 이름 | 영역 만점 | 30점" 행이 있는 표와, 그 뒤의 채점기준 표 */
function readRubrics(doc: ParsedDocument, isSubj: (c: string) => boolean): Assessment[] {
  const out: Assessment[] = [];
  let cur: Assessment | null = null;
  doc.tables.forEach((t, ti) => {
    const g = fillMerged(t);
    for (let r = 0; r < g.length; r++) {
      const row = g[r];
      if (/^평가영역(명)?\d*$/.test(norm(row[0] ?? '')) || /^평가영역명?\d*$/.test(norm(row[0] ?? ''))) {
        const mc = row.findIndex((x, j) => j > 0 && /만점/.test(norm(x)));
        if (mc > 0) {
          // 성취기준 코드가 있는데 이 교과 코드가 하나도 없으면 다른 교과의 세부기준이다
          const codes = extractCodes(g.flat().join(' '));
          if (codes.length && !codes.some(isSubj)) { cur = null; continue; }
          const name = (row[1] ?? '').trim();
          const mcell = row.slice(mc + 1).find((x) => /\d/.test(x)) ?? '';
          const mv = readScoreCell(mcell);
          if (mv.max === undefined && /^\s*\d+(?:\.\d+)?\s*$/.test(mcell)) mv.max = Number(mcell);
          cur = { id: `rubric-${ti}-${r}`, name, maxScore: mv.max, elements: [], source: ref('rubric', ti, r, 1), refs: { maxScore: ref('rubric', ti, r, mc + 1) } };
          out.push(cur);
        }
      }
    }
    if (!cur) return;
    // 채점기준 머리글: 평가요소 + (채점기준|수행 수준|평가 기준)
    // 머리글 칸은 짧다 (본문 문장 속 '핵심 요소' 같은 말을 머리글로 잘못 보지 않게)
    const isHead = (x: string, re: RegExp) => norm(x).length <= 16 && re.test(norm(x));
    const CRIT = /채점기준|수행수준|평가기준/;
    const ELEM = /평가요소|평가항목|채점요소|요소/;
    const hr = g.findIndex((row) => row.some((x) => isHead(x, CRIT)) && row.some((x) => isHead(x, ELEM)));
    if (hr < 0) return;
    const h = g[hr];
    const cEl = h.findIndex((x) => isHead(x, ELEM));
    const cCrit = h.findIndex((x) => isHead(x, CRIT));
    const cPts = h.findIndex((x) => isHead(x, /배점|점수/));
    for (let r = hr + 1; r < g.length; r++) {
      const elName = (g[r][cEl] ?? '').replace(/\s+/g, ' ').trim();
      const crit = (g[r][cCrit] ?? '').trim();
      if (!elName || !crit || elName === crit) continue;
      if (/기본\s*점수|미제출|미응시|결석|미참여|백지/.test(elName + crit)) continue;
      let el = cur.elements.find((e) => e.name === elName);
      if (!el) {
        el = { name: elName, standards: extractCodes(elName), rubricText: '', refs: { name: ref('rubric', ti, r, cEl), rubricText: ref('rubric', ti, r, cCrit) } };
        cur.elements.push(el);
      }
      el.rubricText = [el.rubricText, crit].filter(Boolean).join('\n');
      if (cPts >= 0) {
        const p = Number((g[r][cPts] ?? '').match(/\d+(?:\.\d+)?/)?.[0]);
        if (!Number.isNaN(p)) el.points = Math.max(el.points ?? 0, p);
      }
    }
  });
  for (const a of out) a.rubricText = a.elements.map((e) => e.rubricText ?? '').filter(Boolean).join('\n');
  return out;
}

/** 문서 안에서 "[코드] 문장" 꼴로 적힌 성취기준 문구를 모두 모은다 (같은 코드 다른 문구 점검용). */
function readCodeTexts(doc: ParsedDocument, kind: DocKind): CodeText[] {
  const out: CodeText[] = [];
  doc.tables.forEach((t, ti) =>
    t.rows.forEach((row, r) =>
      row.forEach((cell, c) => {
        const re = /\[\s*(\d{1,2})\s*([가-힣()]{1,6}?)\s*-?\s*(\d{1,2})\s*-\s*(\d{2})\s*\]\s*([^[\n]{6,240}?다)\.?(?=\s*(?:\[|\n|$))/g;
        for (const m of (cell ?? '').matchAll(re)) {
          const code = extractCodes(`[${m[1]}${m[2]}${m[3].padStart(2, '0')}-${m[4]}]`)[0];
          if (code) out.push({ code, text: m[5].trim(), ref: ref(kind, ti, r, c) });
        }
      }),
    ),
  );
  return out;
}

export function extractPublic(raw: ParsedDocument, hint?: string | SubjectSection): Extraction & { subjectRanges: [number, number][]; context: DocContext } {
  const { doc, ranges, section } = selectSubject(raw, hint);
  const context = detectContext(raw, ranges[0][0], ranges[0][1], section?.subject ?? (typeof hint === 'string' ? hint : undefined), section?.grades);
  // 교과를 끝내 모르면 중학교 교과 코드는 모두 받는다
  const isSubj = (c: string) => (context.subject ? subjectOfCode(c) === context.subject : !!subjectOfCode(c));
  const plan: Assessment[] = [];
  doc.tables.forEach((t, ti) => {
    const items = readSummary(t, ti);
    // 요약표 성취기준 칸에 다른 교과 코드만 있으면 이 교과 표가 아니다
    const codes = items.flatMap((a) => a.elements.flatMap((e) => e.standards));
    if (codes.length && !codes.some(isSubj)) return;
    plan.push(...items);
  });
  const rubric = readRubrics(doc, isSubj);
  // 학기 성취기준: 성취기준별 성취수준 표 등에서 코드와 문장
  const codeTexts = readCodeTexts(doc, 'plan');
  // 정렬 맵의 행 = 이번 학기 교수·학습 운영 계획(머리글에 월·주가 있는 표)에 적힌 이 교과 코드. 없으면 문서 전체.
  const isSchedule = (ti: number) => (doc.tables[ti]?.rows[0] ?? []).some((h) => /^(월|주|시기|차시)$/.test(norm(h)));
  const infoCode = isSubj;
  const scheduled = codeTexts.filter((ct) => isSchedule(ct.ref.table) && infoCode(ct.code));
  const planStandards: PlanStandard[] = [];
  for (const ct of scheduled.length ? scheduled : codeTexts.filter((c) => infoCode(c.code)))
    if (!planStandards.some((s) => s.code === ct.code)) planStandards.push({ code: ct.code, text: ct.text, ref: ct.ref });
  // 요약표 성취기준 칸에만 있는 코드도 정렬 맵에 넣는다
  for (const a of plan) for (const e of a.elements) for (const code of e.standards)
    if (infoCode(code) && !planStandards.some((s) => s.code === code)) planStandards.push({ code, text: '', ref: e.refs?.standards ?? a.source });
  // 표를 읽지 못한 문서(PDF 등): 본문 어디에든 적힌 이 교과 코드(오자 모양 포함)를 모아 코드 점검만이라도 한다
  if (!plan.length)
    for (const [ti, t] of doc.tables.entries())
      for (const [ri, row] of t.rows.entries())
        for (const [ci, cell] of row.entries())
          for (const m of (cell ?? '').matchAll(/\[0?9[가-힣()]{1,6}\d{2}-\d{2}\]/g))
            if ((isSubj(m[0]) || typoOf(m[0], { subject: context.subject })) && !planStandards.some((s) => s.code === m[0]))
              planStandards.push({ code: m[0], text: '', ref: ref('plan', ti, ri, ci) });
  const warnings: string[] = [];
  if (!plan.length) warnings.push('공시 양식의 평가 요약표(영역 만점·반영비율)를 찾지 못했어요.');
  // 같은 이름의 평가가 요약표에 두 번 이상 나오면(학년별 반복) 이름 뒤에 표 번호를 붙인다
  const seen = new Map<string, number>();
  const firstTable = new Map<string, number>();
  for (const a of plan) {
    const k0 = normalizeName(a.name);
    if (!firstTable.has(k0)) firstTable.set(k0, a.source.table);
    if (firstTable.get(k0) === a.source.table) continue;
    const k = k0;
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    if (n > 1) a.name = `${a.name} (${n})`;
  }
  return { plan, rubric, planStandards, codeTexts, warnings, subjectRanges: ranges, context, essay: readEssay(doc), absence: findAbsence(raw, ranges[0][0], ranges[0][1]), malformed: findMalformed(doc, isSubj) };
}

/** 여는 괄호가 빠진 성취기준 코드: "9정03-04] 사례를…" (괄호를 채우면 이 교과의 실제 코드가 될 때만). 닫는 괄호 쪽은 [9정01-01-01]·[9정02-03, 04] 같은 표기가 많아 보지 않는다 */
function findMalformed(doc: ParsedDocument, isSubj: (c: string) => boolean): { raw: string; fixed: string; ref: CellRef }[] {
  const out: { raw: string; fixed: string; ref: CellRef }[] = [];
  doc.tables.forEach((t, ti) =>
    t.rows.forEach((row, r) =>
      row.forEach((cell, c) => {
        const text = cell ?? '';
        for (const m of text.matchAll(/(^|[^[\d가-힣])(\d{1,2}[가-힣]{1,3}\d{2}-\d{2})\]/g)) {
          const fixed = `[${m[2]}]`;
          // "[9정01-01, 9정01-02]"처럼 한 괄호 안에 여러 코드를 적은 경우는 빼고
          const before = text.slice(0, m.index! + m[1].length);
          if (before.lastIndexOf('[') > before.lastIndexOf(']')) continue;
          if (isSubj(fixed) && lookupAll(fixed).length) out.push({ raw: `${m[2]}]`, fixed, ref: ref('plan', ti, r, c) });
        }
      }),
    ),
  );
  return out;
}

const pct = (x: string) => {
  const m = (x ?? '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : /^\s*\d+(?:\.\d+)?\s*$/.test(x ?? '') ? Number(x) : undefined;
};

/** 요약표의 '논술형 평가 반영비율' 행: 맨 끝이 합계 칸이면 그 값, 아니면 칸들의 합 */
function readEssay(doc: ParsedDocument): EssayRow[] {
  const out: EssayRow[] = [];
  doc.tables.forEach((t, ti) => {
    const g = fillMerged(t);
    if (!g.some((row) => isMaxRow(row[0] ?? ''))) return;
    g.forEach((row, r) => {
      if (!/논술형.{0,12}(반영|비율)/.test(norm(row[0] ?? ''))) return;
      // 병합으로 같은 값이 여러 칸에 복사되지 않게 원래 칸만
      const cells = row.map((x, c) => (c > 0 && !isCont(t, r, c) ? x : '')).slice(1);
      const vals = cells.map(pct);
      const nums = vals.filter((v): v is number => v !== undefined);
      if (!nums.length) return;
      // 합계 칸: 머리글 행 어딘가에 '합계'/'계'가 적힌 열
      const totalCols = new Set<number>();
      for (const hr of g.slice(0, r)) hr.forEach((x, c) => { if (c > 0 && /^(합계|계|총계)$/.test(norm(x))) totalCols.add(c - 1); });
      const tIdx = [...totalCols].find((c) => vals[c] !== undefined);
      const items = vals.filter((v, k) => v !== undefined && k !== tIdx) as number[];
      const total = tIdx !== undefined ? vals[tIdx]! : items.reduce((a, b) => a + b, 0);
      const lastIdx = tIdx ?? vals.lastIndexOf(nums[nums.length - 1]);
      // 이 요약표가 속한 교과: 표 안과 바로 앞 표들의 성취기준 코드로 (여러 교과를 한 구간으로 읽은 파일 대비)
      const subject = dominantSubject(doc, ti, ti + 1) ?? dominantSubject(doc, Math.max(0, ti - 3), ti + 1);
      out.push({ table: ti, total, ref: ref('plan', ti, r, lastIdx + 1), raw: row.map((x) => x.replace(/\s+/g, ' ')).join(' | '), subject });
    });
  });
  return out;
}

const ABSENCE = /결시|미응시|인정점|미참여|불참|참여하지\s*못|응시하지|결석|불응시/;
function findAbsence(doc: ParsedDocument, from: number, to: number): { found: boolean; ref?: CellRef } {
  for (let ti = from; ti < to; ti++)
    for (const [r, row] of (doc.tables[ti]?.rows ?? []).entries())
      for (const [c, cell] of row.entries()) if (ABSENCE.test(cell ?? '')) return { found: true, ref: ref('plan', ti, r, c) };
  for (const p of doc.paragraphs ?? []) if (p.before >= from && p.before <= to && ABSENCE.test(p.text)) return { found: true };
  return { found: false };
}

/** 이름으로 짝 제안 (공시 양식: 같은 파일 안 요약표 ↔ 세부기준) */
export function suggestPublicPairs(plan: Assessment[], rubric: Assessment[]): Record<string, string | null> {
  const pairs: Record<string, string | null> = {};
  const used = new Set<string>();
  for (const r of rubric) {
    const rn = normalizeName(r.name);
    const cands = plan.filter((p) => !used.has(p.id) && p.method !== '지필');
    const exact = cands.find((p) => normalizeName(p.name) === rn);
    const loose = cands.find((p) => {
      const pn = normalizeName(p.name);
      return pn.length > 1 && rn.length > 1 && (pn.includes(rn) || rn.includes(pn));
    });
    const hit = exact ?? loose;
    pairs[r.id] = hit?.id ?? null;
    if (hit) used.add(hit.id);
  }
  return pairs;
}
