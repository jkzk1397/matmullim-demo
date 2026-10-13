// 「맞물림」 데이터 모델.
// 만점(maxScore), 배점(points), 반영비율(weightPercent)은 서로 다른 단위다. 절대 섞어 비교하지 않는다.

export type DocKind = 'plan' | 'rubric';

/** 교사 문서의 원문 위치. table/row/col은 0부터 센다(화면에는 1부터 표시). */
export type CellRef = { doc: DocKind; table: number; row: number; col: number };

export type Element = {
  name: string;
  /** 배점 (점) */
  points?: number;
  /** 성취기준 코드, 정규화된 형태 예: "[9정03-01]" */
  standards: string[];
  /** (추가 필드) 채점기준표의 평가요소별 채점기준 원문 */
  rubricText?: string;
  /** (추가 필드) 각 값이 나온 원문 칸 */
  refs?: Partial<Record<'name' | 'points' | 'standards' | 'rubricText', CellRef>>;
};

export type Assessment = {
  /** 교사 확인 단계에서 두 문서의 평가를 짝지을 때 쓰는 키 */
  id: string;
  /** 예: "프로그래밍 프로젝트" */
  name: string;
  /** 학기 반영비율 (%) */
  weightPercent?: number;
  /** 만점 (점) */
  maxScore?: number;
  /** 평가요소, 배점, 성취기준 코드 */
  elements: Element[];
  /** 채점기준 원문 (평가요소별 채점기준을 이어 붙인 것) */
  rubricText?: string;
  /** 원문 위치 (평가명 칸) */
  source: CellRef;
  /** (추가 필드) 공시 양식 요약표에서 읽지 못한 칸이 있으면 true (합계 판정을 하지 않는다) */
  incomplete?: boolean;
  /** (추가 필드) 평가 방법: "지필" | "수행" 등 원문 그대로 */
  method?: string;
  /** (추가 필드) 각 값이 나온 원문 칸 */
  refs?: Partial<Record<'weightPercent' | 'maxScore' | 'method', CellRef>>;
};

/** 평가계획에 적힌 학기 성취기준 한 줄 */
export type PlanStandard = { code: string; text: string; ref: CellRef };

// ---------- 파싱 결과 (HWPX → 표) ----------

export type Span = { row: number; col: number; rowSpan: number; colSpan: number };

export type ParsedTable = {
  /** 표 바로 앞 문단 (예: "2. 평가 개요") */
  title: string;
  /** 2차원 셀 텍스트. 병합으로 가려진 칸은 "" */
  rows: string[][];
  /** 병합 정보 (1×1이 아닌 칸만) */
  spans: Span[];
};

export type ParsedDocument = {
  doc: DocKind;
  fileName: string;
  /** 문서 제목 (첫 문단) */
  title: string;
  tables: ParsedTable[];
};

/** 문서 안에 "[코드] 문장" 꼴로 적힌 성취기준 문구 한 곳 */
export type CodeText = { code: string; text: string; ref: CellRef };

/** 추출 결과 = 교사 확인 화면에서 고치는 대상 */
export type Extraction = {
  plan: Assessment[];
  rubric: Assessment[];
  planStandards: PlanStandard[];
  warnings: string[];
  /** (추가 필드) 성취기준 문구가 적힌 모든 곳 */
  codeTexts?: CodeText[];
  /** (추가 필드) 'public' = 학교알리미 공시 양식 한 파일 */
  format?: 'pair' | 'public';
};

// ---------- 점검 결과 ----------

export type Severity = 'red' | 'orange' | 'gray' | 'yellow';
export type Strength = '사실' | '의무' | '권고' | '제안';
export type Action = 'fix' | 'memo' | 'link';
export type RuleId = 'J4' | 'J5' | 'J7' | 'J12' | 'J6' | 'S5';

export type Basis = {
  /** 규칙 출처 (문서명) */
  source: string;
  /** 쪽수 등 위치 */
  page?: string;
  /** 원문 문장 (있을 때만, 지어내지 않는다) */
  text?: string;
};

export type CompareRow = { label: string; plan?: string; rubric?: string; differs: boolean };

export type Card = {
  /** 재점검 비교용 안정 키 */
  key: string;
  rule: RuleId;
  severity: Severity;
  strength: Strength;
  title: string;
  /** 교사 문서 원문 위치 */
  locations: CellRef[];
  /** 내 문서 원문 인용 */
  quote: string;
  /** 인용 안에서 강조할 구절 */
  highlights?: string[];
  basis: Basis;
  /** 교사가 할 수 있는 행동 */
  actions: Action[];
  /** 시도층 규칙 카드에 붙는 안내 */
  note?: string;
  /** 고치는 방법 (결정적 문장) */
  fix?: string;
  /** locations 중 형광펜으로 칠할 칸. 없으면 locations 전체 */
  emphasis?: CellRef[];
  /** 두 문서 나란히 비교 */
  compare?: CompareRow[];
};

/** 정렬 맵에서 교사가 지정한 연결 */
export type ManualLink = { code: string; assessmentId: string };

export type CheckInput = {
  plan: Assessment[];
  rubric: Assessment[];
  planStandards: PlanStandard[];
  /** rubric 평가 id → plan 평가 id (null이면 짝 없음) */
  pairs: Record<string, string | null>;
  links: ManualLink[];
  /** (추가 필드) 성취기준 문구가 적힌 모든 곳 — J5 문구 대조에 쓴다 */
  codeTexts?: CodeText[];
  /** (추가 필드) 'public'이면 한 파일 안 요약표 ↔ 세부기준을 대조한다 */
  format?: 'pair' | 'public';
};

export type PassedCheck = { rule: RuleId | 'J12-weight'; label: string; detail: string };

export type CheckResult = { cards: Card[]; passed: PassedCheck[] };
