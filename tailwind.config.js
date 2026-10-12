/** @type {import('tailwindcss').Config} */
// 형광펜 대조: 흑연 셸 · 책상 회색 바탕 · 흰 종이 · 형광펜(도구의 표시) · 파란 볼펜(교사의 판단)
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#1b1d21', 2: '#454a53', 3: '#5c626c' },
        line: { DEFAULT: '#dcdfe4', 2: '#eceef1' },
        desk: { DEFAULT: '#e8eaed', 2: '#f1f2f4' },
        paper: '#ffffff',
        graphite: { DEFAULT: '#23262b', 2: '#363a41', ink: '#c3c7ce' },
        pen: { DEFAULT: '#2747c0', 50: '#eef1fc', 100: '#dce3fa' },
        sev: {
          red: '#c8382d', 'red-mark': '#ffc9c3', 'red-bg': '#fdeeec', 'red-ink': '#9b2a21',
          orange: '#c46f10', 'orange-mark': '#ffd9a6', 'orange-bg': '#fdf3e5', 'orange-ink': '#844506',
          gray: '#6b7079', 'gray-mark': '#e1e4e9', 'gray-bg': '#f1f2f4', 'gray-ink': '#474c55',
          yellow: '#b39200', 'yellow-mark': '#fff08a', 'yellow-bg': '#fcf8da', 'yellow-ink': '#655300',
        },
      },
      fontSize: {
        meta: ['13px', '20px'],
        body: ['15px', '24px'],
        h2: ['18px', '28px'],
        h1: ['26px', '36px'],
        stat: ['28px', '32px'],
      },
      boxShadow: {
        paper: '0 1px 2px rgba(20,22,26,0.06), 0 6px 20px -4px rgba(20,22,26,0.10)',
        lift: '0 1px 2px rgba(20,22,26,0.08), 0 10px 28px -6px rgba(20,22,26,0.16)',
      },
    },
  },
  plugins: [],
};
