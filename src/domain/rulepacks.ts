// 시도·학년도별 규칙팩. 지침 원문 문장과 쪽수를 그대로 둔다(지어내지 않는다).
// 지금은 경기도교육청 2026학년도 중학교만 있다. 다른 시도·학년도는 같은 모양으로 추가한다.

export type RulePack = {
  id: string;
  name: string;
  /** 문서 표지 */
  source: string;
  url: string;
  year: number;
  perfMin: { value: number; page: string; text: string };
  essayMin: { value: number; arts: number; artsSubjects: string[]; page: string; text: string };
  absence: { page: string; text: string };
  change: { page: string; text: string };
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
};

export const RULE_PACKS = [GG_2026_MIDDLE];

/** 문서 학년도에 맞는 규칙팩 (없으면 undefined → 지침 수치 규칙은 건너뜀) */
export function packFor(year?: number): RulePack | undefined {
  return RULE_PACKS.find((p) => p.year === year);
}

/** 경기도교육청 감사사례집 (2017~2020 감사분, 2021.11 게시) */
export const GG_AUDIT = {
  source: '경기도교육청 감사사례집 「1-4 학생평가·성적관리」 사례2',
  url: 'https://www.goe.go.kr/resource/old/BBSMSTR_000000000102/BBS_202111190247253801.pdf',
  submit: "'제출여부' 항목에 교사가 임의로 2점을 배점함 — 지적",
  sum: '논술형평가의 평가 배점의 합이 19점임에도 20점으로 잘못 표기하여 학생들에게 공개 — 지적',
};
