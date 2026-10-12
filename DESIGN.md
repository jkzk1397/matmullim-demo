---
name: 맞물림
description: 평가계획서와 채점기준표를 나란히 놓고 형광펜으로 맞지 않는 칸을 칠하는 교사의 책상
colors:
  graphite: "#23262b"
  graphite-raised: "#363a41"
  graphite-ink: "#c3c7ce"
  desk: "#e8eaed"
  desk-light: "#f1f2f4"
  paper: "#ffffff"
  ink: "#1b1d21"
  ink-2: "#454a53"
  ink-3: "#5c626c"
  line: "#dcdfe4"
  line-light: "#eceef1"
  pen: "#2747c0"
  pen-wash: "#eef1fc"
  marker-red: "#ffc9c3"
  marker-orange: "#ffd9a6"
  marker-yellow: "#fff08a"
  pencil-gray: "#6b7079"
  pencil-gray-patch: "#e1e4e9"
  red-line: "#c8382d"
  red-wash: "#fdeeec"
  red-ink: "#9b2a21"
  orange-wash: "#fdf3e5"
  orange-ink: "#844506"
  gray-ink: "#474c55"
  yellow-wash: "#fcf8da"
  yellow-ink: "#655300"
typography:
  stat:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "32px"
    fontFeature: "tnum"
  headline:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: "36px"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  sheet:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  label:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "-0.01em"
rounded:
  mark: "3px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  gutter: "32px"
components:
  button-primary:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.graphite-raised}"
  button-primary-lg:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "0 24px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.desk-light}"
  button-quiet:
    textColor: "{colors.ink-2}"
    height: "40px"
  button-quiet-hover:
    textColor: "{colors.ink}"
  shell-header:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.graphite-ink}"
    padding: "0 32px"
    height: "56px"
  step-tab-active:
    textColor: "{colors.paper}"
  paper:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
  comparison-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.sheet}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  count-filter:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    padding: "10px 20px"
  count-filter-active:
    backgroundColor: "{colors.desk-light}"
  margin-item:
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  margin-item-hover:
    backgroundColor: "{colors.desk-light}"
  margin-item-active:
    backgroundColor: "{colors.paper}"
  num-chip-red:
    backgroundColor: "{colors.red-wash}"
    textColor: "{colors.red-ink}"
    rounded: "{rounded.full}"
    size: "24px"
  num-chip-orange:
    backgroundColor: "{colors.orange-wash}"
    textColor: "{colors.orange-ink}"
    rounded: "{rounded.full}"
    size: "24px"
  num-chip-gray:
    backgroundColor: "{colors.desk-light}"
    textColor: "{colors.gray-ink}"
    rounded: "{rounded.full}"
    size: "24px"
  num-chip-yellow:
    backgroundColor: "{colors.yellow-wash}"
    textColor: "{colors.yellow-ink}"
    rounded: "{rounded.full}"
    size: "24px"
  input-field:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "40px"
  input-field-focus:
    backgroundColor: "{colors.pen-wash}"
  input-field-edited:
    textColor: "{colors.pen}"
  teacher-memo:
    backgroundColor: "{colors.pen-wash}"
    textColor: "{colors.pen}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
---

# Design System: 맞물림

## Overview

**Creative North Star: "형광펜 대조의 책상"**

인쇄한 두 문서를 나란히 놓고, 맞지 않는 칸에 형광펜을 긋던 교사의 책상이 이 시스템의 전부다. 흑연색 상단 셸 아래 옅은 책상 회색이 깔리고, 그 위에 테두리 없는 흰 종이가 부드러운 그림자로 놓인다. 모든 지적은 "내 문서 한 장 ↔ 대조 문서 한 장"으로 보이고, 지적된 칸은 원문 그대로 칠해진다.

표시를 하는 손은 둘이다. 도구는 형광펜(빨강·주황·노랑 형광 띠, 회색은 연필 점선 밑줄)으로만 말하고, 교사의 판단(메모·연결 지정·고친 값)은 파란 볼펜 잉크로만 남는다. 밀도는 높지만 차분하다. 한 화면이 발표 슬라이드 한 장으로 읽혀야 하므로, 상단 한 줄 제목이 그 화면의 결론을 말한다.

확인된 거부: 회색 SaaS 위에 숫자 타일과 이슈 목록을 늘어놓는 배열, 카드 왼쪽 색 띠.

**Key Characteristics:**
- 흑연 셸 · 책상 회색 바탕 · 테두리 없는 흰 종이
- 도구의 표시는 형광펜, 교사의 판단은 파란 볼펜
- 지적 하나 = 종이 두 장의 대조
- Pretendard 한 가족, 숫자는 tabular
- 색은 언제나 글자 라벨과 함께

## Colors

무채색 책상과 종이 위에, 의미를 가진 형광 세 가지와 연필 회색, 볼펜 파랑 하나만 얹는다.

### Primary
- **흑연 (Graphite)**: 상단 셸, 주 행동 버튼, 강도 눈금의 채운 구간, 정렬 맵의 연결 점. 화면에서 가장 무거운 색이며 "결정하는 자리"에만 쓴다. 눌렀을 때는 한 단계 밝은 흑연(graphite-raised).

### Secondary
- **파란 볼펜 (Pen Blue)**: 교사의 손. 메모, 교사가 고친 추출값, 직접 지정한 연결, 포커스 링과 커서. 옅은 볼펜 물(pen-wash)은 메모 상자와 지금 보고 있는 원문 칸의 바탕.

### Tertiary: 형광펜 네 자루 (카드 종류, 의미 고정)
- **빨강 형광 (marker-red)**: 확인된 오류. 사실로 확인될 때만. 글자는 red-ink, 칩 바탕은 red-wash, 재점검의 "새로 생김"만 red-line 실선 테두리.
- **주황 형광 (marker-orange)**: 지침 권고와 다름. 글자 orange-ink, 바탕 orange-wash.
- **연필 회색 (pencil-gray)**: 연결 확인 필요. 형광 띠가 아니라 점선 밑줄(2px dotted, 밑줄 간격 4px). 견본은 pencil-gray-patch 위 점선. 글자 gray-ink, 바탕은 desk-light.
- **노랑 형광 (marker-yellow)**: 제안(질문). 글자 yellow-ink, 바탕 yellow-wash. 텍스트 선택 색도 노랑 형광.

### Neutral
- **책상 (desk / desk-light)**: 앱 바탕과, 그 위의 호버·선택·표 머리 바탕.
- **종이 (paper)**: 모든 시트와 패널.
- **먹 세 단계 (ink / ink-2 / ink-3)**: 본문·강조 / 보조 문장 / 메타·경로·캡션. ink-3도 책상 위 5.1:1, 종이 위 6.1:1.
- **괘선 (line / line-light)**: 표 머리 아래 선과 행 사이 선. 종이 바깥 테두리로는 쓰지 않는다.
- **흑연 잉크 (graphite-ink)**: 상단 셸 위의 비활성 글자.

### Named Rules
**The Two Hands Rule.** 도구가 찾은 것은 형광펜 색으로만, 교사가 정한 것은 파란 볼펜으로만 표시한다. 도구의 출력에 파랑을 쓰거나 교사의 메모에 형광을 쓰지 않는다.

**The Label-With-Color Rule.** 카드 종류는 네 가지로 고정(확인된 오류 · 지침 권고와 다름 · 연결 확인 필요 · 제안)이며, 색 견본은 언제나 이 글자 라벨과 함께 나온다. 색만으로 구분하지 않는다.

**The Pencil-Not-Marker Rule.** "연결 확인 필요"는 오류로 단정하지 않으므로 형광을 칠하지 않고 연필 점선 밑줄만 긋는다.

## Typography

**Body Font:** Pretendard Variable (with Pretendard, system-ui, sans-serif)

**Character:** 한 가족, 굵기로만 위계를 만든다. 숫자는 전역 tabular로 세워 표의 점수·배점이 세로로 맞는다. 자간은 전역 -0.01em, 제목은 더 조인다. 한국어 줄바꿈은 어절 단위(keep-all), 제목은 balance.

### Hierarchy
- **Stat** (700, 28px/32px, tabular): 종류별 개수 막대의 숫자. 단위 "건"은 14px 500 ink-3로 붙인다.
- **Headline** (700, 26px/36px, -0.025em): 화면마다 한 줄 결론 제목(슬라이드 제목 역할). 화면당 하나.
- **Title** (700, 18px/28px, -0.02em): 선택한 지적의 제목, 섹션 제목.
- **Body** (400, 15px/24px): 근거 문장, 고치는 법, 메모. 목록 제목은 15px/22px 600.
- **Sheet** (400, 14px/22px): 종이 시트와 원문 표의 칸. 칠한 칸은 600 ink.
- **Label** (400, 13px/20px): 경로, 캡션, "근거"·"고치는 법" 같은 필드 이름, 표 머리(600 ink-3). 대문자 변환이나 넓은 자간 없음.

### Named Rules
**The One Family Rule.** Pretendard 하나만 쓴다. 디스플레이용 두 번째 서체나 모노 서체를 들이지 않는다. 숫자는 언제나 tabular.

## Layout

데스크톱 고정 폭 화면(최소 1280px, 기준 캡처 1440×900). 상단 셸 56px 아래 좌우 32px 거터. 결과 화면은 왼쪽 400px 여백 목록 | 오른쪽 대조 보기(간격 24px)의 두 단이며, 대조 보기 안에서 두 종이 시트가 12px 간격으로 나란히 서고 그 사이 28px 원에 관계 기호(≠ 불일치, ↔ 제안, ? 확인 필요)가 놓인다. 시트 아래는 근거 | 고치는 법 | 강도 눈금(236px)의 세 열, 주 행동은 오른쪽 아래. 정렬 맵은 표 | 320px 보조 열.

리듬은 4px 단위: 8 · 12 · 16 · 24 · 32. 목록 항목 사이 6px, 필드 이름과 값 사이 2px처럼 짝은 조이고 묶음 사이는 16–24px로 띄운다. 긴 영역은 각 단이 따로 스크롤하고 페이지 전체는 뷰포트에 맞춘다.

### Named Rules
**The Two Sheets Rule.** 지적 하나는 "내 문서 한 장 ↔ 대조 문서 한 장"(평가계획서 ↔ 채점기준표, 내 문서 ↔ 성취기준 DB, 채점기준표 ↔ 교육청 지침)으로 보인다. 대조할 상대가 없을 때만 한 장.

## Elevation & Depth

종이와 책상의 혼합 방식. 바탕은 평평한 책상 회색이고, 종이만 두 겹의 부드러운 그림자로 떠 있다. 선택한 것(여백 목록의 현재 항목, 호버한 예시 문서)은 한 단계 더 떠오른다. 그 밖의 경계는 그림자 대신 1px 안쪽 선(inset)으로 처리한다.

### Shadow Vocabulary
- **Paper** (`box-shadow: 0 1px 2px rgba(20,22,26,0.06), 0 6px 20px -4px rgba(20,22,26,0.10)`): 모든 종이 시트와 패널의 기본.
- **Lift** (`box-shadow: 0 1px 2px rgba(20,22,26,0.08), 0 10px 28px -6px rgba(20,22,26,0.16)`): 선택된 여백 항목, 호버한 올리기 카드.
- **Hairline** (`box-shadow: inset 0 0 0 1px #dcdfe4`): 보조 버튼, 표 머리 견본.
- **Filter underline** (`box-shadow: inset 0 -3px 0 #23262b`): 개수 막대에서 고른 종류.

### Named Rules
**The Paper-On-Desk Rule.** 종이는 테두리 없이 그림자로만 책상에서 떨어진다. 종이 안쪽의 표 괘선은 허용하지만, 종이 바깥에 선을 두르지 않는다.

## Shapes

부드럽지만 둥글지 않은 모서리. 종이·패널·목록 항목 12px, 대조 시트·버튼·입력 상자·메모 8px, 확인 화면의 칸 입력 6px, 형광 띠 3px. 원형은 번호 칩(24px), 관계 기호(28px), 단계 번호(20px), 강도 눈금의 점에만. 형광 견본은 -12° 기울인 짧은 띠로, 한 번 그은 펜 자국을 흉내 낸다. 올리기 빈 칸만 2px 점선 테두리를 쓴다.

**The Hatch-Is-Meaning Rule.** 135° 회색 빗금(6px 간격, #eef0f2 / #f8f9fa)은 정렬 맵에서 연결을 찾지 못한 성취기준 행과 그 범례에만 쓴다(원래 요청: "빈 행은 회색 줄무늬"). 일반 질감이나 장식으로 쓰지 않는다.

## Components

### Buttons
도구가 아니라 책상 위 연필꽂이처럼 조용하다.
- **Shape:** 부드러운 모서리 (8px), 높이 40px(큰 크기 48px), 600 굵기.
- **Primary:** 흑연 바탕 흰 글자. 화면당 하나, 대조 보기 오른쪽 아래.
- **Secondary:** 종이 바탕 + 안쪽 1px 괘선, 호버 시 desk-light.
- **Quiet:** 바탕 없는 밑줄 글자(ink-2, 괘선색 밑줄 4px 간격). "원문 값 다시 확인", "해결 보기" 같은 곁가지 행동.
- **Hover / Focus:** 색만 150ms로 바뀐다. 포커스는 모든 요소에 2px 볼펜 파랑 외곽선, 2px 띄움. 비활성은 40% 불투명.

### Chips
- **번호 칩:** 24px 원, 종류별 wash 바탕 + ink 글자 12px 700. 시트의 칠한 칸과 여백 목록을 잇는다.
- **종류 라벨:** 형광 견본(16×12px 기울인 띠, 회색은 점선 견본) + 13px 600 종류 ink 글자.

### Cards / Containers
- **Corner Style:** 12px (종이), 8px (대조 시트).
- **Background:** 종이 흰색. 책상 위에만 놓인다.
- **Shadow Strategy:** Paper, 선택 시 Lift (Elevation 참조).
- **Border:** 없음. 시트 머리 아래만 line-light 괘선.
- **Internal Padding:** 시트 12px 16px, 패널 16px 20px, 빈 결과 패널 32px 36px.

### Inputs / Fields
- **Style:** 테두리 없는 칸. 확인 화면의 값 칸은 투명 바탕 40px 높이, 호버 시 desk-light. 짝짓기 선택 상자는 desk-light 바탕.
- **Focus:** 볼펜 물(pen-wash) 바탕 + 2px 볼펜 링. 지금 칸에 대응하는 원문 칸도 같은 볼펜 실선으로 표시.
- **Edited:** 교사가 고친 값은 볼펜 파랑 글자와 펜 아이콘. 인식된 원문 칸은 볼펜 40% 점선.

### Navigation
흑연 셸 56px: 왼쪽 「맞물림」 워드마크(19px 700 흰색)와 13px 부제, 가운데 다섯 단계 탭(14px, 20px 원 번호, 지난 단계는 체크), 오른쪽 자물쇠 아이콘과 "브라우저 안에서만 처리 · 서버 전송 없음"(상시). 현재 단계는 흰 글자 600 + 2px 흰 밑줄, 비활성은 graphite-ink, 잠긴 단계는 50% 불투명.

### Comparison Sheet (signature)
종이 한 장에 원문 표 조각만 옮긴다: 시트 머리(문서 이름 14px 600 | 파일명 13px ink-3), 표 조각 제목(label), 머리 행(label 600 ink-3, 아래 괘선), 행(line-light 구분). 지적된 칸은 형광 띠로 칠한다. 띠는 글자 줄의 12–92% 높이에만 칠하고(줄 사이는 비움), 좌우 3px 여유, 3px 모서리. 카드를 고르면 띠가 왼쪽에서 오른쪽으로 한 번 그어진다(520ms, cubic-bezier(0.16,1,0.3,1)); 동작 줄이기 설정에서는 그냥 칠해져 있다. 맞물림이 계산한 합계는 시트 아래 바닥 행으로 붙인다.

### Strength Scale
근거의 강도 눈금(사실 > 의무 > 권고 > 제안). 괘선 위 네 점, 현재 강도까지 흑연으로 채우고 현재 점만 1.5배. 아래 네 글자 중 현재만 700 ink, 그 아래 한 줄 풀이. 누르는 컨트롤이 아니다.

## Do's and Don'ts

### Do:
- **Do** 지적 하나를 종이 두 장(내 문서 ↔ 대조 문서)으로 보이고, 지적된 칸을 원문 그대로 형광 띠로 칠한다.
- **Do** 형광 견본 옆에 고정된 종류 라벨(확인된 오류 · 지침 권고와 다름 · 연결 확인 필요 · 제안)을 함께 단다.
- **Do** 교사의 메모·고친 값·지정한 연결은 파란 볼펜(#2747c0)과 볼펜 물 바탕으로 표시한다.
- **Do** 종이는 Paper 그림자로 띄우고, 선택한 하나만 Lift로 올린다.
- **Do** 숫자는 tabular, 글자 대비는 4.5:1 이상(ink-3가 가장 옅은 본문 색).
- **Do** 화면마다 한 줄 결론 제목(26px 700)을 둔다.

### Don't:
- **Don't** 회색 SaaS 바탕 위에 숫자 타일과 이슈 목록을 늘어놓지 않는다. 개수는 필터를 겸한 한 줄 막대로만.
- **Don't** 카드나 목록 항목 왼쪽에 색 띠를 두르지 않는다.
- **Don't** 종이 바깥에 테두리를 두르지 않는다.
- **Don't** "연결 확인 필요"에 형광을 칠하거나 빨강을 쓰지 않는다. 연필 점선 밑줄만.
- **Don't** 도구의 출력에 파란 볼펜 색을 쓰지 않는다.
- **Don't** 빗금 패턴을 정렬 맵의 연결 없는 행 밖에서 쓰지 않는다.
- **Don't** Pretendard 외의 서체를 들이지 않는다.
