import { Fragment, useMemo, useState } from 'react';
import { calendarColumns as columns, calendarsFor, SPREAD_BASIS, type SchoolCalendar } from '../domain/school';
import { weekLabel, type CalendarItem, type Week } from '../domain/schedule';
import type { Review } from '../domain/workspace';
import { Icon } from '../ui/primitives';

const THRESHOLDS = [3, 4, 5];

const key = (w: Week) => `${w.m}-${w.w}`;
const short = (s: string) => s.replace(/\((논술형|서술형|선택형|프로젝트|포트폴리오)\)/g, '').replace(/\s+/g, ' ').trim();
/** "역사 역사 신문 만들기"처럼 평가 이름이 교과 이름으로 시작하면 교과를 한 번만 */
const named = (i: CalendarItem) => (short(i.name).startsWith(i.subject) ? short(i.name) : `${i.subject} ${short(i.name)}`);

export default function CalendarView({ reviews }: { reviews: Review[] }) {
  const cals = useMemo(() => calendarsFor(reviews), [reviews]);
  const [pick, setPick] = useState(0);
  const [min, setMin] = useState(5);
  if (!cals.length)
    return (
      <section className="rounded-xl bg-paper px-6 py-10 text-center shadow-card">
        <p className="text-body font-bold text-ink">같은 학년·학기 계획이 두 교과 이상 있어야 달력을 그려요</p>
        <p className="mt-1 text-help text-ink-3">전 교과 합본 파일이나, 같은 학년의 교과별 파일을 함께 올려 주세요. 요약표의 ‘평가 시기’ 칸을 읽어요.</p>
      </section>
    );
  const sc = cals[Math.min(pick, cals.length - 1)];
  return (
    <div className="flex flex-col gap-4">
      {cals.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {cals.map((c, i) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={i === pick}
              onClick={() => setPick(i)}
              className={`rounded-full px-3.5 py-1.5 text-help font-bold ${i === pick ? 'bg-brand-navy text-white' : 'bg-paper text-ink-2 shadow-[inset_0_0_0_1px_#e3e7ed] hover:bg-canvas'}`}
            >
              {c.title} · {c.subjects.length}개 교과
            </button>
          ))}
        </div>
      )}
      <Grid sc={sc} min={min} setMin={setMin} />
    </div>
  );
}

function Grid({ sc, min, setMin }: { sc: SchoolCalendar; min: number; setMin: (n: number) => void }) {
  const cols = columns(sc);
  const perWeek = new Map(sc.cal.weeks.map((w) => [key(w.week), w]));
  const perf = sc.items.filter((i) => !i.written);
  const busy = sc.cal.weeks.filter((w) => w.perf >= min);
  const cellOf = (subject: string, w: Week): CalendarItem[] => (perWeek.get(key(w))?.items ?? []).filter((i) => i.subject === subject);
  const months: { m: number; n: number }[] = [];
  for (const w of cols) {
    const last = months[months.length - 1];
    if (last && last.m === w.m) last.n++;
    else months.push({ m: w.m, n: 1 });
  }
  const grid = { gridTemplateColumns: `148px repeat(${cols.length}, minmax(30px, 1fr))` };
  const peak = sc.cal.peak;
  return (
    <section className="overflow-hidden rounded-xl bg-paper shadow-card">
      <div className="flex items-end justify-between gap-4 border-b border-line px-5 py-4 narrow:flex-col narrow:items-start narrow:px-4">
        <div>
          <h2 className="text-key font-extrabold text-ink">
            {sc.title} 수행평가 달력
            {peak && peak.perf >= min && (
              <span className="ml-2 text-sev-red">
                {weekLabel(peak.week)}에 {peak.perf}개 교과
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-help text-ink-3">
            {sc.subjects.length}개 교과 · 수행평가 {perf.length}개 · 계획서 요약표의 ‘평가 시기’ 칸으로 그렸어요
          </p>
        </div>
        <div className="flex items-center gap-2 text-help font-bold text-ink-2" role="group" aria-label="몰린 주 기준">
          같은 주
          {THRESHOLDS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={n === min}
              onClick={() => setMin(n)}
              className={`h-8 min-w-8 rounded-lg px-2 ${n === min ? 'bg-brand-navy text-white' : 'bg-paper shadow-[inset_0_0_0_1px_#e3e7ed] hover:bg-canvas'}`}
            >
              {n}
            </button>
          ))}
          개 교과 이상 표시
        </div>
      </div>

      <div className="overflow-x-auto px-5 py-4 narrow:px-4">
        <div className="grid min-w-[760px] text-help" style={grid}>
          <div />
          {months.map((mo, i) => (
            <div key={i} className="border-l border-line pb-1 pl-1.5 font-bold text-ink-2" style={{ gridColumn: `span ${mo.n}` }}>
              {mo.m}월
            </div>
          ))}
          <div className="py-1 text-ink-3">주</div>
          {cols.map((w) => (
            <div key={key(w)} className={`py-1 text-center text-ink-3 ${w.w === 1 ? 'border-l border-line' : ''}`}>
              {w.w}
            </div>
          ))}
          <div className="flex items-center py-1.5 font-bold text-ink">교과 수</div>
          {cols.map((w) => {
            const n = perWeek.get(key(w))?.perf ?? 0;
            const hot = n >= min;
            return (
              <div key={key(w)} className={`mx-0.5 flex items-center justify-center rounded-md py-1.5 font-extrabold tabular-nums ${hot ? 'bg-sev-red text-white' : n ? 'text-ink' : 'text-line'}`}>
                {n || '·'}
              </div>
            );
          })}
          {sc.subjects.map((s) => (
            <Fragment key={s}>
              <div className="flex items-center truncate border-t border-line-2 py-1.5 pr-2 font-bold text-ink">{s}</div>
              {cols.map((w) => {
                const its = cellOf(s, w);
                const p = its.filter((i) => !i.written);
                const x = its.filter((i) => i.written);
                const hot = (perWeek.get(key(w))?.perf ?? 0) >= min;
                return (
                  <div key={key(w)} className={`flex items-center justify-center border-t border-line-2 py-1.5 ${hot ? 'bg-[#fdecef]' : ''}`} title={its.map((i) => `${i.written ? '[정기시험] ' : ''}${i.name} (${i.when.raw.replace(/\s+/g, ' ')})`).join('\n') || undefined}>
                    {p.length > 0 && <span className={`flex h-5 min-w-5 items-center justify-center rounded px-1 text-[12px] font-extrabold text-white ${hot ? 'bg-sev-red' : 'bg-brand-navy'}`}>{p.length > 1 ? p.length : ''}</span>}
                    {!p.length && x.length > 0 && <span className="h-5 w-5 rounded border-2 border-brand-navy" aria-label="정기시험" />}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-help text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-4 w-4 rounded bg-brand-navy" aria-hidden /> 수행평가
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-4 w-4 rounded border-2 border-brand-navy" aria-hidden /> 정기시험
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-4 w-4 rounded bg-sev-red" aria-hidden /> 같은 주 {min}개 교과 이상
          </span>
          <span>여러 주에 걸친 평가는 걸친 주마다 셉니다 · 칸 안 숫자는 같은 주에 그 교과 수행평가가 여러 개</span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_380px] gap-5 border-t border-line px-5 py-4 narrow:grid-cols-1 narrow:px-4">
        <div>
          <h3 className="text-body font-bold text-ink">{busy.length ? `${min}개 교과 이상 수행평가가 몰린 주 ${busy.length}곳` : `같은 주에 ${min}개 교과 이상 수행평가가 있는 주는 없어요`}</h3>
          <ul className="mt-2 space-y-2">
            {busy.map((w) => (
              <li key={key(w.week)} className="text-help text-ink">
                <b className="font-extrabold text-sev-red">
                  {weekLabel(w.week)} · {w.perf}개 교과
                </b>{' '}
                <span className="text-ink-2">{w.items.filter((i) => !i.written).map(named).join(' · ')}</span>
              </li>
            ))}
          </ul>
          {sc.cal.unplaced.filter((i) => !i.written).length > 0 && (
            <p className="mt-3 text-help text-ink-3">
              주에 놓지 않은 평가 (상시·학기 내내·달만 적음): {sc.cal.unplaced.filter((i) => !i.written).map((i) => `${named(i)}(${i.when.raw.replace(/\s+/g, ' ') || '빈칸'})`).join(', ')}
            </p>
          )}
        </div>
        <div className="rounded-lg border-l-4 border-brand-navy bg-brand-blue-50 px-3 py-2">
          <div className="text-help font-bold text-brand-navy">근거 · {SPREAD_BASIS.source}</div>
          {SPREAD_BASIS.quotes.map((q) => (
            <p key={q.page} className="mt-1 text-help text-ink">
              <span className="font-bold text-ink-2">{q.page}</span> “{q.text}”
            </p>
          ))}
          <p className="mt-1.5 text-help text-ink-2">몇 개부터 많은지 정한 수치는 지침에 없어요. 학년·교과협의회에서 정한 기준으로 보세요.</p>
          <a href={SPREAD_BASIS.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-help font-bold text-brand-blue hover:underline">
            원문 열기 {Icon.link()}
          </a>
        </div>
      </div>
    </section>
  );
}
