import { packFor } from '../domain/rulepacks';
import { curriculumLabel, DB_SOURCES, STANDARD_COUNT } from '../domain/standards';
import type { Severity } from '../domain/types';
import { resolvedCards, sectionLabel, type Review } from '../domain/workspace';
import { SEVERITY, STRENGTH_BADGE } from '../ui/helpers';
import { Button, Icon } from '../ui/primitives';
import { locLabel } from './Review';

const ORDER: Severity[] = ['red', 'orange', 'gray', 'yellow'];
const fmt = (d: Date) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function Report({ reviews, onBack }: { reviews: Review[]; onBack: () => void }) {
  const now = new Date();
  return (
    <div className="flex-1 overflow-auto bg-[#eef1f5] py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex w-[860px] items-center justify-between print:hidden">
        <button type="button" onClick={onBack} className="rounded-lg px-2 py-1 text-help font-bold text-brand-blue hover:bg-brand-blue-50">
          ← 점검 화면
        </button>
        <Button variant="primary" onClick={() => window.print()}>
          {Icon.print()} 인쇄 · PDF로 저장
        </Button>
      </div>
      {reviews.map((r, i) => (
        <ReportPage key={r.id} r={r} now={now} breakBefore={i > 0} />
      ))}
    </div>
  );
}

function ReportPage({ r, now, breakBefore }: { r: Review; now: Date; breakBefore: boolean }) {
  const fixed = resolvedCards(r);
  const cards = [...r.result.cards].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
  const c = r.ex.context;
  const pack = packFor(c?.year);
  return (
    <article
      className={`mx-auto mb-6 w-[860px] bg-paper px-12 py-10 text-[13px] leading-[1.6] text-ink shadow-[0_2px_10px_rgba(13,43,87,0.10)] print:mb-0 print:w-full print:px-0 print:py-0 print:shadow-none ${
        breakBefore ? 'print:break-before-page' : ''
      }`}
    >
      <header className="flex items-start justify-between border-b-2 border-brand-navy pb-3">
        <div>
          <div className="text-[12px] font-bold text-brand-blue">맞물림 · 평가 계획 사전 점검 결과</div>
          <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em]">{sectionLabel(r)} 교수·학습 및 평가 운영 계획</h1>
        </div>
        <div className="text-right text-[12px] text-ink-3">
          점검 {fmt(r.checkedAt)}
          <br />
          출력 {fmt(now)}
        </div>
      </header>

      <table className="mt-4 w-full border-collapse text-[12.5px]">
        <tbody>
          <Row k="문서" v={r.source.name} />
          <Row k="교과 · 학년" v={`${c?.subject ?? '—'} · ${c?.grades.length ? `${c.grades.join('·')}학년` : '—'}${c?.year ? ` · ${c.year}학년도` : ''}${c?.semester ? ` ${c.semester}학기` : ''}`} />
          <Row k="적용 교육과정" v={c?.curriculum === 'mixed' ? '학년별 2015·2022 개정 혼재' : c?.curriculum ? `${curriculumLabel(c.curriculum)} (${c.curriculumBasis === 'year-grade' ? '학년도·학년으로 판단' : '문서의 성취기준 문장으로 판단'})` : '—'} />
          <Row k="점검 기준" v={`성취기준 ${STANDARD_COUNT['2015'] + STANDARD_COUNT['2022']}개 (${DB_SOURCES['2022'].split(' via')[0]} · ${DB_SOURCES['2015'].split(' via')[0]})${pack ? ` · ${pack.source}` : ''}`} />
        </tbody>
      </table>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {ORDER.map((s) => (
          <div key={s} className="rounded-lg border border-line px-3 py-2">
            <div className={`text-[12px] font-bold ${SEVERITY[s].text}`}>{SEVERITY[s].label}</div>
            <div className="text-[20px] font-extrabold">{r.result.cards.filter((x) => x.severity === s).length}</div>
          </div>
        ))}
        <div className="rounded-lg border border-line px-3 py-2">
          <div className="text-[12px] font-bold text-brand-green">고친 항목</div>
          <div className="text-[20px] font-extrabold">{fixed.length}</div>
        </div>
      </div>

      <h2 className="mt-6 text-[15px] font-extrabold">지적 사항 {cards.length}건</h2>
      {cards.length === 0 ? (
        <p className="mt-2 text-ink-2">지적 사항이 없습니다.</p>
      ) : (
        <table className="mt-2 w-full table-fixed border-collapse text-[12px]">
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '38%' }} />
            <col style={{ width: '32%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr className="bg-canvas">
              {['번호', '구분', '내용 · 위치', '근거', '처리'].map((h) => (
                <th key={h} className="border border-[#c5ced8] px-2 py-1.5 text-left font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cards.map((x, i) => (
              <tr key={x.key} className="break-inside-avoid align-top">
                <td className="border border-[#c5ced8] px-2 py-1.5 text-center font-bold">{i + 1}</td>
                <td className={`border border-[#c5ced8] px-2 py-1.5 font-bold ${SEVERITY[x.severity].text}`}>
                  {SEVERITY[x.severity].label}
                  <div className="font-medium text-ink-3">{STRENGTH_BADGE[x.strength]}</div>
                </td>
                <td className="border border-[#c5ced8] px-2 py-1.5">
                  <div className="font-bold">{x.title}</div>
                  {x.locations[0] && <div className="text-ink-3">{locLabel(r.doc, x.locations[0])}</div>}
                  {x.fix && <div className="mt-0.5 text-ink-2">→ {x.fix}</div>}
                </td>
                <td className="border border-[#c5ced8] px-2 py-1.5 text-ink-2">
                  {x.basis.source}
                  {x.basis.page ? ` · ${x.basis.page}` : ''}
                  {x.basis.text && <div className="mt-0.5 text-ink-3">“{x.basis.text.length > 120 ? `${x.basis.text.slice(0, 118)}…` : x.basis.text}”</div>}
                </td>
                <td className="border border-[#c5ced8] px-2 py-1.5">{r.memos[x.key] !== undefined ? <>메모함<div className="text-ink-3">{r.memos[x.key]}</div></> : '남음'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {r.edits.length > 0 && (
        <>
          <h2 className="mt-6 text-[15px] font-extrabold">고친 내용 {r.edits.length}곳 (해결 {fixed.length}건)</h2>
          <ul className="mt-2 space-y-1">
            {r.edits.map((e, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-56 shrink-0 truncate text-ink-3">{locLabel(r.doc, { doc: 'plan', table: e.table, row: e.row, col: e.col })}</span>
                <span className="text-sev-red line-through">{e.from.slice(0, 50)}</span>→<span className="font-bold text-brand-green">{e.to.slice(0, 60)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-6 text-[15px] font-extrabold">통과한 점검 {r.result.passed.length}가지</h2>
      <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
        {r.result.passed.map((p) => (
          <li key={p.label} className="flex gap-1.5">
            <span className="text-brand-green">✓</span>
            <span>
              <b>{p.label}</b> · <span className="text-ink-2">{p.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <footer className="mt-8 border-t border-line pt-3 text-[11.5px] text-ink-3">
        이 결과는 교과협의회·학업성적관리위원회 검토 전 사전 점검입니다. 빨강(확인된 오류)은 문서 값으로 확인한 사실이고, 주황·회색은 지침 원문과 함께 교사가 판단할 사항입니다. 학교 학업성적관리규정을 함께 확인하세요.
      </footer>
    </article>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <th className="w-32 border border-[#c5ced8] bg-canvas px-2 py-1.5 text-left font-bold">{k}</th>
      <td className="border border-[#c5ced8] px-2 py-1.5">{v}</td>
    </tr>
  );
}
