// 중학교 성취기준 DB (2015·2022 개정, 전 교과). 데이터는 scripts/build-standards.py로 만든다.
import db from '../data/standards-middle.json';

export type Curriculum = '2015' | '2022';
export type StandardEntry = { code: string; text: string; domain: string; subject: string; curriculum: Curriculum; page?: number | null };

type Raw = { note: string; sources: Record<Curriculum, string>; subjects: Record<string, Record<Curriculum, [string, string, string, number | null][]>> };
const RAW = db as unknown as Raw;

/** 코드 정규화: 공백 제거, 생활 외국어의 '[9생일-01-01]' 꼴을 '[9생일01-01]'로 */
export function normCode(code: string): string {
  return code.replace(/\s+/g, '').replace(/^\[(\d{1,2})([가-힣()]+)-(\d{2})/, '[$1$2$3');
}

const byCurriculum: Record<Curriculum, Map<string, StandardEntry>> = { '2015': new Map(), '2022': new Map() };
const bySubject = new Map<string, Record<Curriculum, StandardEntry[]>>();
/** 코드의 교과 표기(정, 수, 기가, 사(지리), 생일 …) → 교과명 */
const SUBJECT_OF_TOKEN = new Map<string, string>();

for (const [subject, cur] of Object.entries(RAW.subjects)) {
  const lists: Record<Curriculum, StandardEntry[]> = { '2015': [], '2022': [] };
  for (const c of ['2015', '2022'] as Curriculum[]) {
    for (const [code, text, domain, page] of cur[c]) {
      const e: StandardEntry = { code: normCode(code), text, domain, subject, curriculum: c, page };
      byCurriculum[c].set(e.code, e);
      lists[c].push(e);
      const tok = tokenOf(e.code);
      if (tok) SUBJECT_OF_TOKEN.set(tok, subject);
    }
  }
  bySubject.set(subject, lists);
}

export const DB_SOURCES = RAW.sources;
export const SUBJECTS = [...bySubject.keys()];
export const STANDARD_COUNT = { '2015': byCurriculum['2015'].size, '2022': byCurriculum['2022'].size };

export function curriculumLabel(c: Curriculum) {
  return c === '2022' ? '2022 개정' : '2015 개정';
}
export function dbSource(c: Curriculum, subject?: string) {
  const law = c === '2022' ? '교육부 고시 제2022-33호' : '교육부 고시 제2015-74호';
  return `${curriculumLabel(c)} 교육과정(${law}) 중학교${subject ? ` ${subject}` : ''} 성취기준`;
}

/** "[9사(지리)01-02]" → "사(지리)" */
export function tokenOf(code: string): string | undefined {
  return normCode(code).match(/^\[\d{1,2}([가-힣()]+?)\d{2}-\d{2}\]$/)?.[1];
}

export function subjectOfCode(code: string): string | undefined {
  const t = tokenOf(code);
  return t ? SUBJECT_OF_TOKEN.get(t) : undefined;
}

export function isKnownToken(tok: string) {
  return SUBJECT_OF_TOKEN.has(tok);
}

/** 교육과정을 주면 그 교육과정에서, 아니면 2022 → 2015 순으로 찾는다. */
export function lookupStandard(code: string, curriculum?: Curriculum): StandardEntry | undefined {
  const c = normCode(code);
  if (curriculum) return byCurriculum[curriculum].get(c);
  return byCurriculum['2022'].get(c) ?? byCurriculum['2015'].get(c);
}

export function lookupAll(code: string): StandardEntry[] {
  const c = normCode(code);
  return (['2022', '2015'] as Curriculum[]).map((k) => byCurriculum[k].get(c)).filter((x): x is StandardEntry => !!x);
}

export function standardsFor(subject: string, curriculum: Curriculum): StandardEntry[] {
  return bySubject.get(subject)?.[curriculum] ?? [];
}

// 성취기준 코드 모양: [9정03-01], [9사(일사)01-01], [9생일01-01], [10공국1-01-01] 등
const CODE_RE = /\[\s*(\d{1,2})\s*([가-힣][가-힣A-Za-z0-9Ⅰ-Ⅳ·()]*?)\s*-?\s*(\d{2})\s*-\s*(\d{2})(?:\s*-\s*(\d{2}))?\s*\]/g;

/** 텍스트에서 성취기준 코드를 모두 찾아 공백을 없앤 형태로 돌려준다. */
export function extractCodes(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(CODE_RE)) {
    const [, grade, subject, a, b, c] = m;
    const code = `[${grade}${subject}${a}-${b}${c ? `-${c}` : ''}]`;
    if (!out.includes(code)) out.push(code);
  }
  return out;
}

export type CodeStatus = 'valid' | 'other-curriculum' | 'not-in-db' | 'other-subject' | 'out-of-scope';
export type CodeContext = { subject?: string; curriculum?: Curriculum | 'mixed' };

/**
 * 코드 판정.
 * - valid: 적용 교육과정(모르면 어느 쪽이든)의 이 교과 DB에 있음
 * - other-curriculum: 이 교과의 다른 교육과정에만 있음 (예: 2026학년도 2학년 문서에 2015 개정 코드)
 * - not-in-db: 교과 표기는 맞는데 어느 교육과정에도 없는 번호
 * - other-subject: 다른 교과 코드 (융합 수업 등 — 오류로 보지 않음)
 * - out-of-scope: 중학교 교과 표기가 아님 (고교 코드, 학교자율시간 과목 등)
 */
export function classifyCode(code: string, ctx: CodeContext = {}): CodeStatus {
  const c = normCode(code);
  if (!/^\[9[가-힣]/.test(c)) return 'out-of-scope';
  const subject = subjectOfCode(c);
  if (!subject) return 'out-of-scope';
  if (ctx.subject && subject !== ctx.subject) return 'other-subject';
  const in22 = byCurriculum['2022'].has(c), in15 = byCurriculum['2015'].has(c);
  if (!in22 && !in15) return 'not-in-db';
  if (!ctx.curriculum || ctx.curriculum === 'mixed') return 'valid';
  const here = ctx.curriculum === '2022' ? in22 : in15;
  return here ? 'valid' : 'other-curriculum';
}

// ---------- 오자 ----------

const decompose = (ch: string) => {
  const c = ch.charCodeAt(0) - 0xac00;
  if (c < 0 || c > 11171) return null;
  return [Math.floor(c / 588), Math.floor((c % 588) / 28), c % 28];
};

/** 한 글자 차이(자모 하나만 다름)인지 */
function oneJamoApart(a: string, b: string) {
  if (a.length !== b.length || a === b) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const x = decompose(a[i]), y = decompose(b[i]);
    if (!x || !y) return false;
    diff += x.filter((v, k) => v !== y[k]).length;
  }
  return diff === 1;
}

/**
 * 코드 오자 추정: 앞자리 0([09정02-01]), 교과 글자 하나가 자모 하나만 다른 경우([9장03-03] → [9정03-03]).
 * 교과를 알면 그 교과 표기로만 고친다. 고친 코드가 DB에 있어야 한다.
 * '인', '문', '피'처럼 학교자율시간 과목 약칭일 수 있는 글자는 기존 교과 표기와 자모 하나 차이가 아니면 건드리지 않는다.
 */
export function typoOf(code: string, ctx: CodeContext = {}): string | null {
  const m = normCode(code).match(/^\[(0?9)([가-힣()]{1,6})(\d{2})-(\d{2})\]$/);
  if (!m) return null;
  const [, grade, tok, a, b] = m;
  const known = isKnownToken(tok);
  const candidates = [...SUBJECT_OF_TOKEN.entries()]
    .filter(([t, s]) => (!ctx.subject || s === ctx.subject) && (t === tok ? grade === '09' : !known && oneJamoApart(tok, t)))
    .map(([t]) => `[9${t}${a}-${b}]`)
    .filter((c) => lookupStandard(c, ctx.curriculum === 'mixed' ? undefined : ctx.curriculum) || lookupStandard(c));
  return candidates.length === 1 ? candidates[0] : null;
}

// ---------- 교육과정 판단 ----------

/** 중학교: 2022 개정은 2025학년도 1학년, 2026학년도 1·2학년, 2027학년도 전 학년부터 */
export function curriculumFor(year: number, grade: number): Curriculum {
  return year - grade >= 2024 ? '2022' : '2015';
}

// ---------- 하위 호환 ----------

/** 이전 화면 코드가 쓰는 정보과 DB 모양 */
export const STANDARDS_DB = {
  subject: '정보',
  curriculum: dbSource('2022', '정보'),
  source: RAW.sources['2022'],
  standards: standardsFor('정보', '2022'),
};
