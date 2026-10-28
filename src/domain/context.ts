// 문서가 어느 교과·학년·학기·교육과정의 계획인지 판단하고, 여러 교과가 든 파일을 교과별로 나눈다.
import { classifyCode, curriculumFor, extractCodes, lookupStandard, subjectOfCode, type Curriculum } from './standards';
import type { ParsedDocument } from './types';

/** 문서에 쓰이는 교과 이름 → DB 교과명. 긴 이름부터 맞춘다. */
const SUBJECT_ALIASES: [RegExp, string][] = [
  [/생활\s*일본어|일본어/, '생활 일본어'],
  [/생활\s*중국어|중국어/, '생활 중국어'],
  [/생활\s*독일어|독일어/, '생활 독일어'],
  [/생활\s*프랑스어|프랑스어/, '생활 프랑스어'],
  [/생활\s*스페인어|스페인어/, '생활 스페인어'],
  [/생활\s*러시아어|러시아어/, '생활 러시아어'],
  [/생활\s*아랍어|아랍어/, '생활 아랍어'],
  [/생활\s*베트남어|베트남어/, '생활 베트남어'],
  [/진로\s*와?\s*직업|진로/, '진로와 직업'],
  [/기술\s*[·･ㆍ.・\s]?\s*가정|기\s*가/, '기술·가정'],
  [/역사/, '역사'],
  [/국어/, '국어'],
  [/수학/, '수학'],
  [/영어/, '영어'],
  [/과학/, '과학'],
  [/사회/, '사회'],
  [/도덕/, '도덕'],
  [/음악/, '음악'],
  [/미술/, '미술'],
  [/체육/, '체육'],
  [/한문/, '한문'],
  [/정보/, '정보'],
  [/보건/, '보건'],
  [/환경/, '환경'],
];

/** '정보공시', '개인정보' 같은 낱말 때문에 교과명 '정보'를 잘못 찾지 않게 지운다. */
const scrub = (s: string) =>
  s.replace(
    /교\s*수\s*[·ㆍ・･\-\s]?\s*학\s*습|수학\s*여행|정보\s*공시|정보\s*고시|개인\s*정보|정보\s*통신|정보\s*공개|학교\s*정보|교육\s*정보|정보\s*사회|보건\s*실|환경\s*교육|개발\s*환경|진로\s*(교육|활동|연계|탐색|체험)|지역\s*사회|외\s*국\s*어|컴퓨터\s*과학|사회\s*정서/g,
    ' ',
  );

/** 짧은 낱말(교과명 후보)을 DB 교과명으로 */
function mapSubject(word: string): string | undefined {
  const w = word.replace(/\s+/g, '');
  for (const [re, name] of SUBJECT_ALIASES) if (re.test(w)) return name;
  return undefined;
}

/** 제목·머리글에서 교과명: "정보과 교수·학습", "(정보)과", "교과: 정보", "과목 정보" */
export function subjectFromTitle(text: string): string | undefined {
  const t = text.replace(/수학\s*여행|정보\s*공시|개인\s*정보|지역\s*사회|외\s*국\s*어/g, ' ');
  const pats = [
    /(?:^|[\s(\d.\]【「『])([가-힣]{1,6}(?:\s*[·･ㆍ]\s*[가-힣]{1,2})?)\s*\)?\s*과\s*(?:목\s*)?(?:\)\s*)?(?:교\s*수|평\s*가|학년별|성취|수업|운영)/,
    /(?:교\s*과|과\s*목)\s*(?:명)?\s*[:：|]?\s*\(?\s*([가-힣]{1,6}(?:\s*[·･ㆍ]\s*[가-힣]{1,2})?)/,
  ];
  for (const re of pats) {
    for (const m of t.matchAll(new RegExp(re.source, 'g'))) {
      const s = mapSubject(m[1]);
      if (s) return s;
    }
  }
  return undefined;
}

/** 아무 문장에서나 교과명 (마지막 수단) */
export function subjectFromText(text: string): string | undefined {
  const t = scrub(text);
  for (const [re, name] of SUBJECT_ALIASES) if (re.test(t)) return name;
  return undefined;
}

const PLAN_TITLE = /(학년|학기|교과).{0,40}(교수|평가).{0,30}(계획|운영)/;

export type DocContext = {
  subject?: string;
  grades: number[];
  year?: number;
  semester?: number;
  curriculum?: Curriculum | 'mixed';
  /** 교육과정을 무엇으로 판단했는지 */
  curriculumBasis: 'year-grade' | 'codes' | 'unknown';
  title?: string;
  /** 표 번호 → 그 표가 속한 학년 (한 교과 파일에 여러 학년 계획이 섞여 있을 때) */
  tableGrades?: Record<number, number>;
};

/** 표마다 바로 앞의 '○학년' 표지를 따라가며 학년을 매긴다. 표지가 없으면 비워 둔다. */
export function gradesByTable(doc: ParsedDocument, from: number, to: number): Record<number, number> {
  const out: Record<number, number> = {};
  let cur: number | undefined;
  for (let i = from; i < to; i++) {
    const t = doc.tables[i];
    if (!t) continue;
    const marks = [t.title ?? '', ...(t.rows.length <= 3 ? t.rows.flat() : (t.rows[0] ?? []).slice(0, 1))]
      .map((x) => (x ?? '').replace(/\s+/g, ' ').trim())
      .filter((x) => x && x.length <= 80);
    const found = new Set<number>();
    for (const m of marks) for (const g of m.matchAll(/(?:^|[^0-9])([123])\s*학년(?!\s*도)/g)) found.add(Number(g[1]));
    if (found.size === 1) cur = [...found][0];
    else if (found.size > 1) cur = undefined; // 여러 학년을 한 표에 (예: 학년별 반영비율 표)
    if (cur) out[i] = cur;
  }
  return out;
}

function titleLines(doc: ParsedDocument, from = 0, to = doc.tables.length): string[] {
  const out: string[] = [];
  if (from === 0 && doc.title) out.push(doc.title);
  for (let i = from; i < to; i++) {
    const t = doc.tables[i];
    if (!t) continue;
    if (t.title) out.push(t.title);
    // 제목·머리글 표는 보통 6줄 이하 (빈 줄로 높이를 잡은 제목 상자 포함)
    if (t.rows.length <= 6) for (const r of t.rows) for (const c of r) if (c && c.length < 160) out.push(c);
  }
  return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** 문서(또는 표 구간)의 교과·학년·학기·교육과정 */
export function detectContext(doc: ParsedDocument, from = 0, to = doc.tables.length, subjectHint?: string, gradesHint?: number[]): DocContext {
  const lines = titleLines(doc, from, Math.min(to, from + 12));
  const head = lines.filter((l) => PLAN_TITLE.test(l) || /학년도/.test(l)).slice(0, 6);
  const all = [doc.fileName, ...head, ...lines.slice(0, 20)].join(' \n ');
  const year = Number(all.match(/(20\d\d)\s*학년도/)?.[1] ?? all.match(/(20\d\d)/)?.[1]) || undefined;
  const semester = Number(all.match(/([12])\s*학기/)?.[1]) || undefined;
  const grades = new Set<number>();
  for (const m of [...head.join(' '), doc.fileName].join(' ').matchAll(/([123])\s*학년/g)) grades.add(Number(m[1]));
  // "1·2학년", "1, 3학년"
  for (const m of head.join(' ').matchAll(/([123])\s*[,·ㆍ~]\s*([123])\s*학년/g)) { grades.add(Number(m[1])); grades.add(Number(m[2])); }
  // "학교명 | 학년 | 과목 | 학기" 머리글 행과 그 아래 값 행
  const kv = headerValues(doc, from, Math.min(to, from + 8));
  if (kv.grade) for (const g of kv.grade.match(/[123]/g) ?? []) grades.add(Number(g));
  if (gradesHint?.length) { grades.clear(); gradesHint.forEach((g) => grades.add(g)); }
  const semester2 = semester ?? (Number(kv.semester?.match(/[12]/)?.[0]) || undefined);
  const subject = subjectHint ?? (kv.subject ? mapSubject(kv.subject) : undefined) ?? subjectFromTitle([...head, ...lines.slice(0, 12)].join(' \n ')) ?? subjectFromTitle(doc.fileName) ?? dominantSubject(doc, from, to) ?? subjectFromText(doc.fileName);
  // 화면 제목: 계획서 제목 꼴인 줄을 먼저 (문서 끝 안내문이 첫 문단으로 잡히는 경우가 있다)
  const title = head.find((l) => PLAN_TITLE.test(l) && l.length <= 80) ?? head.find((l) => l.length <= 80) ?? head[0];
  const ctx: DocContext = { subject, grades: [...grades].sort(), year, semester: semester2, curriculumBasis: 'unknown', title };
  const tg = gradesByTable(doc, from, to);
  const tgSet = new Set(Object.values(tg));
  if (tgSet.size > 1) { ctx.tableGrades = tg; tgSet.forEach((g) => grades.add(g)); ctx.grades = [...grades].sort(); }
  if (year && grades.size) {
    const set = new Set([...grades].map((g) => curriculumFor(year, g)));
    ctx.curriculum = set.size === 1 ? [...set][0] : 'mixed';
    ctx.curriculumBasis = 'year-grade';
  } else {
    const byCodes = curriculumFromCodes(doc, from, to, subject);
    if (byCodes) { ctx.curriculum = byCodes; ctx.curriculumBasis = 'codes'; }
  }
  return ctx;
}

const KEY_WORDS = /^(학교명?|학기|학년|과목명?|교과명?|학급|대상|지도교사|담당교사|교사|담당|시수|단위|비고)$/;
function headerValues(doc: ParsedDocument, from: number, to: number): { grade?: string; subject?: string; semester?: string } {
  const out: { grade?: string; subject?: string; semester?: string } = {};
  for (let i = from; i < to; i++) {
    const rows = doc.tables[i]?.rows ?? [];
    for (let r = 0; r + 1 < rows.length && r < 4; r++) {
      const head = rows[r].map((x) => (x ?? '').replace(/\s+/g, ''));
      head.forEach((h, c) => {
        const v = (rows[r + 1][c] ?? '').trim();
        if (!v || v.length > 20) return;
        if (h === '학년' && /[123]/.test(v) && !out.grade) out.grade = v;
        if ((h === '과목' || h === '교과' || h === '과목명' || h === '교과명') && !out.subject) out.subject = v;
        if (h === '학기' && !out.semester) out.semester = v;
      });
    }
    // 같은 줄에 "교과 | 정보 | 대상 | 1학년"처럼 이름-값이 번갈아 적힌 표
    for (const row of rows.slice(0, 6)) {
      row.forEach((h0, c) => {
        const h = (h0 ?? '').replace(/\s+/g, '');
        const v = (row[c + 1] ?? '').trim();
        if (!v || v.length > 20 || c + 1 >= row.length || KEY_WORDS.test(v.replace(/\s+/g, ''))) return;
        if ((h === '학년' || h === '대상' || h === '대상학년') && /[123]\s*학년|^[123]$/.test(v) && !out.grade) out.grade = v;
        if ((h === '과목' || h === '교과' || h === '과목명' || h === '교과명') && !out.subject && !/^(과목|교과)/.test(v)) out.subject = v;
        if (h === '학기' && /[12]/.test(v) && !out.semester) out.semester = v;
      });
    }
  }
  return out;
}

/** 학년을 모를 때: 문서의 "[코드] 문장"이 어느 교육과정 원문과 더 닮았는지 */
function curriculumFromCodes(doc: ParsedDocument, from: number, to: number, subject?: string): Curriculum | 'mixed' | undefined {
  let s15 = 0, s22 = 0;
  for (let i = from; i < to; i++)
    for (const row of doc.tables[i]?.rows ?? [])
      for (const cell of row) {
        const m = (cell ?? '').match(/(\[[^\]]{4,14}\])\s*([^\[\n]{10,})/);
        if (!m) continue;
        const code = extractCodes(m[1])[0];
        if (!code || (subject && subjectOfCode(code) !== subject)) continue;
        const a = lookupStandard(code, '2015'), b = lookupStandard(code, '2022');
        const text = m[2];
        const sa = a ? overlap(text, a.text) : 0, sb = b ? overlap(text, b.text) : 0;
        if (sa > 0.7 && sa > sb) s15++;
        else if (sb > 0.7 && sb > sa) s22++;
      }
  if (!s15 && !s22) return undefined;
  if (s15 && s22 && Math.min(s15, s22) / Math.max(s15, s22) > 0.25) return 'mixed';
  return s15 > s22 ? '2015' : '2022';
}

function overlap(a: string, b: string) {
  const clean = (s: string) => s.replace(/[^가-힣A-Za-z0-9]/g, '');
  const x = clean(a), y = clean(b);
  if (!x || !y) return 0;
  const grams = (s: string) => { const g = new Set<string>(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; };
  const A = grams(x.slice(0, y.length + 10)), B = grams(y);
  let n = 0;
  B.forEach((g) => { if (A.has(g)) n++; });
  return n / Math.max(1, B.size);
}

export type SubjectSection = { subject: string; grades: number[]; from: number; to: number; title: string };

/** 표 하나가 "구간 시작" 표지인지: 교과 계획 제목, 또는 "학교명 | 학년 | 과목" 머리글 표 */
function sectionMark(doc: ParsedDocument, i: number): { subject?: string; grades: number[]; title: string } | null {
  const t = doc.tables[i];
  const cells = [t.title, ...(t.rows.length <= 3 ? t.rows.flat() : [])].map((x) => (x ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const c of cells) {
    if (c.length < 140 && PLAN_TITLE.test(c) && !/정보\s*공시/.test(c)) {
      const subject = subjectFromTitle(c);
      if (subject) return { subject, grades: [...c.matchAll(/([123])\s*학년/g)].map((m) => Number(m[1])), title: c };
    }
  }
  const kv = headerValues(doc, i, i + 1);
  if (kv.subject && kv.grade) {
    const subject = mapSubject(kv.subject);
    if (subject) return { subject, grades: (kv.grade.match(/[123]/g) ?? []).map(Number), title: `${kv.grade} ${kv.subject}` };
  }
  return null;
}

/**
 * 한 파일을 교과·학년 구간으로 나눈다. (학년별 전 교과 계획, 한 교과의 학년별 계획이 이어 붙은 파일 등)
 * 교과 계획 제목이나 "학교명 | 학년 | 과목" 머리글 표를 경계로 쓴다. 구간이 하나면 문서 전체.
 */
export function splitSections(doc: ParsedDocument): SubjectSection[] {
  const marks: { i: number; last: number; subject: string; grades: number[]; title: string }[] = [];
  for (let i = 0; i < doc.tables.length; i++) {
    const m = sectionMark(doc, i);
    if (!m?.subject) continue;
    const prev = marks[marks.length - 1];
    // 제목 표 바로 뒤의 머리글 표(학교명|학년|과목)는 같은 구간: 학년만 보탠다.
    // 같은 교과라도 떨어진 곳에서 다른 학년 계획이 다시 시작하면 새 구간 (예: 1학년 계획 + 2학년 계획을 이어 붙인 파일)
    const otherGrade = prev && prev.grades.length && m.grades.length && !m.grades.some((g) => prev.grades.includes(g));
    // 앞 구간이 평가 요약표(반영비율)까지 갖춘 완결된 계획일 때만 나눈다
    const prevComplete = prev && doc.tables.slice(prev.i, i).some((t) => t.rows.some((r) => r.some((c) => /반영\s*비율/.test(c ?? ''))));
    if (prev && prev.subject === m.subject && !(otherGrade && i - prev.last > 2 && prevComplete)) {
      prev.grades = [...new Set([...prev.grades, ...m.grades])].sort();
      prev.last = i;
      continue;
    }
    marks.push({ i, last: i, subject: m.subject, grades: m.grades, title: m.title });
  }
  if (!marks.length) {
    const subject = detectContext(doc).subject ?? dominantSubject(doc);
    return subject ? [{ subject, grades: [], from: 0, to: doc.tables.length, title: doc.title }] : [];
  }
  return marks.map((m, k) => ({ subject: m.subject, grades: m.grades, from: k === 0 ? 0 : m.i, to: marks[k + 1]?.i ?? doc.tables.length, title: m.title }));
}

/** 하위 호환: 교과별로 한 구간씩 (같은 교과 여러 학년은 첫 구간) */
export const splitSubjects = splitSections;

/** 제목으로 교과를 못 찾으면 문서에 가장 많이 나온 교과 코드로 */
export function dominantSubject(doc: ParsedDocument, from = 0, to = doc.tables.length): string | undefined {
  const n = new Map<string, number>();
  for (let i = from; i < to; i++)
    for (const row of doc.tables[i]?.rows ?? [])
      for (const cell of row)
        for (const code of extractCodes(cell ?? '')) {
          const s = subjectOfCode(code);
          if (s && classifyCode(code) !== 'out-of-scope') n.set(s, (n.get(s) ?? 0) + 1);
        }
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
