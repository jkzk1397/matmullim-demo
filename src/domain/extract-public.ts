// 학교알리미 공시용 「교수·학습 및 평가 운영 계획」 양식 읽기.
// 경기도 학교들이 공시하는 계획서는 한 파일에 평가 요약표와 수행평가 세부기준(채점기준)이 함께 있고,
// 요약표는 첫 "열"이 머리글이다(평가 종류 / 반영 비율 / 영역 / 영역 만점(반영비율) / 성취기준 / 평가요소 …).
// 이 파일은 그런 문서를 데모의 데이터 모델(Assessment)로 바꾼다. 점검 규칙은 그대로 rules.ts를 쓴다.
import { fillMerged, normalizeName } from './extract';
import { extractCodes, lookupAll, subjectOfCode, typoOf } from './standards';
import { detectContext, dominantSubject, splitSections, type DocContext, type SubjectSection } from './context';
import type { AiUse, Assessment, CellRef, CodeText, DocKind, Element, EssayRow, Extraction, ParsedDocument, ParsedTable, PlanStandard, RequiredPresence } from './types';

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
  // "20점(논술형 5점)"처럼 괄호 안 하위 배점은 빼고 읽는다
  const t = (cell ?? '').replace(/,/g, '').replace(/\((?:논술형|서술형|선택형|단답형)[^)]*\)/g, '');
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
  let typeRow = find(/^(평가)?(종류|유형)/, 0, maxRow);
  // 머리 칸 이름이 달라도(예: '영역') 값에 정기시험·수행평가가 적힌 줄이면 평가 종류 줄로 본다
  if (typeRow < 0) typeRow = g.slice(0, maxRow).findIndex((row) => row.slice(1).some((x) => /정기\s*시험|지필\s*평가/.test(x ?? '')) && row.slice(1).some((x) => /수행\s*평가/.test(x ?? '')));
  let nameRow = -1;
  for (let r = maxRow - 1; r >= 0; r--) if (/영역|평가명|횟수/.test(norm(g[r][0] ?? '')) && !isMaxRow(g[r][0]) && !isCont(t, r, 0)) { nameRow = r; break; }
  // 만점과 반영비율을 다른 줄에 적은 표: "만점(점) | 40" 다음 줄 "반영비율(%) | 40"
  const wRow = (() => { for (let r = maxRow + 1; r < Math.min(g.length, maxRow + 3); r++) if (/^반영비율(%)?$/.test(norm(g[r][0] ?? '').replace('%', '%'))) return r; return -1; })();
  // 평가 시기 행 ("평가 시기 | 4월 2주 | 5월 3주 …"). '시기/영역'처럼 영역 이름 행을 겸한 머리 칸은 시기가 아니다
  const whenRow = find(/^(평가)?(실시|시행)?(시기|일정)(주|월|월주|월·주)?$/);
  const stdRow = find(/성취기준|평가내용/, maxRow + 1);
  const elRow = find(/평가요소|평가내용|세부내용/, maxRow + 1);
  const out: Assessment[] = [];
  const width = g[0]?.length ?? 0;
  let incomplete = false;
  for (let c = 1; c < width; c++) {
    if (isCont(t, maxRow, c)) continue;
    const sc0 = readScoreCell(g[maxRow][c] ?? '');
    const noteCol = /※|변경될 수|일정에 따라/.test((nameRow >= 0 ? g[nameRow][c] : '') + (g[maxRow][c] ?? '')) && sc0.max === undefined && sc0.weight === undefined;
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
    // 머리 행이 '수행'이면 이름에 '논술형'이 있어도 수행평가다
    const written = !/수행/.test(head) && (/정기|지필|선택형/.test(head + name) || /^(논술형|서술형)(\s*\(\d+\))?$/.test(name.trim()) || /^\d+\s*[회차](\s*\((논술형|서술형|선택형)\))?$/.test(name.trim()));
    const when = whenRow >= 0 ? (g[whenRow][c] ?? '').trim() : undefined;
    out.push({
      id: `plan-${ti}-${c}`,
      name,
      method: written ? '지필' : head || '수행',
      maxScore: max,
      weightPercent: weight,
      elements,
      when,
      source: ref('plan', ti, nameRow >= 0 ? nameRow : maxRow, c),
      refs: {
        maxScore: ref('plan', ti, maxRow, c),
        weightPercent: ref('plan', ti, wRow >= 0 ? wRow : maxRow, c),
        method: typeRow >= 0 ? ref('plan', ti, typeRow, c) : undefined,
        when: whenRow >= 0 ? ref('plan', ti, whenRow, c) : undefined,
      },
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
      if ((/^평가영역(명)?\d*$/.test(norm(row[0] ?? '')) || /^평가영역명?\d*$/.test(norm(row[0] ?? ''))) && !isCont(t, r, 0)) {
        const mc = row.findIndex((x, j) => j > 0 && /만점/.test(norm(x)));
        if (mc > 0) {
          // 성취기준 코드가 있는데 이 교과 코드가 하나도 없으면 다른 교과의 세부기준이다
          const codes = extractCodes(g.flat().join(' '));
          if (codes.length && !codes.some(isSubj)) { cur = null; continue; }
          const name = (row[1] ?? '').trim();
          const mcell = row.slice(mc + 1).find((x) => /\d/.test(x)) ?? '';
          const mv = readScoreCell(mcell);
          if (mv.max === undefined && /^\s*\d+(?:\.\d+)?\s*$/.test(mcell)) mv.max = Number(mcell);
          // "1차, 2차 각 25점": 회차별 만점이라 영역 합계와 비교하지 않는다
          if (/각\s*\d/.test(mcell)) mv.max = undefined;
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
          // "[9정03-03] [9정04-04]\n문장1\n문장2"처럼 코드를 몰아 적은 칸은 어느 문장이 어느 코드인지 알 수 없어 짝짓지 않는다
          if (/\]\s*$/.test((cell ?? '').slice(0, m.index))) continue;
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
    // 고입 내신 산출용 등 학기 성적 계획이 아닌 보조 표는 빼고
    if (/특성화고|고입|내신\s*산출|전기고/.test(t.title ?? '')) return;
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
  const text = fullText(raw);
  const required = requiredPresence(text, context.grades);
  const assessTables = new Set([...plan.map((a) => a.source.table), ...rubric.map((a) => a.source.table)]);
  const ai = findAiUse(doc, ranges[0][0], ranges[0][1], assessTables, text);
  return { plan, rubric, planStandards, codeTexts, warnings, subjectRanges: ranges, context, essay: readEssay(doc), absence: findAbsence(raw, ranges[0][0], ranges[0][1]), malformed: findMalformed(doc, isSubj), required, ai };
}

/** 파일 전체 글자 (제목·표·본문). 전 교과 합본은 공통 안내가 앞쪽에 한 번만 있어 구간이 아니라 파일 전체를 본다 */
export function fullText(doc: ParsedDocument): string {
  const parts: string[] = [doc.title ?? ''];
  for (const t of doc.tables) {
    parts.push(t.title ?? '');
    for (const r of t.rows) parts.push(r.join(' | '));
  }
  for (const p of doc.paragraphs ?? []) parts.push(p.text);
  return parts.join('\n');
}

/** 지침 6~7쪽 Ⅲ.3.나 2) '평가 계획에 포함되도록 한다'의 항목. 영역·요소·방법·시기·반영비율은 요약표, 결시자는 J14가 본다 */
export const REQUIRED_ITEMS: { key: string; label: string; re: RegExp; only?: 'g12' | 'g3' }[] = [
  { key: 'purpose', label: '평가의 목적', re: /목\s*적/ },
  { key: 'policy', label: '평가의 방향과 방침', re: /방\s*향|방\s*침/ },
  { key: 'caution', label: '평가 유의사항', re: /유\s*의\s*(사\s*항|점|할\s*점)|주\s*의\s*사\s*항|평가\s*시\s*유의/ },
  { key: 'rate', label: '교과(목)별 성취율과 성취도', re: /성\s*취\s*율|성\s*취\s*도[^\n]{0,40}(평\s*정|산\s*출)|90\s*%\s*이\s*상/ },
  { key: 'level', label: '성취기준별 성취수준, 학기 단위 성취수준', re: /성\s*취\s*수\s*준/, only: 'g12' },
  { key: 'criteria', label: '성취기준에 따른 평가기준', re: /평\s*가\s*기\s*준|성\s*취\s*수\s*준/, only: 'g3' },
  // 지침 6쪽 각주 6): 채점기준을 모두 공개하기 어려우면 채점기준에 든 평가 요소를 공개한다 → 평가 요소가 있으면 된 것으로 본다
  { key: 'detail', label: '수행평가의 세부기준(영역별 배점과 채점기준)', re: /세\s*부\s*(평\s*가\s*)?기\s*준|채\s*점\s*(기\s*준|요\s*소)|수\s*행\s*수\s*준|배\s*점\s*기\s*준|평\s*가\s*요\s*소/ },
  { key: 'affective', label: '정의적 능력 평가 방안', re: /정\s*의\s*적/ },
  { key: 'transfer', label: '학적변동자 처리 기준', re: /학\s*적\s*변\s*동|전\s*입|전\s*출|편\s*입|재\s*취\s*학|전\s*학\s*(생|온|간)/ },
  { key: 'use', label: '성적처리 방법 및 결과의 활용', re: /성\s*적\s*처\s*리|결\s*과\s*(의\s*)?(분\s*석|활\s*용)|평\s*가\s*결\s*과[^\n]{0,40}활\s*용/ },
];

/** 학년: 1·2학년은 2022 개정(성취수준), 3학년은 2015 개정(평가기준). 모르면 둘 중 하나만 있어도 된다 */
function requiredPresence(text: string, grades: number[]): RequiredPresence {
  const g12 = grades.some((g) => g === 1 || g === 2);
  const g3 = grades.includes(3);
  const level = REQUIRED_ITEMS.find((i) => i.key === 'level')!;
  const criteria = REQUIRED_ITEMS.find((i) => i.key === 'criteria')!;
  return REQUIRED_ITEMS.flatMap((it) => {
    if (!it.only) return [{ key: it.key, label: it.label, found: it.re.test(text) }];
    if (it.key === 'criteria') return [];
    // 학년을 모르면 성취수준·평가기준 중 하나만 있어도 된다. 1·2학년과 3학년이 섞인 파일은 둘 다 본다
    if (!grades.length) return [{ key: 'level', label: '성취수준 또는 평가기준', found: level.re.test(text) || criteria.re.test(text) }];
    const out = [];
    if (g12) out.push({ key: 'level', label: level.label, found: level.re.test(text) });
    if (g3) out.push({ key: 'criteria', label: criteria.label, found: criteria.re.test(text) });
    return out;
  });
}

// ---------- AI 도구를 쓰는 수행평가 ----------
// 학생이 AI로 결과물을 만들거나 다듬는 평가만 본다. 인공지능을 배우는 내용(정보과 '인공지능 모델', 성취수준 문장)과
// 수업 방법(코스웨어·디지털 교과서), 관리 방안·원칙 문장은 빼다.
const AI_TERM = String.raw`(?:생성형\s*(?:AI|인공\s*지능)|챗\s*GPT|ChatGPT|뤼튼|제미나이|Gemini|코파일럿|Copilot|클로바\s*X|AI|인공\s*지능)`;
/** AI로 무엇을 만들거나 고치는 동작 */
const AI_MAKE = new RegExp(
  AI_TERM + String.raw`\s*(?:를|을|로|으로|의\s*도움을\s*받아|도구를|프로그램을|플랫폼을)?\s*(?:활용|이용|사용)?\s*(?:하여|해|한|해서)?[^.\n]{0,24}?(?:생성|제작|창작|작곡|만들|만든|작성|그리|그림|디자인|번역|교정|검사|피드백\s*받|아이디어)`,
);
/** 평가 칸에 붙은 표지: "(AI활용)", "AI 활용 음악 만들기", "생성형 AI 활용" */
const AI_TAG = /\(\s*(?:생성형\s*)?AI\s*활용\s*\)|생성형\s*(?:AI|인공\s*지능)\s*(?:를|을)?\s*활용|AI\s*활용\s*[가-힣]{1,8}\s*(?:만들기|쓰기|제작|창작)|인공\s*지능\s*활용\s*[가-힣]{1,8}\s*(?:만들기|제작|창작)/;
/** 관리 방안·원칙을 적은 문장 (그 자체가 AI를 쓰는 평가 설명은 아니다) */
const AI_GUARD_LINE = /보조적|맞춤형\s*피드백|공정성|신뢰성|부정\s*행위|사용\s*기록|채점\s*(에서\s*)?제외|금지|유의|원칙|독자적|출처|개인\s*정보|올바르게\s*활용|올바른\s*(?:AI|인공\s*지능)\s*활용/;
/** 수업 방법(코스웨어·디지털 교과서 등)은 평가가 아니다 */
const AI_TEACHING = /하이러닝|코스웨어|AIDT|디지털\s*교과서|에듀테크\s*(수업|도구)|디지털\s*기반\s*수업|맞춤형\s*학습|학교\s*자율\s*과제/;
/** 인공지능을 배우는 내용·성취수준 문장 */
const AI_CONTENT = /수\s*있다|태도를|인식하|이해하고|원리|윤리|학습\s*데이터|학습용\s*데이터|모델|시스템|로봇|기술의|사회의|분류|알고리즘|활용하기\s*위(?:해|한)|필요한\s*데이터|감정|저작권/;
const ASSESS_WORD = /평가|수행|과제|산출물|보고서|발표|제작|만들|글쓰기|쓰기|창작|작곡|디자인/;

/** 이해하기 32쪽 기본 원칙 세 가지 (문장을 그대로 옮기지 않고 다듬어 쓴 계획서도 잡도록 핵심 낱말로) */
export const AI_PRINCIPLES = {
  assist: new RegExp(String.raw`(?:AI|인공\s*지능)[^\n]{0,80}(?:보조적|공정성\s*[·‧ㆍ,]?\s*신뢰성)|(?:보조적|공정성\s*[·‧ㆍ,]?\s*신뢰성)[^\n]{0,80}(?:AI|인공\s*지능)`),
  observe: /독자적\s*(?:인\s*)?사고|직접\s*(?:학생의\s*)?(?:활동|수행)[^\n]{0,10}관찰|교사가\s*직접[^\n]{0,30}관찰/,
  forbid: new RegExp(String.raw`(?:AI|인공\s*지능)[^\n]{0,80}(?:금지|부정\s*행위)|(?:금지|부정\s*행위)[^\n]{0,80}(?:AI|인공\s*지능)`),
};

export const AI_GUARDS = {
  forbid: AI_PRINCIPLES.forbid,
  record: new RegExp(
    String.raw`사용\s*기록|활용\s*(?:과정|내역|기록|사실|범위와\s*내용)[^\n]{0,40}(?:표기|기록|기재|작성|밝)|(?:AI|인공\s*지능)[^\n]{0,60}출처|출처[^\n]{0,40}(?:AI|인공\s*지능)|프롬프트[^\n]{0,30}(?:기록|기재|표기|작성)`,
  ),
  exclude: /채점\s*(?:에서|대상에서)?\s*제외|평가\s*(?:에서|대상에서)\s*제외|점수를?\s*(?:부여|인정)하지|인정하지\s*않|(?:질의|질문)[^\n]{0,40}(?:답변|답하|설명)[^\n]{0,12}(?:못|않)/,
};

/** 교수·학습 운영 계획(머리글에 월·주·차시)인 표 */
const isScheduleTable = (t: ParsedTable) => (t.rows[0] ?? []).some((h) => /^(월|주|시기|차시|주차)$/.test(norm(h)));

function findAiUse(doc: ParsedDocument, from: number, to: number, assessTables: Set<number>, text: string): AiUse {
  const uses: AiUse['uses'] = [];
  for (let ti = from; ti < to; ti++) {
    const t = doc.tables[ti];
    if (!t) continue;
    const sched = isScheduleTable(t);
    t.rows.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (!cell || isCont(t, r, c)) return;
        for (const line of cell.split(/\n|(?<=다\.)\s+|(?<=함\.)\s+|\s*[·•∙▸]\s*/)) {
          const s = line.replace(/\s+/g, ' ').trim();
          if (s.length < 6) continue;
          const tagged = AI_TAG.test(s);
          if (!tagged && !AI_MAKE.test(s)) continue;
          if (AI_GUARD_LINE.test(s) || AI_TEACHING.test(s)) continue;
          if (!/생성형|GPT|뤼튼|Gemini|제미나이|코파일럿|Copilot/.test(s) && AI_CONTENT.test(s)) continue;
          // 성취기준 문장 자체는 평가 방법 설명이 아니다
          if (/^\[?\s*\d{1,2}\s*[가-힣]{1,4}\s*\d{2}\s*-\s*\d{2}\s*\]/.test(s)) continue;
          // 수업 계획 표에서는 '평가'라고 적은 줄만
          if (sched ? !/평가/.test(s) : !assessTables.has(ti) && !ASSESS_WORD.test(s)) continue;
          if (!uses.some((u) => u.text === s)) uses.push({ text: s.slice(0, 160), ref: ref('plan', ti, r, c) });
        }
      }),
    );
  }
  return {
    uses,
    principles: { assist: AI_PRINCIPLES.assist.test(text), observe: AI_PRINCIPLES.observe.test(text), forbid: AI_PRINCIPLES.forbid.test(text) },
    notices: { record: AI_GUARDS.record.test(text), exclude: AI_GUARDS.exclude.test(text) },
  };
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
      // 머리 칸에 숫자가 들어 있거나("5% 논술형 반드시 포함") 값 칸이 기호(•)뿐이면 비율을 확정할 수 없다
      if (/\d\s*%/.test(row[0] ?? '') || row.slice(1).some((x) => /^[•●○◦·∙]$/.test((x ?? '').trim()))) return;
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
