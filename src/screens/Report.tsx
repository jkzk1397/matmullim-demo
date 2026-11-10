import { useState } from 'react';
import { packFor, RULE_PACKS } from '../domain/rulepacks';
import { calendarColumns, calendarsFor, SPREAD_BASIS, type SchoolCalendar } from '../domain/school';
import { weekLabel } from '../domain/schedule';
import { curriculumLabel, DB_SOURCES, STANDARD_COUNT } from '../domain/standards';
import type { Severity } from '../domain/types';
import { counts, resolvedCards, sectionLabel, type Review } from '../domain/workspace';
import { SEVERITY } from '../ui/helpers';
import { Button, Icon } from '../ui/primitives';
import { insertPlace, isInsertCard, kindLabel } from './cardInfo';
import { locLabel } from './locLabel';
import { STATUS_LABEL, statusOf } from './Overview';

const ORDER: Severity[] = ['red', 'orange', 'gray', 'yellow'];
const fmt = (d: Date) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const fmtDay = (d: Date) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
const STD_TOTAL = STANDARD_COUNT['2015'] + STANDARD_COUNT['2022'];
const STD_LABEL = `2015·2022 개정 교육과정 성취기준 (교육부 고시 제2015-74호·제2022-33호) ${STD_TOTAL.toLocaleString()}개`;
const DATA_CREDIT = `성취기준 데이터: ${[DB_SOURCES['2015'], DB_SOURCES['2022']].map((x) => x.split(' via')[0].replace(/\s*\(MIT\)/, '')).join(', ')} (MIT)`;

const score = (r: Review) => {
  const n = counts(r);
  return n.red * 10000 + n.orange * 100 + n.gray + (r.ex.plan.length ? 0 : 50);
};
const hasProblem = (r: Review) => {
  const n = counts(r);
  return n.red + n.orange > 0;
};

export default function Report({ reviews, onBack, cover = false }: { reviews: Review[]; onBack: () => void; cover?: boolean }) {
  const now = new Date();
  const [onlyProblems, setOnlyProblems] = useState(false);
  // 심각한 순 (같으면 들어온 순서)
  const sorted = reviews.map((r, i) => ({ r, i })).sort((a, b) => score(b.r) - score(a.r) || a.i - b.i).map((x) => x.r);
  const detail = cover && onlyProblems ? sorted.filter(hasProblem) : sorted;
  return (
    <div className="flex-1 overflow-auto bg-[#eef1f5] py-6 narrow:py-4 print:overflow-visible print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex w-[860px] items-center justify-between gap-4 narrow:w-[calc(100%-24px)] narrow:flex-wrap narrow:gap-3 print:hidden">
        <button type="button" onClick={onBack} className="rounded-lg px-2 py-1 text-help font-bold text-brand-blue hover:bg-brand-blue-50">
          ← {cover ? '전체 현황' : '점검 화면'}
        </button>
        <div className="flex items-center gap-4 narrow:flex-wrap narrow:gap-3">
          {cover && (
            <label className="flex cursor-pointer items-center gap-2 text-help font-bold text-ink-2">
              <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} className="h-4 w-4 accent-brand-navy" />
              문제 있는 교과만 ({sorted.filter(hasProblem).length}개)
            </label>
          )}
          <Button variant="primary" onClick={() => window.print()}>
            {Icon.print()} 인쇄 · PDF로 저장
          </Button>
        </div>
      </div>
      {cover && <CoverPage reviews={sorted} now={now} />}
      {cover && calendarsFor(reviews).map((sc) => <CalendarPage key={sc.id} sc={sc} />)}
      {detail.map((r, i) => (
        <ReportPage key={r.id} r={r} now={now} breakBefore={cover || i > 0} />
      ))}
      {cover && onlyProblems && detail.length === 0 && (
        <p className="mx-auto w-[860px] text-center text-body text-ink-3 narrow:w-[calc(100%-24px)] print:hidden">확인된 오류나 지침과 다른 곳이 있는 교과가 없어요.</p>
      )}
    </div>
  );
}

const Page = ({ children, breakBefore }: { children: React.ReactNode; breakBefore?: boolean }) => (
  <article
    className={`mx-auto mb-6 w-[860px] bg-paper px-12 py-10 text-[13px] leading-[1.6] text-ink shadow-[0_2px_10px_rgba(13,43,87,0.10)] narrow:mb-4 narrow:w-[calc(100%-24px)] narrow:px-5 narrow:py-6 print:mb-0 print:w-full print:px-0 print:py-0 print:shadow-none ${
      breakBefore ? 'print:break-before-page' : ''
    }`}
  >
    {children}
  </article>
);

function CoverPage({ reviews, now }: { reviews: Review[]; now: Date }) {
  const files: { id: string; name: string; rs: Review[] }[] = [];
  for (const r of reviews) {
    let f = files.find((x) => x.id === r.source.id);
    if (!f) files.push((f = { id: r.source.id, name: r.source.name, rs: [] }));
    f.rs.push(r);
  }
  const tot = reviews.reduce(
    (a, r) => {
      const n = counts(r);
      return { red: a.red + n.red, orange: a.orange + n.orange, gray: a.gray + n.gray };
    },
    { red: 0, orange: 0, gray: 0 },
  );
  const packs = [...new Set(reviews.map((r) => packFor(r.ex.context?.year)?.source).filter(Boolean))];
  const th = 'border border-[#c5ced8] px-2 py-1.5 text-left font-bold';
  const td = 'border border-[#c5ced8] px-2 py-1.5';
  return (
    <Page>
      <header className="border-b-2 border-brand-navy pb-3">
        <div className="text-[12px] font-bold text-brand-blue">맞물림 · 평가 계획 사전 점검</div>
        <h1 className="mt-1 text-[24px] font-extrabold tracking-[-0.02em]">교수·학습 및 평가 운영 계획 사전 점검 요약</h1>
      </header>
      <table className="mt-4 w-full border-collapse text-[12.5px]">
        <tbody>
          <Row k="점검일" v={fmt(now)} />
          <Row k="대상" v={`파일 ${files.length}개 · 교과 ${reviews.length}개`} />
          <Row k="결과" v={`확인된 오류 ${tot.red}건 · 지침과 다름 ${tot.orange}건 · 확인 필요 ${tot.gray}건`} />
          <Row k="점검 기준" v={[STD_LABEL, ...(packs.length ? packs : RULE_PACKS.map((p) => p.source))].join(' · ')} />
        </tbody>
      </table>

      <h2 className="mt-6 text-[15px] font-extrabold">교과별 결과</h2>
      <div className="narrow:overflow-x-auto">
        <table className="mt-2 w-full table-fixed border-collapse text-[12px] narrow:min-w-[560px]">
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
          <thead>
            <tr className="bg-canvas">
              {['파일', '교과·학년', '확인된 오류', '지침과 다름', '확인 필요', '상태'].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {files.map((f) =>
              f.rs.map((r, i) => {
                const n = counts(r);
                const st = statusOf(r);
                return (
                  <tr key={r.id} className="break-inside-avoid align-top">
                    {i === 0 && (
                      <td rowSpan={f.rs.length} className={`${td} break-all font-bold`}>
                        {f.name}
                      </td>
                    )}
                    <td className={td}>{sectionLabel(r)}</td>
                    <td className={`${td} text-center font-bold ${n.red ? 'text-sev-red' : 'text-ink-3'}`}>{n.red}</td>
                    <td className={`${td} text-center font-bold ${n.orange ? 'text-sev-orange' : 'text-ink-3'}`}>{n.orange}</td>
                    <td className={`${td} text-center ${n.gray ? 'font-bold text-ink-2' : 'text-ink-3'}`}>{n.gray}</td>
                    <td className={`${td} font-bold ${st === 'fix' ? 'text-sev-red' : st === 'guide' ? 'text-sev-orange' : st === 'pass' ? 'text-brand-green' : 'text-ink-2'}`}>
                      {st === 'check' ? `확인 ${n.gray}건` : STATUS_LABEL[st]}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>

      <table className="mt-8 w-full border-collapse text-[12.5px] break-inside-avoid">
        <tbody>
          <tr>
            {['점검자', '확인', '날짜'].map((k) => (
              <td key={k} className="w-1/3 border border-[#c5ced8] px-3 py-3 narrow:px-2">
                <span className="font-bold text-ink-2">{k}</span>
                <span className="ml-2 inline-block w-[150px] border-b border-ink-3 align-bottom narrow:ml-1 narrow:w-10">&nbsp;</span>
                {k !== '날짜' && <span className="ml-1 text-ink-3">(인)</span>}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <footer className="mt-6 border-t border-line pt-3 text-[11.5px] text-ink-3">
        교과별 자세한 지적 사항은 다음 쪽부터 있어요. {fmtDay(now)} 출력
        <div className="mt-1">{DATA_CREDIT}</div>
      </footer>
    </Page>
  );
}

/** 위원회 심의용: 같은 학년·학기 전 교과 수행평가 달력 (요약표 '평가 시기' 칸) */
function CalendarPage({ sc }: { sc: SchoolCalendar }) {
  const cols = calendarColumns(sc);
  const MIN = 5;
  const per = new Map(sc.cal.weeks.map((w) => [`${w.week.m}-${w.week.w}`, w]));
  const busy = sc.cal.weeks.filter((w) => w.perf >= MIN);
  const cell = 'border border-[#c5ced8] text-center';
  return (
    <Page breakBefore>
      <header className="border-b-2 border-brand-navy pb-3">
        <div className="text-[12px] font-bold text-brand-blue">맞물림 · 평가 계획 사전 점검</div>
        <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em]">{sc.title} 수행평가 달력</h1>
        <p className="mt-1 text-[12px] text-ink-3">교과별 계획서 요약표의 ‘평가 시기’ 칸으로 만들었어요. 위 숫자는 그 주에 수행평가가 있는 교과 수이고, 여러 주에 걸친 평가는 걸친 주마다 셉니다.</p>
      </header>
      <div className="narrow:overflow-x-auto">
        <table className="mt-4 w-full table-fixed border-collapse text-[10.5px] narrow:min-w-[640px]">
          <thead>
            <tr className="bg-canvas">
              <th className={`${cell} w-[78px] px-1 py-1 text-left font-bold`}>교과</th>
              {cols.map((w) => (
                <th key={`${w.m}-${w.w}`} className={`${cell} py-1 font-bold ${w.w === 1 ? 'text-ink' : 'text-ink-3'}`}>
                  {w.w === 1 ? `${w.m}월` : ''}
                  <div className="font-medium">{w.w}</div>
                </th>
              ))}
            </tr>
            <tr>
              <th className={`${cell} px-1 py-1 text-left font-bold`}>교과 수</th>
              {cols.map((w) => {
                const n = per.get(`${w.m}-${w.w}`)?.perf ?? 0;
                return (
                  <th key={`${w.m}-${w.w}`} className={`${cell} py-1 font-extrabold ${n >= MIN ? 'bg-sev-red text-white' : n ? 'text-ink' : 'text-ink-3'}`}>
                    {n || ''}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sc.subjects.map((s) => (
              <tr key={s}>
                <td className={`${cell} px-1 py-1 text-left font-bold`}>{s}</td>
                {cols.map((w) => {
                  const its = (per.get(`${w.m}-${w.w}`)?.items ?? []).filter((i) => i.subject === s);
                  const p = its.filter((i) => !i.written).length;
                  const x = its.some((i) => i.written);
                  return (
                    <td key={`${w.m}-${w.w}`} className={`${cell} py-1 font-extrabold`}>
                      {p ? '●'.repeat(Math.min(p, 2)) : x ? '시험' : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px]">
        <b>{busy.length ? `같은 주에 ${MIN}개 교과 이상 수행평가가 있는 주: ` : `같은 주에 ${MIN}개 교과 이상 수행평가가 있는 주는 없어요.`}</b>
        {busy.map((w) => `${weekLabel(w.week)}(${w.perf}개 교과)`).join(', ')}
      </p>
      <div className="mt-3 border-l-4 border-brand-navy bg-brand-blue-50 px-3 py-2 text-[12px]">
        <b>근거</b> · {SPREAD_BASIS.source} {SPREAD_BASIS.quotes[0].page} “{SPREAD_BASIS.quotes[0].text}” 몇 개부터 많은지 정한 수치는 지침에 없어요.
      </div>
    </Page>
  );
}

function ReportPage({ r, now, breakBefore }: { r: Review; now: Date; breakBefore: boolean }) {
  const fixed = resolvedCards(r);
  const cards = [...r.result.cards].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
  const c = r.ex.context;
  const pack = packFor(c?.year);
  return (
    <Page breakBefore={breakBefore}>
      <header className="flex items-start justify-between border-b-2 border-brand-navy pb-3 narrow:flex-col narrow:gap-1.5">
        <div>
          <div className="text-[12px] font-bold text-brand-blue">맞물림 · 평가 계획 사전 점검 결과</div>
          <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em]">{sectionLabel(r)} 교수·학습 및 평가 운영 계획</h1>
        </div>
        <div className="text-right text-[12px] text-ink-3 narrow:text-left">
          점검 {fmt(r.checkedAt)}
          <br />
          출력 {fmt(now)}
        </div>
      </header>

      <table className="mt-4 w-full border-collapse text-[12.5px]">
        <tbody>
          <Row k="문서" v={r.source.name} />
          <Row k="교과 · 학년" v={`${c?.subject ?? '—'} · ${c?.grades.length ? `${c.grades.join('·')}학년` : '—'}${c?.year ? ` · ${c.year}학년도` : ''}${c?.semester ? ` ${c.semester}학기` : ''}`} />
          <Row
            k="적용 교육과정"
            v={c?.curriculum === 'mixed' ? '학년별 2015·2022 개정 혼재' : c?.curriculum ? `${curriculumLabel(c.curriculum)} (${c.curriculumBasis === 'year-grade' ? '학년도·학년으로 판단' : '문서의 성취기준 문장으로 판단'})` : '—'}
          />
          <Row k="점검 기준" v={`${STD_LABEL}${pack ? ` · ${pack.source}` : ''}`} />
        </tbody>
      </table>
      {r.ex.plan.length === 0 && (
        <p className="mt-3 rounded-md bg-[#f4f1e8] px-3 py-2 text-[12.5px] text-ink">
          이 계획서에서 평가 요약표(평가 종류·반영비율)를 읽지 못해 숫자 점검은 못 했어요. 성취기준 코드만 점검했어요.
        </p>
      )}

      <div className="mt-4 grid grid-cols-5 gap-2 narrow:grid-cols-3">
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
        <div className="narrow:overflow-x-auto">
          <table className="mt-2 w-full table-fixed border-collapse text-[12px] narrow:min-w-[600px]">
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
              {cards.map((x, i) => {
                const [sev, str] = kindLabel(x).split(' · ');
                return (
                  <tr key={`${x.key}-${i}`} className="break-inside-avoid align-top">
                    <td className="border border-[#c5ced8] px-2 py-1.5 text-center font-bold">{i + 1}</td>
                    <td className={`border border-[#c5ced8] px-2 py-1.5 font-bold ${SEVERITY[x.severity].text}`}>
                      {sev}
                      {str && <div className="font-medium text-ink-3">{str}</div>}
                    </td>
                    <td className="border border-[#c5ced8] px-2 py-1.5">
                      <div className="font-bold">{x.title}</div>
                      {isInsertCard(x) ? <div className="text-ink-3">넣을 곳: {insertPlace(x)}</div> : x.locations[0] && <div className="text-ink-3">{locLabel(r.doc, x.emphasis?.[0] ?? x.locations[0])}</div>}
                      {x.fix && <div className="mt-0.5 text-ink-2">→ {x.fix}</div>}
                    </td>
                    <td className="border border-[#c5ced8] px-2 py-1.5 text-ink-2">
                      {x.basis.source}
                      {x.basis.page ? ` · ${x.basis.page}` : ''}
                      {x.basis.text && (
                        <div className="mt-0.5 text-ink-3">
                          {x.basis.quoted ? `“${clip(x.basis.text)}”` : <>판단 기준 · {clip(x.basis.text)}</>}
                        </div>
                      )}
                    </td>
                    <td className="border border-[#c5ced8] px-2 py-1.5">
                      {r.memos[x.key] !== undefined ? (
                        <>
                          메모함<div className="text-ink-3">{r.memos[x.key]}</div>
                        </>
                      ) : (
                        '남음'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {r.edits.length > 0 && (
        <>
          <h2 className="mt-6 text-[15px] font-extrabold">
            고친 내용 {r.edits.length}곳 (해결 {fixed.length}건)
          </h2>
          <ul className="mt-2 space-y-1">
            {r.edits.map((e, i) => (
              <li key={`${e.table}-${e.row}-${e.col}-${i}`} className="flex gap-2">
                <span className="w-56 shrink-0 truncate text-ink-3 narrow:w-28">{locLabel(r.doc, { doc: 'plan', table: e.table, row: e.row, col: e.col })}</span>
                <span className="text-sev-red line-through">{e.from.slice(0, 50)}</span>→<span className="font-bold text-brand-green">{e.to.slice(0, 60)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-6 text-[15px] font-extrabold">통과한 점검 {r.result.passed.length}가지</h2>
      <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 narrow:grid-cols-1">
        {r.result.passed.map((p, i) => (
          <li key={`${p.rule}-${i}`} className="flex gap-1.5">
            <span className="text-brand-green">✓</span>
            <span>
              <b>{p.label}</b> · <span className="text-ink-2">{p.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <footer className="mt-8 border-t border-line pt-3 text-[11.5px] text-ink-3">
        이 결과는 교과협의회·학업성적관리위원회 검토 전 사전 점검입니다. 빨강(확인된 오류)은 문서 값으로 확인한 사실이고, 주황·회색은 지침 원문과 함께 교사가 판단할 사항입니다. 학교 학업성적관리규정을 함께 확인하세요.
        <div className="mt-1">{DATA_CREDIT}</div>
      </footer>
    </Page>
  );
}

const clip = (t: string) => (t.length > 120 ? `${t.slice(0, 118)}…` : t);

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <th className="w-32 border border-[#c5ced8] bg-canvas px-2 py-1.5 text-left font-bold narrow:w-24">{k}</th>
      <td className="border border-[#c5ced8] px-2 py-1.5">{v}</td>
    </tr>
  );
}
