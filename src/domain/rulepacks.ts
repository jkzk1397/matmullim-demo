// 시도·학년도별 규칙팩. 지침 원문 문장과 쪽수를 그대로 둔다(지어내지 않는다).
// 지금은 경기도교육청 2026학년도 중학교만 있다. 다른 시도·학년도는 같은 모양으로 추가한다.
// 쪽수는 문서에 찍힌 쪽 번호다(시행지침 PDF는 앞 표지 4쪽을 빼고 센다).

type Quote = { page: string; text: string };

export type RulePack = {
  id: string;
  name: string;
  /** 문서 표지 */
  source: string;
  url: string;
  year: number;
  perfMin: { value: number; page: string; text: string };
  essayMin: { value: number; arts: number; artsSubjects: string[]; page: string; text: string };
  absence: Quote;
  change: Quote;
  /** 정기시험 학기당 횟수 상한 */
  examMax: { value: number } & Quote;
  /** 정기시험을 1회만 볼 때 반영비율 상한 */
  examOne: { value: number } & Quote;
  /** 평가 계획에 넣을 내용 (머리 문장) */
  required: Quote;
  /** 특정 시기 집중 금지 */
  spread: Quote;
  /** 수행평가 특정 시기 집중 (수행평가 운영) */
  spreadPerf: Quote;
  /** 수행평가 AI 도구 활용 */
  ai: Quote;
  /** 과제형 수행평가 금지 */
  homework: Quote;
};

export const GG_2026_MIDDLE: RulePack = {
  id: 'gg-2026-middle',
  name: '경기 2026 중학교',
  source: '경기도교육청 「2026학년도 중학교 학업성적관리 시행지침」',
  url: 'https://www.goe.go.kr/resource/goe/na/bbs_2675/2026/02/f74e1051-ac96-4bd4-979d-6d9d79e5a564.pdf',
  year: 2026,
  perfMin: { value: 30, page: '8쪽 Ⅲ.3.나', text: '수행평가 반영비율은 학기 단위 성적의 30% 이상으로 하되' },
  essayMin: {
    value: 30,
    arts: 20,
    artsSubjects: ['체육', '음악', '미술'],
    page: '7쪽 Ⅲ.3.나',
    text: '논술형 평가의 반영비율은 학기 단위 성적(정기시험과 수행평가 합산점수, 수행평가 100% 실시 과목 점수)의 30% 이상으로 한다.',
  },
  absence: { page: '13쪽 Ⅲ.3.라 15)', text: '수행평가 결시자의 처리기준은 교과협의회를 거쳐 평가 계획에 반영하고' },
  change: { page: '7쪽 Ⅲ.3.나 5)', text: '변경사항이 있는 경우에는 학업성적관리위원회의 심의를 통해 변경사항을 확정하고, 평가 실시 전에 재공지한다.' },
  examMax: { value: 2, page: '4쪽 Ⅲ.3.가 6)가)', text: '정기시험은 학기당 2회 이내로 실시하되, 정기시험의 횟수, 성적 반영비율 등은 학업 성적 평가 결과의 타당성, 공정성 등을 고려하여 결정한다.' },
  examOne: { value: 50, page: '7쪽 Ⅲ.3.나 6)', text: '정기시험을 1회 실시할 경우, 반영비율은 학기 단위 성적의 50% 이하로 한다.' },
  required: { page: '6~7쪽 Ⅲ.3.나 2)', text: '교과학습의 평가(정기시험과 수행평가)를 위하여 평가 계획을 학기별·교과(목)별로 수립하되, 다음의 내용이 포함되도록 한다.' },
  spread: { page: '8쪽 Ⅲ.3.나 11)', text: '평가 계획은 학업성적관리규정과 교과(목)별 성취기준을 근거로 하여 학기별로 수립하되 특정 시기에 평가가 집중되어 학생 부담이 과중되지 않도록 한다.' },
  spreadPerf: { page: '12쪽 Ⅲ.3.라 7)', text: '수행평가는 일제식 정기시험으로 실시할 수 없으며, 특정 시기에 집중되어 학생의 부담이 과중되지 않도록 충분한 사전 검토를 통해 평가 계획을 수립하여 시행한다.' },
  ai: { page: '12쪽 Ⅲ.3.라 5)', text: '수행평가에서 인공지능(AI) 도구를 활용하는 경우 평가의 공정성 및 신뢰성이 훼손되지 않도록 주의하고, 평가 시행 전 학생 유의사항을 충분히 안내한다.' },
  homework: { page: '12쪽 Ⅲ.3.라 4)', text: '모든 수행평가는 수업 중 실시하는 것을 원칙으로 하며, 수업시간 외 가정 등에서 이루어지는 ‘과제형 수행평가’는 실시하지 않는다.' },
};

export const RULE_PACKS = [GG_2026_MIDDLE];

/** 문서 학년도에 맞는 규칙팩 (없으면 undefined → 지침 수치 규칙은 건너뜀) */
export function packFor(year?: number): RulePack | undefined {
  return RULE_PACKS.find((p) => p.year === year);
}

/** 경기도교육청 「2026학년도 중등 학생평가 및 학업성적관리 이해하기」 (중·고 공통 해설 자료) */
export const GG_GUIDE_2026 = {
  source: '경기도교육청 「2026학년도 중등 학생평가 및 학업성적관리 이해하기」',
  url: 'https://www.goe.go.kr/resource/goe/na/bbs_2675/2026/02/58bdfa90-f02e-41dc-b6a5-f03a65f81e61.pdf',
  timing: { page: '28쪽 Ⅲ.3.나 3)', text: '평가 시기는 주 단위로 구체적으로 제시합니다.' },
  spread: { page: '26쪽 Ⅲ.3.가 4)', text: '교과(학년)협의회에서 평가의 영역, 요소, 방법, 시기, 횟수, 반영비율 등을 고려하여 평가가 특정 시기에 집중되지 않고 골고루 분산될 수 있도록 평가 시기를 결정합니다.' },
  aiPlan: { page: '28쪽 Ⅲ.3.나 8)', text: 'AI를 활용하는 수행평가 시, AI 활용 관련 평가의 공정성 및 신뢰성이 훼손되지 않도록 평가 관리 방안을 평가계획서에 포함합니다.' },
  /** 32쪽: 기본 원칙을 반드시 포함하여 작성. items는 기본 원칙 세 문장(원문 그대로) */
  aiPrinciples: {
    page: '32쪽 Ⅲ.4.9.나',
    text: 'AI를 활용하는 수행평가 시, AI 활용 관련 다음의 기본 원칙을 반드시 포함하여 작성',
    items: [
      'AI는 맞춤형 피드백 제공 등을 위해 수업‧평가에서 보조적으로 활용할 수 있으나, 평가의 공정성·신뢰성을 훼손하지 않도록 유의한다.',
      '직접 학생의 활동을 관찰할 수 있는 평가를 통해 학생의 독자적 사고에 따른 결과물을 평가에 반영한다.',
      '실제 평가 상황에서 AI 활용이 금지되는 행위를 명확히 설정하고, 관련 유의사항을 학생·학부모에게 사전 안내한다.',
    ],
  },
  /** 40쪽 「평가 계획 수립 및 운영 자체점검표」 26개 항목 */
  checklist: { page: '40쪽 Ⅲ.6', items: 26 },
};

/** 경기도교육청 감사사례집 (2017~2020 감사분, 2021.11 게시) */
export const GG_AUDIT = {
  source: '경기도교육청 감사사례집 「1-4 학생평가·성적관리」 사례2',
  url: 'https://www.goe.go.kr/resource/old/BBSMSTR_000000000102/BBS_202111190247253801.pdf',
  submit: "'제출여부' 항목에 교사가 임의로 2점을 배점함 — 지적",
  sum: '논술형평가의 평가 배점의 합이 19점임에도 20점으로 잘못 표기하여 학생들에게 공개 — 지적',
};
