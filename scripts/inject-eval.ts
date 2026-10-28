// 오류 주입 검증: 실제 공개 문서에 알려진 오류를 하나씩 넣고, 맞물림이 찾아내는지 잰다. (재현율)
// 사용: npx tsx scripts/inject-eval.ts docs.json 결과.json
// docs.json = 브라우저에서 표로 읽어 둔 문서 배열 (eval-docs.ts와 같은 형식). 원본 문서는 저장소에 넣지 않는다.
import { readFileSync, writeFileSync } from 'fs';
import { splitSections, type SubjectSection } from '../src/domain/context';
import { extractPublic, suggestPublicPairs } from '../src/domain/extract-public';
import { pdfPagesToDoc } from '../src/domain/pdf-text';
import { runChecks } from '../src/domain/rules';
import { packFor } from '../src/domain/rulepacks';
import { classifyCode, lookupAll } from '../src/domain/standards';
import type { Card, CellRef, ParsedDocument } from '../src/domain/types';

type Raw = { tag: string; fmt: string; id: string; name: string; title?: string; tables?: ParsedDocument['tables']; pages?: string[]; paragraphs?: ParsedDocument['paragraphs'] };

const check = (doc: ParsedDocument, section?: SubjectSection) => {
  const ex = extractPublic(doc, section);
  const res = runChecks({ plan: ex.plan, rubric: ex.rubric, planStandards: ex.planStandards, codeTexts: ex.codeTexts, pairs: suggestPublicPairs(ex.plan, ex.rubric), links: [], format: 'public', context: ex.context, essay: ex.essay, absence: ex.absence, malformed: ex.malformed, cells: (r) => doc.tables[r.table]?.rows[r.row]?.[r.col] ?? '' });
  return { ex, cards: res.cards };
};
const clone = (d: ParsedDocument): ParsedDocument => ({ ...d, paragraphs: d.paragraphs?.map((p) => ({ ...p })), tables: d.tables.map((t) => ({ ...t, rows: t.rows.map((r) => [...r]) })) });
const cell = (d: ParsedDocument, r: CellRef) => d.tables[r.table]?.rows[r.row]?.[r.col] ?? '';
const setCell = (d: ParsedDocument, r: CellRef, v: string) => {
  d.tables[r.table].rows[r.row][r.col] = v;
};

type Mutation = { kind: string; expect: Card['rule'][]; desc: string; apply: (d: ParsedDocument) => boolean };

/** 존재하지 않는 번호로 바꾼 코드: [9정03-01] → [9정03-09] 처럼 DB에 없는 번호 */
function wrongNumber(code: string): string | null {
  const m = code.match(/^\[(.+)-(\d{2})\]$/);
  if (!m) return null;
  for (let n = 9; n <= 19; n++) {
    const c = `[${m[1]}-${String(n).padStart(2, '0')}]`;
    if (!lookupAll(c).length) return c;
  }
  return null;
}
/** 교과 글자 오타: [9정03-01] → [9장03-01] (한글 모음 하나 바뀜) */
const JAMO_SWAP: Record<string, string> = { 정: '장', 국: '굮', 수: '스', 영: '연', 과: '고', 사: '서', 역: '억', 도: '두', 기: '가', 체: '채', 음: '은', 미: '마', 진: '잔', 한: '헌' };
function wrongSubject(code: string): string | null {
  const m = code.match(/^\[(\d)([가-힣]+)(.*)\]$/);
  if (!m) return null;
  const ch = m[2][0];
  const to = JAMO_SWAP[ch];
  if (!to) return null;
  const c = `[${m[1]}${to}${m[2].slice(1)}${m[3]}]`;
  return lookupAll(c).length ? null : c;
}

function mutations(doc: ParsedDocument, base: ReturnType<typeof check>): Mutation[] {
  const { ex } = base;
  const ctx = { subject: ex.context.subject, curriculum: ex.context.curriculum === 'mixed' ? undefined : ex.context.curriculum };
  const out: Mutation[] = [];
  const valid = (ex.codeTexts ?? []).find((c) => classifyCode(c.code, ctx) === 'valid' && cell(doc, c.ref).includes(c.code));
  if (valid) {
    const to = wrongNumber(valid.code);
    if (to) out.push({ kind: '성취기준 번호 오기', expect: ['J4'], desc: `${valid.code}→${to}`, apply: (d) => (setCell(d, valid.ref, cell(d, valid.ref).replace(valid.code, to)), true) });
    const to2 = wrongSubject(valid.code);
    if (to2) out.push({ kind: '성취기준 교과 글자 오타', expect: ['J4'], desc: `${valid.code}→${to2}`, apply: (d) => (setCell(d, valid.ref, cell(d, valid.ref).replace(valid.code, to2)), true) });
  }
  // 요약표 반영비율 하나를 바꿔 합계가 100%가 아니게
  const w = ex.plan.find((a) => a.refs?.weightPercent && a.weightPercent !== undefined && !a.incomplete);
  if (w && ex.plan.filter((a) => a.weightPercent !== undefined).length >= 2) {
    const ref = w.refs!.weightPercent!;
    const s = cell(doc, ref);
    const v = String(w.weightPercent);
    // "20점(20%)"처럼 만점과 비율이 한 칸에 있으면 % 앞 숫자만 바꾼다
    const re = new RegExp(`(^|[^\\d.])${v}(?=\\s*%)`);
    if (re.test(s)) out.push({ kind: '반영비율 합계 오류', expect: ['J12'], desc: `${v}%→${w.weightPercent! + 5}%`, apply: (d) => (setCell(d, ref, s.replace(re, `$1${w.weightPercent! + 5}`)), true) });
  }
  // 만점 ↔ 세부 배점 합계 불일치 (만점을 바꿈)
  // 세부기준(채점기준표)과 짝이 있는 수행평가의 요약표 만점을 바꾼다
  const pairs = suggestPublicPairs(ex.plan, ex.rubric);
  const pairedPlan = new Set(Object.values(pairs).filter(Boolean) as string[]);
  const m = ex.plan.find((a) => a.refs?.maxScore && a.maxScore !== undefined && pairedPlan.has(a.id));
  if (m) {
    const ref = m.refs!.maxScore!;
    const s = cell(doc, ref);
    const v = String(m.maxScore);
    const re = new RegExp(`(^|[^\\d.])${v}(?=\\s*점|\\s*$|\\s*\\n)`);
    if (re.test(s)) out.push({ kind: '만점·배점 불일치', expect: ['J12'], desc: `만점 ${v}→${m.maxScore! - 5}`, apply: (d) => (setCell(d, ref, s.replace(re, `$1${m.maxScore! - 5}`)), true) });
  }
  // 논술형 반영비율을 지침 하한 아래로
  // 시도 규칙팩이 적용되는 학년도 문서에서만 (경기 2026)
  const pack = packFor(ex.context.year);
  const e = (ex.essay ?? []).find((x) => x.total >= 30);
  if (e && pack) {
    const s = cell(doc, e.ref);
    const v = String(e.total);
    if (s.includes(v)) out.push({ kind: '논술형 반영비율 미달', expect: ['J13'], desc: `${v}%→15%`, apply: (d) => (setCell(d, e.ref, s.replace(v, '15')), true) });
  }
  // 결시자 처리기준 문장 삭제
  if (pack && ex.absence?.found) {
    out.push({ kind: '결시자 처리기준 누락', expect: ['J14'], desc: '해당 칸 비움', apply: (d) => {
      // 같은 구간에서 결시 관련 문구가 있는 칸을 모두 비운다 (문서에 여러 번 적힌 경우)
      const re = /결시|미응시|인정점|미참여|불참|참여하지\s*못|응시하지|결석|불응시/;
      let n = 0;
      d.tables.forEach((t, ti) => t.rows.forEach((row, r) => row.forEach((c, k) => { if (ti >= (base.ex.subjectRanges[0]?.[0] ?? 0) && ti < (base.ex.subjectRanges[0]?.[1] ?? 0) && re.test(c)) { d.tables[ti].rows[r][k] = ''; n++; } })));
      // 표 밖 본문 문단도 같은 구간이면 지운다
      const [from, to] = base.ex.subjectRanges[0] ?? [0, d.tables.length];
      d.paragraphs = (d.paragraphs ?? []).map((p) => (p.before >= from && p.before <= to && re.test(p.text) ? (n++, { ...p, text: '' }) : p));
      return n > 0;
    } });
  }
  // 채점기준에 '제출 여부' 넣기
  const rub = ex.rubric.flatMap((a) => a.elements).find((el) => el.refs?.rubricText && el.rubricText);
  if (rub) {
    const ref = rub.refs!.rubricText!;
    out.push({ kind: '지양 표현(제출 여부)', expect: ['J7'], desc: '채점기준에 "과제 제출 여부" 추가', apply: (d) => (setCell(d, ref, `${cell(d, ref)}\n과제 제출 여부에 따라 2점`), true) });
  }
  return out;
}

const docs: Raw[] = JSON.parse(readFileSync(process.argv[2], 'utf8'));
type Row = { doc: number; sec: number; subject?: string; kind: string; desc: string; detected: boolean; newRed: number; rules: string[] };
const rows: Row[] = [];
let sections = 0;
docs.forEach((d, i) => {
  const doc: ParsedDocument = d.fmt === 'pdf' ? pdfPagesToDoc(d.pages ?? [], d.name, 'plan') : { doc: 'plan', fileName: d.name, title: d.title ?? '', tables: (d.tables ?? []).map((t) => ({ ...t, rows: (t.rows ?? []).map((r) => (r ?? []).map((c) => c ?? '')) })), paragraphs: d.paragraphs };
  const secs = splitSections(doc);
  (secs.length ? secs : [undefined]).forEach((sec, si) => {
    sections++;
    const base = check(doc, sec);
    if (!base.ex.plan.length) return;
    const baseKeys = new Set(base.cards.map((c) => c.key));
    for (const mu of mutations(doc, base)) {
      const md = clone(doc);
      if (!mu.apply(md)) continue;
      const msecs = splitSections(md);
      const msec = sec ? msecs.find((x) => x.from === sec.from && x.to === sec.to) ?? sec : undefined;
      const after = check(md, msec);
      const fresh = after.cards.filter((c) => !baseKeys.has(c.key));
      const detected = fresh.some((c) => mu.expect.includes(c.rule)) || after.cards.some((c) => mu.expect.includes(c.rule) && !base.cards.some((b) => b.rule === c.rule && b.title === c.title));
      rows.push({ doc: i, sec: si, subject: base.ex.context.subject, kind: mu.kind, desc: mu.desc, detected, newRed: fresh.filter((c) => c.severity === 'red' && !mu.expect.includes(c.rule)).length, rules: fresh.map((c) => `${c.rule}:${c.severity}`) });
    }
  });
});
writeFileSync(process.argv[3], JSON.stringify(rows, null, 1));
const kinds = [...new Set(rows.map((r) => r.kind))];
console.log(`문서 ${docs.length} · 구간 ${sections} · 주입 ${rows.length}건`);
for (const k of kinds) {
  const rs = rows.filter((r) => r.kind === k);
  const det = rs.filter((r) => r.detected).length;
  console.log(`${k.padEnd(16)} ${String(det).padStart(4)}/${String(rs.length).padEnd(4)} ${((det / rs.length) * 100).toFixed(1)}%  (다른 빨강 동반 ${rs.filter((r) => r.newRed).length})`);
}
const det = rows.filter((r) => r.detected).length;
console.log(`전체 ${det}/${rows.length} ${((det / rows.length) * 100).toFixed(1)}%`);
