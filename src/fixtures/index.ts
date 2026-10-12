import type { ParsedDocument } from '../domain/types';
import errorPlan from './error/plan.json';
import errorRubric from './error/rubric.json';
import fixedPlan from './fixed/plan.json';
import fixedRubric from './fixed/rubric.json';
import normalPlan from './normal/plan.json';
import normalRubric from './normal/rubric.json';

export type SampleId = 'error' | 'fixed' | 'normal';

export const SAMPLES: Record<SampleId, { label: string; desc: string; plan: ParsedDocument; rubric: ParsedDocument }> = {
  error: { label: '오류판', desc: '배점 불일치·없는 코드·분량 채점기준이 들어 있어요', plan: errorPlan as ParsedDocument, rubric: errorRubric as ParsedDocument },
  fixed: { label: '수정판', desc: '오류판을 교사가 고친 문서예요', plan: fixedPlan as ParsedDocument, rubric: fixedRubric as ParsedDocument },
  normal: { label: '정상판', desc: '문제가 없는 문서예요', plan: normalPlan as ParsedDocument, rubric: normalRubric as ParsedDocument },
};
