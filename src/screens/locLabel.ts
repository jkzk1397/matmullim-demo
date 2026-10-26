import { fillMerged } from '../domain/extract';
import type { CellRef, ParsedDocument } from '../domain/types';

const clean = (x: string) => (x ?? '').replace(/\s+/g, ' ').replace(/\((교육과정)\)\s*/g, '').trim();

/** 짝이 없는 괄호를 지운다: "만점(반영비율" → "만점 반영비율" */
export function balanceParens(s: string): string {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '）': '（' };
  const opens = new Set(Object.values(pairs));
  const keep = new Array(s.length).fill(true);
  const stack: { ch: string; i: number }[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (opens.has(ch)) stack.push({ ch, i });
    else if (pairs[ch]) {
      if (stack.length && stack[stack.length - 1].ch === pairs[ch]) stack.pop();
      else keep[i] = false;
    }
  }
  for (const o of stack) keep[o.i] = false;
  return [...s].map((ch, i) => (keep[i] ? ch : ' ')).join('').replace(/\s+/g, ' ').trim();
}

/** 머리글처럼 쓸 수 있는 칸인가 (내용 칸·코드 칸·긴 문장은 아님) */
const headerLike = (s: string) => !!s && s.length <= 20 && !/^\[\s*\d/.test(s) && !/^\d+$/.test(s);
/** 그 자체로는 뜻이 없는 머리글 낱말 */
const bareWord = (s: string) => /^(월|주|차시|시기|구분|순|번호|일)$/.test(s);
/** 칸 첫머리의 숫자·범위: "1 [10.5] 대체공휴일" → "1", "3~4주" → "3~4" */
const leadNum = (s: string) => s.match(/^\s*(\d{1,2}(?:\s*[~∼\-–]\s*\d{1,2})?)/)?.[1].replace(/\s+/g, '').replace(/[∼–-]/g, '~');

/** 칸 위치를 사람이 읽는 말로: "평가의 종류와 반영비율 › 영역 만점(반영비율) › 프로그래밍" */
export function locLabel(doc: ParsedDocument, ref: CellRef): string {
  const t = doc.tables[ref.table];
  if (!t) return '';
  const g = fillMerged(t);
  const head = (g[0] ?? []).map(clean);
  const mCol = head.findIndex((h) => /^월$/.test(h));
  const wCol = head.findIndex((h) => /^주$/.test(h));

  let title = balanceParens(clean(t.title).replace(/^[\d.)\]■□▶○●\s-]+/, ''));
  if (/^\d{1,2}\s*월$/.test(title) || bareWord(title) || /^\[\s*\d/.test(title)) title = '';
  if (!title && mCol >= 0) title = '교수·학습 운영 계획';
  title = (title || `표 ${ref.table + 1}`).slice(0, 26);
  if (ref.row === 0) return `${title} 표 머리글`;

  const parts: string[] = [title];
  const row = g[ref.row] ?? [];
  if (mCol >= 0) {
    const m = leadNum(clean(row[mCol] ?? ''));
    const w = wCol >= 0 ? leadNum(clean(row[wCol] ?? '')) : undefined;
    if (m) parts.push(`${m}월${w ? ` ${w}주` : ''}`);
    else if (w) parts.push(`${w}주`);
  } else if (ref.col > 0) {
    const rh = balanceParens(clean(row[0] ?? ''));
    if (headerLike(rh) && !bareWord(rh)) parts.push(rh);
  }
  const ch = balanceParens(clean(head[ref.col] ?? ''));
  if (headerLike(ch) && !bareWord(ch) && !parts.includes(ch)) parts.push(ch);
  return parts.join(' › ');
}
