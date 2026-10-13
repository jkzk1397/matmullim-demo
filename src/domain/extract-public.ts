// 학교알리미 공시용 「교수·학습 및 평가 운영 계획」 양식 읽기.
// 경기도 학교들이 공시하는 계획서는 한 파일에 평가 요약표와 수행평가 세부기준(채점기준)이 함께 있고,
// 요약표는 첫 "열"이 머리글이다(평가 종류 / 반영 비율 / 영역 / 영역 만점(반영비율) / 성취기준 / 평가요소 …).
// 이 파일은 그런 문서를 데모의 데이터 모델(Assessment)로 바꾼다. 점검 규칙은 그대로 rules.ts를 쓴다.
import { fillMerged, normalizeName } from './extract';
import { extractCodes } from './standards';
import type { Assessment, CellRef, CodeText, DocKind, Element, Extraction, ParsedDocument, ParsedTable, PlanStandard } from './types';

const norm = (s: string) => (s ?? '').replace(/\s+/g, '').replace(/[()（）]/g, '');
const ref = (doc: DocKind, table: number, row: number, col: number): CellRef => ({ doc, table, row, col });

const SUBJECTS = /(국어|수학|영어|과학|사회|도덕|역사|음악|미술|체육|기술|가정|한문|중국어|일본어|정보|진로|보건|환경|스페인어|독일어|프랑스어)/;
const PLAN_TITLE = /(학년|학기).{0,30}(교수|평가).{0,30}계획/;
/** '정보공시', '개인정보' 같은 낱말 때문에 교과명 '정보'를 잘못 찾지 않게 지운다. */
const scrub = (s: string) => s.replace(/정보\s*공시|정보\s*고시|개인\s*정보|정보\s*통신/g, '');

const isMaxRow = (label: string) => /^(영역)?만점(반영비율|점)?$/.test(norm(label));

/** 요약표(첫 열에 '영역 만점(반영비율)' 행이 있는 표)가 있으면 공시 양식으로 본다. */
export function isPublicFormat(doc: ParsedDocument): boolean {
  return doc.tables.some((t) => fillMerged(t).some((row) => isMaxRow(row[0] ?? '')));
}

/**
 * 여러 교과가 한 파일에 있는 경우(학년별 전 교과 계획) 정보과 부분의 표만 남긴다.
 * 교과 제목 표/문단(예: "2026학년도 2학기 1학년 정보과 교수·학습 및 평가 운영 계획")을 경계로 쓴다.
 */
export function selectSubject(doc: ParsedDocument, subject = '정보'): { doc: ParsedDocument; ranges: [number, number][] } {
  const marks: { i: number; isTarget: boolean }[] = [];
  doc.tables.forEach((t, i) => {
    const cells = [t.title, ...(t.rows.length <= 2 ? t.rows.flat() : [])].map((x) => scrub((x ?? '').replace(/\s+/g, ' ')));
    for (const c of cells) {
      if (c.length < 120 && PLAN_TITLE.test(c) && SUBJECTS.test(c)) {
        marks.push({ i, isTarget: c.includes(subject) });
        break;
      }
    }
  });
  const ranges: [number, number][] = [];
  for (let m = 0; m < marks.length; m++) {
    if (!marks[m].isTarget || (m > 0 && marks[m - 1].isTarget)) continue;
    let end = doc.tables.length;
    for (let q = m + 1; q < marks.length; q++) if (!marks[q].isTarget) { end = marks[q].i; break; }
    ranges.push([marks[m].i, end]);
  }
  const otherSubjects = marks.some((m) => !m.isTarget);
  if (!ranges.length || !otherSubjects) return { doc, ranges: [[0, doc.tables.length]] };
  const keep = new Set<number>();
  ranges.forEach(([s, e]) => { for (let i = s; i < e; i++) keep.add(i); });
  // 표 번호(원문 위치)를 유지하려고 빼지 않고 빈 표로 바꾼다.
  return { doc: { ...doc, tables: doc.tables.map((t, i) => (keep.has(i) ? t : { title: '', rows: [], spans: [] })) }, ranges };
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
  for (let c = 1; c < width; c++) {
    if (isCont(t, maxRow, c)) continue;
    const head = typeRow >= 0 ? g[typeRow][c] ?? '' : '';
    if (/^(합계|계|총계|총점)$/.test(norm(head))) continue;
    const cell = g[maxRow][c] ?? '';
    let { max, weight } = readScoreCell(cell);
    const plain = (x: string) => (/^\s*\d+(?:\.\d+)?\s*$/.test(x ?? '') ? Number(x) : undefined);
    if (max === undefined && weight === undefined) max = plain(cell);
    if (wRow >= 0 && !isCont(t, wRow, c)) {
      const wc = g[wRow][c] ?? '';
      const w = readScoreCell(wc).weight ?? (/%/.test(wc) ? Number(wc.match(/\d+(?:\.\d+)?/)?.[0]) : plain(wc));
      if (w !== undefined && !Number.isNaN(w)) weight = w;
    }
    if (max === undefined && weight === undefined) continue;
    // 맨 끝 합계 칸("100%", "100점(100%)")은 건너뛴다.
    const nameCell = nameRow >= 0 ? (g[nameRow][c] ?? '').trim() : '';
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
    const written = /정기|지필|선택형/.test(head + name);
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
  return out;
}

/** 수행평가 세부기준: "평가 영역(명) | 이름 | 영역 만점 | 30점" 행이 있는 표와, 그 뒤의 채점기준 표 */
function readRubrics(doc: ParsedDocument): Assessment[] {
  const out: Assessment[] = [];
  let cur: Assessment | null = null;
  doc.tables.forEach((t, ti) => {
    const g = fillMerged(t);
    for (let r = 0; r < g.length; r++) {
      const row = g[r];
      if (/^평가영역(명)?\d*$/.test(norm(row[0] ?? '')) || /^평가영역명?\d*$/.test(norm(row[0] ?? ''))) {
        const mc = row.findIndex((x, j) => j > 0 && /만점/.test(norm(x)));
        if (mc > 0) {
          const name = (row[1] ?? '').trim();
          const mv = readScoreCell(row.slice(mc + 1).find((x) => /\d/.test(x)) ?? '');
          cur = { id: `rubric-${ti}-${r}`, name, maxScore: mv.max, elements: [], source: ref('rubric', ti, r, 1), refs: { maxScore: ref('rubric', ti, r, mc + 1) } };
          out.push(cur);
        }
      }
    }
    if (!cur) return;
    // 채점기준 머리글: 평가요소 + (채점기준|수행 수준|평가 기준)
    const hr = g.findIndex((row) => row.some((x) => /채점기준|수행수준|평가기준/.test(norm(x))) && row.some((x) => /평가요소|평가항목|채점요소|요소/.test(norm(x))));
    if (hr < 0) return;
    const h = g[hr];
    const cEl = h.findIndex((x) => /평가요소|평가항목|채점요소|요소/.test(norm(x)));
    const cCrit = h.findIndex((x) => /채점기준|수행수준|평가기준/.test(norm(x)));
    const cPts = h.findIndex((x) => /배점|점수/.test(norm(x)));
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
        const re = /\[\s*(\d{1,2})\s*([가-힣]{1,3})\s*(\d{1,2})\s*-\s*(\d{2})\s*\]\s*([^[\n]{6,200}?다)\.?(?=\s*(?:\[|\n|$))/g;
        for (const m of (cell ?? '').matchAll(re)) {
          const code = extractCodes(`[${m[1]}${m[2]}${m[3].padStart(2, '0')}-${m[4]}]`)[0];
          if (code) out.push({ code, text: m[5].trim(), ref: ref(kind, ti, r, c) });
        }
      }),
    ),
  );
  return out;
}

export function extractPublic(raw: ParsedDocument): Extraction & { subjectRanges: [number, number][] } {
  const { doc, ranges } = selectSubject(raw);
  const plan: Assessment[] = [];
  doc.tables.forEach((t, ti) => plan.push(...readSummary(t, ti)));
  const rubric = readRubrics(doc);
  // 학기 성취기준: 성취기준별 성취수준 표 등에서 코드와 문장
  const codeTexts = readCodeTexts(doc, 'plan');
  // 정렬 맵의 행 = 이번 학기 교수·학습 운영 계획(머리글에 월·주가 있는 표)에 적힌 정보과 코드. 없으면 문서 전체.
  const isSchedule = (ti: number) => (doc.tables[ti]?.rows[0] ?? []).some((h) => /^(월|주|시기|차시)$/.test(norm(h)));
  const infoCode = (c: string) => /^\[9정\d{2}-\d{2}\]$/.test(c);
  const scheduled = codeTexts.filter((ct) => isSchedule(ct.ref.table) && infoCode(ct.code));
  const planStandards: PlanStandard[] = [];
  for (const ct of scheduled.length ? scheduled : codeTexts.filter((c) => infoCode(c.code)))
    if (!planStandards.some((s) => s.code === ct.code)) planStandards.push({ code: ct.code, text: ct.text, ref: ct.ref });
  // 요약표 성취기준 칸에만 있는 코드도 정렬 맵에 넣는다
  for (const a of plan) for (const e of a.elements) for (const code of e.standards)
    if (infoCode(code) && !planStandards.some((s) => s.code === code)) planStandards.push({ code, text: '', ref: e.refs?.standards ?? a.source });
  const warnings: string[] = [];
  if (!plan.length) warnings.push('공시 양식의 평가 요약표(영역 만점·반영비율)를 찾지 못했어요.');
  // 같은 이름의 평가가 요약표에 두 번 이상 나오면(학년별 반복) 이름 뒤에 표 번호를 붙인다
  const seen = new Map<string, number>();
  for (const a of plan) {
    const k = normalizeName(a.name);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    if (n > 1) a.name = `${a.name} (${n})`;
  }
  return { plan, rubric, planStandards, codeTexts, warnings, subjectRanges: ranges };
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
