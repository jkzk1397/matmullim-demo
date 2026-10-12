# 작업 인계 메모

다음 작업자(사람이든 Claude든)가 이 저장소만 보고 바로 이어서 할 수 있도록 지금까지의 결정과 상태를 적어 둔다.
작업 브랜치: `claude/demo-creation-skev7t` (PR은 아직 만들지 않음)

## 무엇을 만들었나

「맞물림」 경진대회용 데모. 학교 평가 문서(지금 데모는 평가계획서 ↔ 채점기준표, HWPX)를 서로 대조해
어긋난 곳을 원문 근거와 함께 보여 준다. LLM 호출 없음, 브라우저 안에서만 동작.

- 서비스 범위는 평가계획서·채점기준표에 한정하지 않는다. **문서 간 정합성 점검으로 범용적으로 설계**했다는 것이 팀의 의도다.
  소개 문구·영상·발표 자료에서 "평가계획서와 채점기준표만 보는 도구"처럼 읽히는 표현은 피한다.
- 규칙: J4, J7, J12, J6 (결정적 규칙) + S5 제안 1개. 성취기준 DB(2022 개정 중학교 정보 25개 코드)는 `src/domain/standards`.
- 화면 흐름: 올리기 → 확인 → 결과 → 정렬 맵 → 재점검 (`src/`).
- 스택: Vite + React + TypeScript + Tailwind, vitest, Playwright 스크린샷, GitHub Pages 배포 워크플로.

## 디자인 결정 (사용자 요청으로 확정된 것)

- 방향 "형광펜 대조". 자세한 것은 `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`.
- 콘텐츠 최대 폭 1240px, 흰 상단 바, 글자 크기는 30/800, 20/700, 17/500, 14/500 네 가지만(14px 미만 금지).
- 심각도 색: 확인된 오류 #D7263D, 지침 권고와 다름 #E8590C, 연결 확인 필요 #868E96, 제안 #B08800.
- 팀 로고 적용(`public/brand/`, 영상용 `video/logo.png`).
- **설명조·AI 티 나는 작은 문구는 넣지 않는다**("브라우저 안에서만 처리" 같은 것). 대신 빈 곳은 실제 서비스처럼 요소(계정·설정, 샘플 문서 목록, 대시보드)로 채운다.

## 산출물

| 무엇 | 위치 | 다시 만들기 |
|---|---|---|
| 발표용 스크린샷 6장 (1366×768 @2x) | `screenshots/` | `npm run build && npm run screenshots` |
| 기술 스택 이미지 | `docs/tech-stack.png`, 원본 `docs/tech-stack/` | `npx tsx scripts/tech-stack.ts` |
| 소개 영상 (33초) | `video/matmullim-intro.mp4` | 아래 참고 |

### 기술 스택 이미지
- 공식 로고만 사용(devicon, simple-icons). 출처는 `docs/tech-stack/LOGOS.md`. 점선 박스, 최대한 단순하게.
- **남은 일:** 한글(Hancom) 로고. 이 환경에서는 wikimedia·hancom 사이트가 막혀 못 받았다.
  `docs/tech-stack/logos/hangul.svg`(또는 `.png`)를 넣고 다시 만들면 "Document" 박스가 자동으로 추가된다.

### 소개 영상
- 실제 데모 앱 화면 중심. 화면 틀은 고정, 단계 ①~⑤를 순서대로 보여 주고 강조는 형광펜·손그림 동그라미·화살표·밑줄로 한다.
  확대는 강조할 때만 살짝 했다가 반드시 전체 화면으로 돌아온다. 엔딩은 로고 + "맞물림"이 나타나서 그대로 멈춘다(페이드 아웃 없음).
- 사용자 피드백 이력: 줌 남발·빠른 컷·휙 소리 → 어지럽고 시끄럽다고 해서 차분하게 바꿈. 처음/마지막의 "평가계획서와 채점기준표" 문장은 범용성 때문에 뺌.
- 소리: 효과음은 ElevenLabs Sound Effects로 만든 것(`video/sfx/`), 클릭·해결·엔딩에만 작게.
  배경 음악은 지금 연결된 ElevenLabs 커넥터(제한판)가 음악 생성을 못 해서 `scripts/intro-music.py`로 합성했다.
  ElevenLabs로 음악을 만들려면 전체 커넥터(https://api.elevenlabs.io/v1/mcp)를 추가해야 한다.
- 파일 구조
  - `scripts/capture-demo.ts`: 실제 앱을 조작해 `video/demo/*.png`(1600×900 @2x)와 `boxes.json`(요소 위치) 저장
  - `video/intro.html`: `window.render(t)`로 프레임을 그리는 애니메이션. `SCENES` 배열에 장면·자막·강조 표시 좌표(1600×900 기준)가 있다.
    시각표는 3초부터 시작하도록 짜여 있어 `render`가 3초를 더해 쓴다.
  - `scripts/intro-video.ts`: 프레임을 찍어 ffmpeg로 무음 영상 생성 (`--preview 1,2,3`으로 특정 시각 미리보기)
  - `scripts/intro-music.py`: 배경 음악 합성 → `video/music.wav`
  - `scripts/intro-mix.py`: 음악(앞 3초 잘라 씀) + 효과음 `CUES`를 섞어 최종 mp4
- 다시 만들기:
  `npm run build && npx tsx scripts/capture-demo.ts && npx tsx scripts/intro-video.ts && python3 scripts/intro-music.py video/music.wav && python3 scripts/intro-mix.py`
  (앱 화면이 바뀌면 `SCENES`의 강조 좌표도 같이 고쳐야 한다.)

## 환경 메모

- 네트워크: npm 레지스트리는 되고, jsDelivr·wikimedia·hancom 등은 막혀 있었다.
- 영상 작업에 ffmpeg, numpy가 필요하다(scipy 없음).
