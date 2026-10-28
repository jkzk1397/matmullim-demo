// 카드를 화면·보고서에 보일 때 공통으로 쓰는 말
import type { Card } from '../domain/types';
import { SEVERITY, STRENGTH_BADGE } from '../ui/helpers';

/** 고칠 칸이 없고, 문장을 새로 넣어야 하는 카드 (결시자 처리기준) */
export const isInsertCard = (c: Card) => c.rule === 'J14';

export const J14_PLACE = '평가의 종류와 반영비율 표 아래';
export const J14_EXAMPLE = '수행평가 결시자는 추후 평가 기회를 부여하되, 부득이하게 실시하지 못할 경우 학업성적관리규정에 따라 인정점을 부여한다.';

/** "확인된 오류 · 사실 확인". 둘이 같으면 한 번만 ("제안") */
export function kindLabel(c: Card): string {
  const a = SEVERITY[c.severity].label;
  const b = STRENGTH_BADGE[c.strength];
  return a === b ? a : `${a} · ${b}`;
}

/** 칸 강조에 쓸 위치 (넣을 곳 카드는 없음) */
export const cellsOf = (c: Card) => (isInsertCard(c) ? [] : c.emphasis?.length ? c.emphasis : c.locations);
