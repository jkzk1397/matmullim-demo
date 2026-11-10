// 평가 시기: 계획서 요약표의 '평가 시기' 칸("4월 2주", "9월 4주~10월 1주", "상시")을 주 단위로 읽고,
// 한 학교·학년·학기의 여러 교과 계획을 한 달력에 놓는다.
// 근거: 경기도교육청 「2026학년도 중학교 학업성적관리 시행지침」 8쪽 Ⅲ.3.나.11), 12쪽 Ⅲ.3.라.7)
//       「2026학년도 중등 학생평가 및 학업성적관리 이해하기」 28쪽 Ⅲ.3.나.3) "평가 시기는 주 단위로 구체적으로 제시합니다."

/** 한 주: 월(1~12)과 그 달의 몇째 주(1~5) */
export type Week = { m: number; w: number };
export type WhenKind = 'week' | 'range' | 'long' | 'month' | 'always' | 'blank' | 'other';
export type When = { kind: WhenKind; weeks: Week[]; raw: string };

const ORD: Record<string, number> = { 첫: 1, 둘: 2, 셋: 3, 넷: 4, 다섯: 5 };
/** 범위를 펼쳤을 때 이보다 길면 '학기 내내'로 본다 (한 평가가 실제로 치러지는 주를 알 수 없음) */
export const LONG_WEEKS = 6;

const half = (s: string) => s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).replace(/[～〜∼]/g, '~').replace(/[–—‒−]/g, '-');

/** 학기 안에서 주의 순서 (9월 1주 < 9월 5주 < 10월 1주). 1·2월은 앞 학년도 겨울로 보아 뒤에 놓는다. */
export const weekIndex = (x: Week) => ((x.m <= 2 ? x.m + 12 : x.m) * 10) + x.w;
export const weekLabel = (x: Week) => `${x.m}월 ${x.w}주`;
const key = (x: Week) => `${x.m}-${x.w}`;

/** (m1,w1)부터 (m2,w2)까지 주를 펼친다. 달이 바뀌면 앞 달은 5주까지 본다. */
function expand(a: Week, b: Week): Week[] {
  if (weekIndex(b) < weekIndex(a)) return [a];
  const out: Week[] = [];
  let cur = { ...a };
  for (let guard = 0; guard < 60; guard++) {
    out.push({ ...cur });
    if (cur.m === b.m && cur.w === b.w) break;
    if (cur.m !== b.m && cur.w >= 5) cur = { m: cur.m === 12 ? 1 : cur.m + 1, w: 1 };
    else cur = { m: cur.m, w: cur.w + 1 };
  }
  return out;
}

/** 평가 시기 칸 하나를 읽는다. 여러 번(“3월 2주, 5월 1주”)이면 모든 주를 담는다. */
export function parseWhen(raw0: string): When {
  const raw = (raw0 ?? '').trim();
  const s = half(raw).replace(/\s+/g, '');
  if (!s || /^[-·.∙ㆍ­]+$/.test(s) || /^[\u{f0000}-\u{fffff}]+$/u.test(s)) return { kind: 'blank', weeks: [], raw };
  // "6월 5주(7월 1주)"처럼 괄호 안에 같은 주를 다르게 적은 것은 뺀다. "상시(3월4주~6월4주)"는 상시로 본다
  if (/상시|수시|학기중|연중|매차시|매시간|수업시간마다|과정중/.test(s)) return { kind: 'always', weeks: [], raw };
  const t = s.replace(/\((\d{1,2})월\d주\)/g, '').replace(/(\d{1,2})월(첫|둘|셋|넷|다섯)째주/g, (_, m, o) => `${m}월${ORD[o]}주`).replace(/(첫|둘|셋|넷|다섯)째주/g, (_, o) => `${ORD[o]}주`);
  const weeks: Week[] = [];
  let ranged = false;
  // 범위: "9월4주~10월1주", "3월2주~6월3주", "10월1주-2주", "3월3~4주", "9월1-2주", "4월1주/2주"
  // 주 숫자 뒤에는 '주'나 범위 기호가 와야 한다 ("11월 23일" 같은 날짜를 주로 읽지 않게)
  const re = /(\d{1,2})월(\d)(?:주|(?=[~\-/]))(?:([~\-/])(?:(\d{1,2})월)?(\d)주)?/g;
  for (const m of t.matchAll(re)) {
    const a = { m: Number(m[1]), w: Number(m[2]) };
    if (a.m < 1 || a.m > 12 || a.w < 1 || a.w > 5) continue;
    if (m[3] && m[5]) {
      const b = { m: m[4] ? Number(m[4]) : a.m, w: Number(m[5]) };
      if (b.w < 1 || b.w > 5 || b.m < 1 || b.m > 12) { weeks.push(a); continue; }
      if (m[3] === '/') { weeks.push(a, b); continue; }
      ranged = true;
      weeks.push(...expand(a, b));
    } else weeks.push(a);
  }
  const uniq = [...new Map(weeks.map((x) => [key(x), x])).values()].sort((x, y) => weekIndex(x) - weekIndex(y));
  if (uniq.length) {
    if (ranged && uniq.length > LONG_WEEKS) return { kind: 'long', weeks: uniq, raw };
    return { kind: ranged || uniq.length > 1 ? 'range' : 'week', weeks: uniq, raw };
  }
  if (/\d{1,2}월/.test(t)) return { kind: 'month', weeks: [], raw };
  return { kind: 'other', weeks: [], raw };
}

/** 주 단위로 구체적으로 적은 것인가 (이해하기 28쪽) */
export const isWeekSpecific = (w: When) => w.kind === 'week' || w.kind === 'range';

// ---------- 학교 달력 ----------

export type CalendarItem = { subject: string; name: string; written: boolean; when: When; reviewId: string };
/** perf: 그 주에 수행평가가 있는 교과 수 (같은 교과의 평가 여러 개는 한 교과로 센다) */
export type CalendarWeek = { week: Week; items: CalendarItem[]; perf: number };
export type Calendar = { weeks: CalendarWeek[]; subjects: string[]; unplaced: CalendarItem[]; peak?: CalendarWeek };

/**
 * 같은 학교·학년·학기의 계획을 한 달력에 놓는다. 수행평가는 그 평가가 걸친 모든 주에 놓고,
 * 주마다 수행평가가 있는 교과 수를 센다. '학기 내내'(long)·상시·월만 적은 것은 주에 놓지 않고 따로 둔다.
 */
export function buildCalendar(items: CalendarItem[]): Calendar {
  const by = new Map<string, CalendarWeek>();
  const unplaced: CalendarItem[] = [];
  for (const it of items) {
    if (it.when.kind === 'week' || it.when.kind === 'range') {
      for (const w of it.when.weeks) {
        const k = key(w);
        if (!by.has(k)) by.set(k, { week: w, items: [], perf: 0 });
        by.get(k)!.items.push(it);
      }
    } else unplaced.push(it);
  }
  for (const cw of by.values()) cw.perf = new Set(cw.items.filter((i) => !i.written).map((i) => i.subject)).size;
  const weeks = [...by.values()].sort((a, b) => weekIndex(a.week) - weekIndex(b.week));
  const subjects = [...new Set(items.map((i) => i.subject))];
  const peak = weeks.reduce<CalendarWeek | undefined>((p, w) => (!p || w.perf > p.perf ? w : p), undefined);
  return { weeks, subjects, unplaced, peak };
}

/** 수행평가가 있는 교과가 min개 이상인 주 */
export const busyWeeks = (cal: Calendar, min: number) => cal.weeks.filter((w) => w.perf >= min);
