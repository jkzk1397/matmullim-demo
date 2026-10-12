import db from '../data/standards-info-middle-2022.json';

export type StandardEntry = { code: string; domain: string; text: string; summary: string };

export const STANDARDS_DB = db as {
  subject: string;
  curriculum: string;
  source: string;
  standards: StandardEntry[];
};

const byCode = new Map(STANDARDS_DB.standards.map((s) => [s.code, s]));

export function lookupStandard(code: string): StandardEntry | undefined {
  return byCode.get(code);
}

// 성취기준 코드 모양: [9정03-01], [9수01-01], [10공국1-01-01] 등
const CODE_RE = /\[\s*(\d{1,2})\s*([가-힣][가-힣A-Za-z0-9Ⅰ-Ⅳ·]*?)\s*(\d{2})\s*-\s*(\d{2})(?:\s*-\s*(\d{2}))?\s*\]/g;

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

/** 지원 범위: 2022 개정 중학교 정보. 형식은 DB의 "[9정DD-DD]". */
const INFO_MIDDLE_RE = /^\[9정\d{2}-\d{2}\]$/;

export type CodeStatus = 'valid' | 'not-in-db' | 'out-of-scope';

export function classifyCode(code: string): CodeStatus {
  if (!INFO_MIDDLE_RE.test(code)) return 'out-of-scope';
  return byCode.has(code) ? 'valid' : 'not-in-db';
}
