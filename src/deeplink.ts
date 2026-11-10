// 포스터 QR 바로가기: 주소 끝의 ?try= 값으로 예시 문서를 바로 연다.
// ?try=info → 정보 2학년 2학기 계획서 (점검 전) 점검 화면, ?try=all → 2학년 2학기 전 교과 계획서 전체 현황, ?try=cal → 같은 파일의 수행평가 달력
// 파일은 public/samples/v2/ 아래 (index.json의 file 값과 같아야 한다)
const TRY = new Map<string, string>([
  ['info', '정보_2학년_2학기_점검전.hwpx'],
  ['all', '전과목_2학년_2학기.hwpx'],
  ['cal', '전과목_2학년_2학기.hwpx'],
]);

export const TRY_FILES = [...TRY.values()];

/** 주소의 검색 부분(location.search)에서 열 예시 문서 파일. 모르는 값이면 null (올리기 화면) */
export function trySample(search: string): string | null {
  const key = new URLSearchParams(search).get('try')?.trim().toLowerCase() ?? '';
  return TRY.get(key) ?? null;
}

/** ?try=cal → 전 교과 계획서를 열고 수행평가 달력부터 보인다 */
export function tryView(search: string): 'calendar' | null {
  const key = new URLSearchParams(search).get('try')?.trim().toLowerCase() ?? '';
  return key === 'cal' ? 'calendar' : null;
}
