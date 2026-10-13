// 공시 양식 평가계획(HWPX) 여러 개를 맞물림 규칙으로 한꺼번에 점검한다.
// 사용: npx tsx scripts/eval-public.ts <hwpx 폴더 또는 manifest.json> [결과.json]
// 실제 학교 문서는 저장소에 넣지 않는다(공시 자료라도 학교명이 들어 있음).
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseHwpx } from '../src/domain/hwpx';
import { extractPublic, isPublicFormat, suggestPublicPairs } from '../src/domain/extract-public';
import { runChecks } from '../src/domain/rules';

const src = process.argv[2];
const out = process.argv[3] ?? 'eval-report.json';
const files: { path: string; tag?: string }[] = src.endsWith('.json')
  ? JSON.parse(readFileSync(src, 'utf8')).map((m: { path: string; set?: string; idx?: number }) => ({ path: m.path, tag: `${m.set}#${m.idx}` }))
  : readdirSync(src).filter((f) => f.endsWith('.hwpx')).map((f) => ({ path: join(src, f) }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const report: any[] = [];
for (const f of files) {
  if (!statSync(f.path).isFile()) continue;
  const doc = await parseHwpx(readFileSync(f.path), f.path, 'plan');
  const pub = isPublicFormat(doc);
  const ex = extractPublic(doc);
  const res = runChecks({ plan: ex.plan, rubric: ex.rubric, planStandards: ex.planStandards, codeTexts: ex.codeTexts, pairs: suggestPublicPairs(ex.plan, ex.rubric), links: [], format: 'public' });
  report.push({
    file: f.path.split('/').pop(), tag: f.tag, publicFormat: pub, plan: ex.plan.length, rubric: ex.rubric.length, standards: ex.planStandards.length,
    cards: res.cards.map((c) => ({ key: c.key, rule: c.rule, severity: c.severity, title: c.title, quote: c.quote.slice(0, 300) })),
    passed: res.passed.map((p) => p.label),
  });
}
writeFileSync(out, JSON.stringify(report, null, 1));
const count = (re: RegExp) => report.filter((r) => r.cards.some((c: { key: string }) => re.test(c.key))).length;
console.log(`문서 ${report.length} · 공시 양식 ${report.filter((r) => r.publicFormat).length} · 요약표 읽음 ${report.filter((r) => r.plan).length} · 세부기준 읽음 ${report.filter((r) => r.rubric).length}`);
for (const [k, re] of Object.entries({ 'J12 반영비율 합계': /J12-weight-sum/, 'J12 요약표↔세부 만점': /J12-public-max/, 'J12 만점≠비율': /J12-public-ratio/, 'J4 없는 코드': /J4-missing/, 'J4 오타': /J4-typo/, 'J5 문구': /^J5/, 'J7 지양 표현': /^J7/, 'J6 연결': /^J6/ }))
  console.log(`  ${k}: ${count(re)}건`);
