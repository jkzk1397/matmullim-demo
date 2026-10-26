// 브라우저에서 미리 표로 읽어 둔 문서(JSON)를 맞물림 규칙으로 점검한다. (대량 검증용)
// 사용: npx tsx scripts/eval-docs.ts docs.json 결과.json
import { readFileSync, writeFileSync } from 'fs';
import { extractPublic, isPublicFormat, suggestPublicPairs } from '../src/domain/extract-public';
import { pdfPagesToDoc } from '../src/domain/pdf-text';
import { runChecks } from '../src/domain/rules';
import { splitSections } from '../src/domain/context';
import type { ParsedDocument } from '../src/domain/types';

type Raw = { tag: string; fmt: string; id: string; name: string; title?: string; tables?: ParsedDocument['tables']; pages?: string[] };
const docs: Raw[] = JSON.parse(readFileSync(process.argv[2], 'utf8'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const out: any[] = [];
docs.forEach((d, i) => {
  const doc: ParsedDocument = d.fmt === 'pdf' ? pdfPagesToDoc(d.pages ?? [], d.name, 'plan') : { doc: 'plan', fileName: d.name, title: d.title ?? '', tables: (d.tables ?? []).map((t) => ({ ...t, rows: (t.rows ?? []).map((r) => (r ?? []).map((c) => c ?? '')) })) };
  const sections = splitSections(doc);
  for (const section of sections.length ? sections : [undefined]) {
    const ex = extractPublic(doc, section);
    const res = runChecks({ plan: ex.plan, rubric: ex.rubric, planStandards: ex.planStandards, codeTexts: ex.codeTexts, pairs: suggestPublicPairs(ex.plan, ex.rubric), links: [], format: 'public', context: ex.context });
    out.push({ i, sec: section ? [section.from, section.to] : null, tag: d.tag, fmt: d.fmt, id: d.id, name: d.name, subject: ex.context.subject, grades: ex.context.grades, year: ex.context.year, curriculum: ex.context.curriculum, basis: ex.context.curriculumBasis,
      publicFormat: isPublicFormat(doc), plan: ex.plan.length, rubric: ex.rubric.length, codes: ex.codeTexts?.length ?? 0, std: ex.planStandards.length,
      cards: res.cards.filter((c) => c.rule !== 'J6' && c.rule !== 'S5').map((c) => ({ key: c.key, rule: c.rule, severity: c.severity, title: c.title, quote: c.quote.slice(0, 400) })) });
  }
});
writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
const by = (f: (r: (typeof out)[number]) => boolean) => out.filter(f).length;
console.log(`문서 ${out.length} · 요약표 읽음 ${by((r) => r.plan > 0)} · 경고 있는 문서 ${by((r) => r.cards.length > 0)}`);
