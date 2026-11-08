/** @type {import('tailwindcss').Config} */
// 발표 스크린샷용 정리: 로고 색(남색·파랑·초록) + 카드 의미 색 4개, 글자 크기 4단계
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // 휴대폰·좁은 창(1024px 미만)에서만 덧씌우는 화면 규칙. 데스크톱과 인쇄 화면은 그대로 둔다.
      screens: {
        narrow: { raw: 'screen and (max-width: 1023.98px)' },
        // 그중 손가락으로 쓰는 화면(휴대폰·태블릿 세로). 좁은 PC 창은 빼고 싶을 때
        touch: { raw: 'screen and (max-width: 1023.98px) and (pointer: coarse)' },
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#212529', 2: '#495057', 3: '#5f6670' },
        line: { DEFAULT: '#e3e7ed', 2: '#eef1f5' },
        canvas: '#f6f8fa',
        paper: '#ffffff',
        brand: { navy: '#0d2b57', 'navy-2': '#163d75', blue: '#0b5cad', 'blue-50': '#eaf2fb', teal: '#08a5b3', green: '#2b8a3e', 'green-50': '#ebf6ee' },
        sev: { red: '#d7263d', orange: '#e8590c', gray: '#868e96', yellow: '#b08800' },
      },
      fontSize: {
        // 4단계만: 보조 14 · 본문 17 · 핵심 문장 20 · 화면 제목 30
        help: ['14px', '22px'],
        body: ['17px', '28px'],
        key: ['20px', '30px'],
        title: ['30px', '40px'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(13, 43, 87, 0.08)',
      },
      maxWidth: { page: '1240px' },
    },
  },
  plugins: [],
};
