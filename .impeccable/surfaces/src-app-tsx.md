---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/screens"]
---

# Surface: 맞물림 데모 앱 (올리기 · 확인 · 결과 · 정렬 맵 · 재점검)

Mode: Operate. Build path: code-led. Primary capture: PPT screenshots 1440×900 @2x.

Audience/job: 중학교 정보 교사가 평가계획서와 채점기준표를 교과협의회 전에 스스로 대조한다. 심사위원은 슬라이드 한 장으로 읽는다.
Constraints: PRODUCT.md. 카드 네 종류의 의미와 글자 라벨 고정. 모든 지적에 원문 위치·근거·강도·행동. 처리 위치 안내 상시 표시.
Critique carry-overs (2026-10-12): 결과 제목과 숫자 일치, 재점검은 해결 항목을 조용히·전후 값 표시, 고치기는 문서를 다시 올리는 흐름, 위치는 경로+원문 칸으로, 강도 눈금, 색 왼쪽 띠 금지, ink 대비 4.5:1 이상, 제목 단계 h1→h2.

## Direction contract

THESIS: 인쇄한 두 문서를 나란히 놓고 형광펜으로 맞지 않는 칸을 칠하던 교사의 책상. 모든 지적은 "내 문서 한 장 ↔ 대조 문서 한 장"으로 보인다. 회색 SaaS 위의 숫자 타일 + 이슈 목록 배열을 거부한다.
OWN-WORLD: 흑연색 상단 셸(#23262b) 위 단계 탭, 옅은 책상 회색 바탕 위 흰 종이 시트(부드러운 그림자, 테두리 없음). 도구의 표시는 형광펜(빨강·주황·노랑 형광 띠, 회색은 연필 점선 밑줄)으로만, 교사의 판단(메모·연결 지정·해결 확인)은 파란 볼펜 잉크(#2747c0)로만. Pretendard 한 가족, 숫자 tabular.
STORY: 교사는 어느 칸이 무엇과 왜 맞지 않는지 원문 그대로 보고, 근거의 강도를 알고, 고칠 방법을 읽은 뒤 문서를 고쳐 다시 올리거나 이유를 메모하고 넘긴다.
FIRST VIEWPORT: (결과) 흑연 상단바 56px → 한 줄 제목과 부제 → 카드 종류별 개수 막대(필터 겸용) → 왼쪽 400px 여백 목록(번호 칩·라벨·제목·경로) | 오른쪽 대조 보기: 선택한 지적의 두 종이 시트를 나란히(형광 칠한 칸, 사이에 ≠/↔ 기호), 아래 근거·강도 눈금·고치는 법·행동 버튼. 주 행동은 시트 아래 오른쪽.
FORM: 형광펜 대조 — grounded list 1위(IMPECCABLE'S PICK)를 사용자가 선택. seed: none (unavailable)
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
