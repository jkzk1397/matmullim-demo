---
name: 맞물림
description: 평가계획서와 채점기준표를 나란히 놓고, 다른 값만 색으로 짚어 한 장으로 보여 주는 대조표
colors:
  brand-navy: "#0d2b57"
  brand-navy-2: "#163d75"
  brand-blue: "#0b5cad"
  brand-blue-50: "#eaf2fb"
  brand-teal: "#08a5b3"
  brand-green: "#2b8a3e"
  brand-green-50: "#ebf6ee"
  sev-red: "#d7263d"
  sev-orange: "#e8590c"
  sev-gray: "#868e96"
  sev-yellow: "#b08800"
  ink: "#212529"
  ink-2: "#495057"
  ink-3: "#5f6670"
  line: "#e3e7ed"
  line-2: "#eef1f5"
  canvas: "#f6f8fa"
  paper: "#ffffff"
typography:
  title:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: "40px"
    letterSpacing: "-0.03em"
  key:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "30px"
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: "28px"
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  help:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "22px"
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  header:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.brand-navy}"
    height: "56px"
  step-tab-active:
    backgroundColor: "{colors.brand-navy}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    size: "24px"
  step-tab-done:
    backgroundColor: "{colors.brand-green-50}"
    textColor: "{colors.brand-green}"
    rounded: "{rounded.full}"
    size: "24px"
  button-primary:
    backgroundColor: "{colors.brand-navy}"
    textColor: "{colors.paper}"
    typography: "{typography.help}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.brand-navy-2}"
  button-primary-lg:
    backgroundColor: "{colors.brand-navy}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 24px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.help}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.canvas}"
  button-quiet:
    textColor: "{colors.brand-blue}"
    typography: "{typography.help}"
    height: "40px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
  comparison-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "8px 16px"
  strength-badge:
    textColor: "{colors.ink-2}"
    typography: "{typography.help}"
    rounded: "{rounded.md}"
    padding: "0 8px"
  result-item:
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  result-item-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  status-resolved:
    backgroundColor: "{colors.brand-green}"
    textColor: "{colors.paper}"
    typography: "{typography.help}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  status-remaining:
    backgroundColor: "{colors.sev-gray}"
    textColor: "{colors.paper}"
    typography: "{typography.help}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  status-added:
    backgroundColor: "{colors.sev-red}"
    textColor: "{colors.paper}"
    typography: "{typography.help}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  input-field:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "40px"
  input-field-focus:
    backgroundColor: "{colors.brand-blue-50}"
  input-field-edited:
    textColor: "{colors.brand-blue}"
  teacher-memo:
    backgroundColor: "{colors.brand-blue-50}"
    textColor: "{colors.brand-blue}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
---

# Design System: 맞물림

## Overview

**Creative North Star: "한 장으로 읽히는 대조표"**

화면 하나가 발표 슬라이드 한 장으로 읽혀야 한다. 흰 상단바와 아주 옅은 바탕 위에 흰 카드가 놓이고, 화면 제목 한 줄이 그 화면의 결론을 말한다. 지적 하나는 "내 문서 한 장 ↔ 대조 문서 한 장"으로 나란히 보이며, 두 문서에서 서로 다른 값만 카드 색으로 짚고 같은 값은 흐리게 물러난다.

색은 팀 로고에서 왔다. 남색은 결정(주 행동, 현재 단계), 파랑은 교사의 손과 누를 수 있는 글자, 초록은 통과·해결. 카드 의미 색 네 가지는 언제나 같은 색 글자 라벨과 함께 점 또는 왼쪽 선으로만 나온다. 장식은 없다: 그림자 하나, 글자 크기 네 단계, 8px 단위 간격.

확인된 거부: 옅은 분홍·주황 알약 배지, 강도 슬라이더, 화면에 드러나는 개발자식 문구(처리 시간, "같은 표를 넣으면 언제나 같은 결과", 목록 안의 › 경로).

**Key Characteristics:**
- 흰 상단바 + 1px 선, 가운데 1240px 화면 폭
- 로고 색(남색·파랑·초록)과 카드 의미 색 네 가지뿐
- 글자 크기 네 단계(30 · 20 · 17 · 14), 14px 미만 없음
- 지적 하나 = 문서 두 장 나란히, 다른 값만 색
- 색은 언제나 같은 색 글자 라벨과 함께

## Colors

차가운 무채색 바탕에 로고 색 셋과, 의미가 고정된 카드 색 넷만 얹는다.

### Primary
- **로고 남색 (brand-navy)**: 주 행동 버튼, 현재 단계 원과 밑줄, 워드마크 「맞물림」, 정렬 맵의 연결 표시, "평가 연결하기" 선택 상자. 호버는 한 단계 밝은 남색(brand-navy-2).

### Secondary
- **로고 파랑 (brand-blue)**: 교사의 손(메모, 교사가 고친 값과 펜 아이콘, 선생님이 지정한 연결)과 누를 수 있는 글자(조용한 버튼, "어떤 표를 읽나요?"). 포커스 링·커서도 파랑. 옅은 파랑(brand-blue-50)은 메모 상자, 지금 보고 있는 칸, 호버 바탕, 텍스트 선택 바탕.

### Tertiary
- **로고 초록 (brand-green)**: 성공만. "해결됨" 배지, 통과한 점검의 체크, 정상판의 큰 체크 원, 다 올린 파일 칸, 재점검 진행 막대. 옅은 초록(brand-green-50)은 지난 단계의 체크 원 바탕.
- **로고 청록 (brand-teal)**: 로고 이미지 안에만. 화면 요소에 쓰지 않는다.

### 카드 의미 색 (고정)
- **빨강 (sev-red)**: 확인된 오류. 다른 값 강조, 성취기준 DB에 없는 코드, "새로 생김" 배지.
- **주황 (sev-orange)**: 지침 권고와 다름.
- **회색 (sev-gray)**: 연결 확인 필요. "남음" 배지 바탕, 정렬 맵의 연결 없는 행 왼쪽 선.
- **노랑 글자 (sev-yellow)**: 제안. 노랑은 바탕이 아니라 글자·점 색으로만.

### Neutral
- **먹 세 단계 (ink / ink-2 / ink-3)**: 제목·강조 값 / 본문·보조 문장 / 메타·파일명·같은 값(흐리게).
- **선 (line / line-2)**: 상단바 아래 1px 선·표 머리 아래 선·보조 버튼 안쪽 선 / 표 행 사이 선, 진행 막대 빈 구간.
- **바탕 (canvas)**: 앱 바탕, 표 머리, 보조 버튼 호버.
- **종이 (paper)**: 상단바, 카드, 시트.

### Named Rules
**The Label-With-Color Rule.** 카드 종류는 네 가지로 고정(확인된 오류 · 지침 권고와 다름 · 연결 확인 필요 · 제안)이고, 의미 색은 10px 원점 또는 4px 왼쪽 선으로만 나오며 언제나 같은 색 글자 라벨이 붙는다. 색만으로 구분하지 않는다.

**The Green-Means-Done Rule.** 초록은 통과·해결에만 쓴다. 남은 것은 회색, 새로 생긴 것은 빨강.

**The Blue-Is-The-Hand Rule.** 도구가 찾은 것은 카드 의미 색으로, 교사가 정하거나 고친 것은 파랑으로 표시한다. 도구의 지적에 파랑을 쓰지 않는다.

## Typography

**Body Font:** Pretendard Variable (with Pretendard, system-ui, sans-serif)

**Character:** 한 가족, 네 크기. 위계는 크기와 굵기(800 · 700 · 500)로만 만든다. 숫자는 전역 tabular, 자간 전역 -0.01em. 한국어 줄바꿈은 어절 단위(keep-all), 제목은 balance.

### Hierarchy
- **Title** (800, 30px/40px, -0.03em): 화면마다 한 줄 결론 제목. 개수 막대의 "확인된 오류 n건" 숫자, 정상판 "확인된 오류 0건", 재점검 "n건 중 m건 해결"도 이 크기.
- **Key** (700, 20px/30px, -0.02em): 선택한 지적의 핵심 문장, 올리기 칸 제목, 관계 기호(≠ ↔ ?, 800). 워드마크 「맞물림」은 800.
- **Body** (500, 17px/28px): 본문, 목록 항목, 시트의 값, 고치는 법, 메모, 화면 제목 아래 부제(ink-3). 강조는 700.
- **Help** (500, 14px/22px): 라벨, 단계 탭, 버튼, 배지, 표 머리, 파일명, 근거 줄. 라벨·버튼·배지는 700.

### Named Rules
**The Four Sizes Rule.** 글자 크기는 30 · 20 · 17 · 14 넷뿐이다. 14px 미만은 없고, 다섯 번째 크기를 만들지 않는다. 대문자 변환이나 넓은 자간 없음.

## Layout

데스크톱 화면(기준 캡처 1366×768). 콘텐츠는 최대 1240px 가운데, 좌우 24px 여백. 상단바 56px: 왼쪽 로고 마크(32px, public/brand/logo-mark.png)와 워드마크, 가운데 다섯 단계 탭, 오른쪽 자물쇠 아이콘과 "브라우저 안에서만 처리". 페이지는 뷰포트에 맞추고 긴 영역만 따로 스크롤한다.

결과 화면은 개수 막대(한 줄 카드) 아래 340px 지적 목록 | 대조 보기의 두 단(간격 24px). 대조 보기 안에서 두 시트가 나란히 서고 그 사이 32px 열에 관계 기호가 놓인다. 시트 아래 "고치는 법" 한 문장, 그 아래 근거 줄과 행동 버튼(주 행동은 오른쪽 끝). 확인 화면은 원문 | 읽어 낸 값의 같은 폭 두 단, 올리기는 두 문서 칸 나란히, 정상판은 760px 카드 하나를 가운데.

간격은 8px 배수(8 · 16 · 24 · 32)로 묶음을 나눈다.

### Named Rules
**The Two Sheets Rule.** 지적 하나는 "내 문서 한 장 ↔ 대조 문서 한 장"(평가계획서 ↔ 채점기준표, 내 문서 ↔ 성취기준 DB, 채점기준표 ↔ 교육청 지침)으로 보인다. 대조할 상대가 없을 때만 한 장.

## Elevation & Depth

거의 평평하다. 옅은 바탕 위 흰 카드만 아주 옅은 그림자 하나로 떨어지고, 그 밖의 경계는 1px 선으로 처리한다. 선택한 목록 항목도 같은 그림자를 쓴다(더 떠오르지 않는다).

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 3px rgba(13, 43, 87, 0.08)`): 모든 카드, 시트, 선택한 목록 항목, 예시 문서 버튼.

### Named Rules
**The One Shadow Rule.** 그림자는 Card 하나뿐이다. 겹 그림자, 호버 때 떠오르는 그림자를 만들지 않는다.

## Shapes

부드럽지만 둥글지 않은 모서리. 카드·시트·올리기 칸 12px, 버튼·목록 항목·메모·선택 상자 8px, 배지·입력 칸·코드 칩 6px. 원형은 단계 번호(24px), 카드 의미 점(10px), 정렬 맵 표시, 큰 체크 원에만. 올리기 빈 칸만 2px 점선 테두리, 확인 화면의 지금 칸과 대응 원문 칸은 2px 파랑 점선 외곽선.

**The Left-Line-Is-Scoped Rule.** 4px 왼쪽 선은 사용자가 요청한 두 곳에만 쓴다: 결과 목록에서 선택한 항목(그 카드 의미 색), 정렬 맵에서 연결을 찾지 못한 성취기준 행(sev-gray). 다른 카드나 목록에 두르지 않는다.

## Components

### Buttons
조용하고 단단하다.
- **Shape:** 8px 모서리, 높이 40px(큰 크기 48px, 17px 글자), 700 굵기.
- **Primary:** 남색 바탕 흰 글자. 한 줄의 행동 묶음에서 하나.
- **Secondary:** 흰 바탕 + 안쪽 1px line 선, 호버 시 canvas.
- **Quiet:** 바탕 없는 파랑 글자, 호버 시 밑줄. "추출값이 틀렸나요?", "지난 점검과 비교" 같은 곁가지 행동.
- **Hover / Focus:** 색만 150ms로 바뀐다. 포커스는 2px 파랑 외곽선, 2px 띄움. 비활성 40% 불투명.

### Chips
- **종류 라벨:** 10px 의미 색 원점 + 같은 색 14px 700 글자.
- **강도 배지:** 하나만. "사실 확인" / "의무" / "권고" / "제안", 1px line 테두리 6px 모서리, ink-2 14px. 슬라이더나 눈금을 쓰지 않는다.
- **상태 배지 (재점검):** 꽉 찬 바탕 흰 글자 — 해결됨(초록 + 체크), 남음(회색), 새로 생김(빨강).

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** paper, canvas 바탕 위에만.
- **Shadow Strategy:** Card (Elevation 참조).
- **Border:** 없음. 안쪽 구분은 line-2 선.
- **Internal Padding:** 8px 배수 기준(시트 16px, 큰 카드 24–40px).

### Inputs / Fields
- **Style:** 테두리 없는 40px 칸, 투명 바탕, 호버 시 canvas. 짝짓기 선택 상자는 canvas 바탕 8px 모서리.
- **Focus:** 옅은 파랑 바탕 + 2px 파랑 점선 외곽선. 대응하는 원문 칸도 같은 표시.
- **Edited:** 교사가 고친 값은 파랑 글자와 펜 아이콘.

### Navigation
흰 상단바 56px, 아래 1px line. 단계 탭은 14px: 현재 단계는 남색 원 번호 + 700 남색 글자 + 3px 남색 밑줄, 지난 단계는 옅은 초록 원 안 초록 체크, 앞 단계는 canvas 원 ink-3.

### Comparison Sheet (signature)
문서 한 장을 흰 시트로: 머리(문서 이름 17px 700 | 파일명 14px ink-3, 아래 line-2 선), 표 조각 제목(14px ink-3), 표 머리(14px 700 ink-3, 아래 line 선), 17px 행. 두 문서에서 서로 다른 값만 카드 의미 색 700으로, 같은 값은 ink-3로 흐리게. 맞물림이 계산한 합계는 바닥 행 "합계 (맞물림 계산)". 두 시트 사이에 의미 색 관계 기호(≠ 불일치, ↔ 제안, ? 확인 필요). 아래 "고치는 법"은 첫 문장 하나만.

### Clean Result
정상판: 64px 초록 원 안 흰 체크 + "확인된 오류 0건"(Title) + 통과한 점검 목록(줄마다 초록 체크). 제안과 맞물린 값은 접어 둔다.

### Alignment Map
성취기준 × 평가 표. 평가계획서 연결은 남색 원점, 채점기준표에만 있는 연결은 남색 테두리 원, 선생님이 지정한 연결은 24px 파랑 원 체크. 연결 없는 행은 4px 회색 왼쪽 선과 남색 "평가 연결하기" 선택 상자.

## Do's and Don'ts

### Do:
- **Do** 지적 하나를 문서 두 장으로 나란히 보이고, 서로 다른 값만 카드 의미 색으로, 같은 값은 흐리게 둔다.
- **Do** 의미 색 옆에 고정된 종류 라벨(확인된 오류 · 지침 권고와 다름 · 연결 확인 필요 · 제안)을 같은 색으로 단다.
- **Do** 강도는 배지 하나("사실 확인" / "권고" / "제안")로, 고치는 법은 한 문장으로 보인다.
- **Do** 통과·해결은 초록, 남은 것은 회색 배지로 표시한다.
- **Do** 화면마다 한 줄 결론 제목(30px 800)을 둔다.
- **Do** 간격은 8px 배수로, 그림자는 Card 하나만 쓴다.

### Don't:
- **Don't** 옅은 분홍·주황 알약 배지나 바탕 칠로 카드 종류를 나타내지 않는다.
- **Don't** 14px보다 작은 글자나 네 단계 밖의 글자 크기를 쓰지 않는다.
- **Don't** 4px 왼쪽 선을 결과 목록의 선택 항목과 정렬 맵의 연결 없는 행 밖에서 쓰지 않는다.
- **Don't** 처리 시간, "같은 표를 넣으면 언제나 같은 결과", 목록 안의 › 경로 같은 개발자식 문구를 화면에 두지 않는다. 원문 위치 경로는 상세 화면 제목 아래 한 줄로만 쓴다.
- **Don't** 도구의 지적에 파랑을, 성공이 아닌 곳에 초록을 쓰지 않는다.
- **Don't** Pretendard 외의 서체를 들이지 않는다.
